import { OperationalStatus } from '@prisma/client';
import { config } from '../../config/env';
import type { DigitalTwinRepository } from './digital-twin.repository';
import type { MaintenanceRiskAssessment, RiskLevel, EvidenceBlock } from './digital-twin.dto';

function scoreToLevel(score: number): RiskLevel {
  if (score >= 75) return 'CRITICAL';
  if (score >= 55) return 'HIGH';
  if (score >= 30) return 'MEDIUM';
  return 'LOW';
}

export class MaintenanceRiskService {
  constructor(private readonly repo: DigitalTwinRepository) {}

  async assessAll(): Promise<MaintenanceRiskAssessment[]> {
    const windowDays = config.intelligence.maintenanceRiskWindowDays;
    const assets = await this.repo.listAssetsWithMaintenanceContext(windowDays);
    const now = new Date();

    return assets
      .map((asset) => this.assessAsset(asset, now, windowDays))
      .filter((a) => a.riskLevel !== 'LOW' || a.maintenanceRiskScore >= 20)
      .sort((a, b) => b.maintenanceRiskScore - a.maintenanceRiskScore);
  }

  async assessAssetById(assetId: string): Promise<MaintenanceRiskAssessment | null> {
    const windowDays = config.intelligence.maintenanceRiskWindowDays;
    const assets = await this.repo.listAssetsWithMaintenanceContext(windowDays);
    const asset = assets.find((a) => a.id === assetId);
    if (!asset) return null;
    return this.assessAsset(asset, new Date(), windowDays);
  }

  private assessAsset(
    asset: Awaited<ReturnType<DigitalTwinRepository['listAssetsWithMaintenanceContext']>>[number],
    now: Date,
    windowDays: number,
  ): MaintenanceRiskAssessment {
    const factors: string[] = [];
    let score = 0;

    if (asset.nextMaintenance && asset.nextMaintenance < now) {
      score += 30;
      factors.push('nextMaintenance is overdue');
    } else if (asset.nextMaintenance) {
      const daysUntil = (asset.nextMaintenance.getTime() - now.getTime()) / (24 * 60 * 60 * 1000);
      if (daysUntil <= 14) {
        score += 15;
        factors.push('maintenance due within 14 days');
      }
    }

    const recentEvents = asset.maintenanceRequests.length + asset.maintenanceHistory.length;
    if (recentEvents >= 4) {
      score += 25;
      factors.push(`${recentEvents} maintenance events in last ${windowDays} days`);
    } else if (recentEvents >= 2) {
      score += 12;
      factors.push(`${recentEvents} maintenance events in last ${windowDays} days`);
    }

    const condition = (asset.condition ?? '').toLowerCase();
    if (condition === 'poor') {
      score += 30;
      factors.push('condition = Poor');
    } else if (condition === 'fair') {
      score += 15;
      factors.push('condition = Fair');
    }

    if (asset.operationalStatus === OperationalStatus.UNDER_MAINTENANCE) {
      score += 20;
      factors.push('asset is under maintenance');
    }
    if (asset.operationalStatus === OperationalStatus.DAMAGED) {
      score += 25;
      factors.push('asset operational status = DAMAGED');
    }

    if (asset.warrantyExpiry) {
      const daysToWarranty = (asset.warrantyExpiry.getTime() - now.getTime()) / (24 * 60 * 60 * 1000);
      if (daysToWarranty >= 0 && daysToWarranty <= 30) {
        score += 10;
        factors.push('warranty expires within 30 days');
      }
    }

    score = Math.min(100, score);
    const riskLevel = scoreToLevel(score);
    const confidence: EvidenceBlock['confidence'] =
      recentEvents >= 2 || factors.length >= 3 ? 'HIGH' : recentEvents >= 1 ? 'MEDIUM' : 'LOW';

    const evidence: EvidenceBlock = {
      dataWindow: `Last ${windowDays} days`,
      rule: 'Rule-based score: overdue maintenance (+30), repeated events (+12–25), condition (+15–30), status (+20–25), warranty (+10)',
      factors,
      confidence,
      limitations: recentEvents === 0 ? ['Limited maintenance history available'] : [],
      sources: ['Asset', 'MaintenanceRequest', 'MaintenanceHistory'],
    };

    let recommendedAction = 'Continue routine monitoring.';
    if (riskLevel === 'CRITICAL' || riskLevel === 'HIGH') {
      recommendedAction = `Schedule preventive inspection for asset ${asset.assetTag}.`;
    } else if (riskLevel === 'MEDIUM') {
      recommendedAction = `Review maintenance plan for asset ${asset.assetTag}.`;
    }

    return {
      assetId: asset.id,
      assetTag: asset.assetTag,
      assetName: asset.name,
      maintenanceRiskScore: score,
      riskLevel,
      riskFactors: factors.length > 0 ? factors : ['No elevated risk factors detected'],
      recommendedAction,
      confidence,
      explanation: factors.length
        ? `Risk score ${score}/100 based on: ${factors.join('; ')}.`
        : `Risk score ${score}/100 — no significant factors in the ${windowDays}-day window.`,
      evidence,
    };
  }
}
