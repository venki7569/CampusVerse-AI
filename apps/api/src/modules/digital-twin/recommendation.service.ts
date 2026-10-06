import { config } from '../../config/env';
import { publishNotification } from '../notifications/notification.service';
import { createLogger } from '../../utils/logger';
import type { MaintenanceRiskService } from './maintenance-risk.service';
import type { UtilityIntelligenceService } from './utility-intelligence.service';
import type { CampusHealthService } from './campus-health.service';
import {
  RecommendationRepository,
  type CreateRecommendationInput,
} from './recommendation.repository';
import type { RecommendationDto, ListRecommendationsQuery } from './digital-twin.dto';
import { digitalTwinEvents } from './digital-twin.events';
import type { DigitalTwinAuditService } from './digital-twin.audit.service';
import type { DigitalTwinRepository } from './digital-twin.repository';

const log = createLogger('RecommendationService');

export class RecommendationService {
  constructor(
    private readonly repo: RecommendationRepository,
    private readonly twinRepo: DigitalTwinRepository,
    private readonly maintenanceRisk: MaintenanceRiskService,
    private readonly utilityIntel: UtilityIntelligenceService,
    private readonly campusHealth: CampusHealthService,
    private readonly audit: DigitalTwinAuditService,
  ) {}

  toDto(doc: { _id: unknown; type: string; severity: string; status: string; title: string; description: string; evidence: unknown; recommendedAction: string; affectedEntity: { type: string; id: string; label: string }; createdAt: Date; updatedAt: Date }): RecommendationDto {
    return {
      id: String(doc._id),
      type: doc.type,
      severity: doc.severity,
      status: doc.status,
      title: doc.title,
      description: doc.description,
      evidence: doc.evidence as RecommendationDto['evidence'],
      recommendedAction: doc.recommendedAction,
      affectedEntity: doc.affectedEntity,
      createdAt: doc.createdAt.toISOString(),
      updatedAt: doc.updatedAt.toISOString(),
    };
  }

  async list(query: ListRecommendationsQuery) {
    const result = await this.repo.list(query);
    return {
      data: result.data.map((d) => this.toDto(d)),
      total: result.total,
      page: query.page,
      limit: query.limit,
    };
  }

  async syncFromIntelligence(actorId: string): Promise<{ created: number; updated: number; notified: number }> {
    if (!this.repo.isAvailable()) {
      return { created: 0, updated: 0, notified: 0 };
    }

    const cooldownMs = config.intelligence.recommendationCooldownHours * 60 * 60 * 1000;
    const since = new Date(Date.now() - cooldownMs);

    const [risks, anomalies, health] = await Promise.all([
      this.maintenanceRisk.assessAll(),
      this.utilityIntel.detectAnomalies(),
      this.campusHealth.calculate(),
    ]);

    let created = 0;
    let updated = 0;
    let notified = 0;

    for (const risk of risks.filter((r) => r.riskLevel === 'HIGH' || r.riskLevel === 'CRITICAL')) {
      const input: CreateRecommendationInput = {
        type: 'MAINTENANCE',
        severity: risk.riskLevel,
        title: `Maintenance risk: ${risk.assetTag}`,
        description: risk.explanation,
        evidence: risk.evidence,
        recommendedAction: risk.recommendedAction,
        affectedEntity: { type: 'Asset', id: risk.assetId, label: risk.assetName },
        dedupeKey: `maintenance:asset:${risk.assetId}`,
      };
      const recent = await this.repo.findRecentByDedupeKey(input.dedupeKey, since);
      const saved = await this.repo.upsertOpen(input);
      if (saved) {
        if (recent) updated += 1;
        else created += 1;
        if (!recent && (input.severity === 'HIGH' || input.severity === 'CRITICAL')) {
          notified += await this.notifyStakeholders(saved.title, saved.description, input.severity, `/assets`);
        }
        digitalTwinEvents.emit('recommendation.created', {
          timestamp: new Date().toISOString(),
          recommendationId: String(saved._id),
          metadata: { type: input.type, severity: input.severity },
        });
      }
    }

    for (const anomaly of anomalies.filter((a) => a.severity === 'HIGH' || a.severity === 'CRITICAL')) {
      const input: CreateRecommendationInput = {
        type: 'UTILITY',
        severity: anomaly.severity,
        title: `${anomaly.metric} anomaly: ${anomaly.entityLabel}`,
        description: anomaly.explanation,
        evidence: anomaly.evidence,
        recommendedAction: anomaly.recommendedAction,
        affectedEntity: { type: anomaly.entityType, id: anomaly.entityId, label: anomaly.entityLabel },
        dedupeKey: `utility:${anomaly.metric}:${anomaly.entityId}`,
      };
      const recent = await this.repo.findRecentByDedupeKey(input.dedupeKey, since);
      const saved = await this.repo.upsertOpen(input);
      if (saved) {
        if (recent) updated += 1;
        else created += 1;
        if (!recent) {
          notified += await this.notifyStakeholders(saved.title, saved.description, input.severity, `/electricity`);
        }
        digitalTwinEvents.emit('utilityAnomaly.detected', {
          timestamp: new Date().toISOString(),
          entityId: anomaly.entityId,
          metadata: { metric: anomaly.metric, severity: anomaly.severity },
        });
      }
    }

    if (health.healthLevel === 'HIGH' || health.healthLevel === 'CRITICAL') {
      const input: CreateRecommendationInput = {
        type: 'CAMPUS',
        severity: health.healthLevel,
        title: `Campus health score: ${health.overallScore}/100`,
        description: `Campus operational health is ${health.healthLevel}. Top risks: ${health.topRisks.join('; ') || 'none'}.`,
        evidence: {
          actual: health.overallScore,
          rule: health.formula,
          factors: health.topRisks,
          sources: health.dimensions.map((d) => d.label),
        },
        recommendedAction: health.recommendedActions[0] ?? 'Review campus operational dashboard.',
        affectedEntity: { type: 'Campus', id: 'campus', label: 'Campus' },
        dedupeKey: `campus:health:${health.healthLevel}`,
      };
      const recent = await this.repo.findRecentByDedupeKey(input.dedupeKey, since);
      const saved = await this.repo.upsertOpen(input);
      if (saved) {
        if (recent) updated += 1;
        else created += 1;
        digitalTwinEvents.emit('campusHealth.updated', {
          timestamp: new Date().toISOString(),
          metadata: { overallScore: health.overallScore, healthLevel: health.healthLevel },
        });
      }
    }

    await this.audit.logEvent({
      actorId,
      action: 'recommendationsSynced',
      metadata: { created, updated, notified },
    });

    log.info('Recommendations synced', { created, updated, notified });
    return { created, updated, notified };
  }

  private async notifyStakeholders(title: string, message: string, severity: string, link: string): Promise<number> {
    const userIds = await this.twinRepo.findAdminUserIds();
    let count = 0;
    for (const userId of userIds) {
      try {
        await publishNotification({
          userId,
          type: 'SYSTEM',
          title,
          message,
          severity: severity === 'CRITICAL' ? 'CRITICAL' : 'HIGH',
          link,
          metadata: { source: 'recommendation-engine' },
        });
        count += 1;
      } catch (err) {
        log.warn('Failed to notify stakeholder', { userId, err });
      }
    }
    return count;
  }

  async acknowledge(id: string, actorId: string): Promise<RecommendationDto | null> {
    const doc = await this.repo.updateStatus(id, 'ACKNOWLEDGED', actorId);
    if (!doc) return null;
    digitalTwinEvents.emit('recommendation.updated', {
      timestamp: new Date().toISOString(),
      recommendationId: id,
      metadata: { status: 'ACKNOWLEDGED' },
    });
    await this.audit.logEvent({ actorId, action: 'recommendationAcknowledged', metadata: { recommendationId: id } });
    return this.toDto(doc);
  }

  async dismiss(id: string, actorId: string): Promise<RecommendationDto | null> {
    const doc = await this.repo.updateStatus(id, 'DISMISSED', actorId);
    if (!doc) return null;
    digitalTwinEvents.emit('recommendation.updated', {
      timestamp: new Date().toISOString(),
      recommendationId: id,
      metadata: { status: 'DISMISSED' },
    });
    await this.audit.logEvent({ actorId, action: 'recommendationDismissed', metadata: { recommendationId: id } });
    return this.toDto(doc);
  }

  async resolve(id: string, actorId: string): Promise<RecommendationDto | null> {
    const doc = await this.repo.updateStatus(id, 'RESOLVED', actorId);
    if (!doc) return null;
    digitalTwinEvents.emit('recommendation.updated', {
      timestamp: new Date().toISOString(),
      recommendationId: id,
      metadata: { status: 'RESOLVED' },
    });
    await this.audit.logEvent({ actorId, action: 'recommendationResolved', metadata: { recommendationId: id } });
    return this.toDto(doc);
  }
}
