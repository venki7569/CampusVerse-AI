import mongoose from 'mongoose';
import {
  Recommendation,
  type IRecommendation,
  type RecommendationSeverity,
  type RecommendationStatus,
  type RecommendationType,
} from './recommendation.schema';
import type { EvidenceBlock } from './digital-twin.dto';

export interface CreateRecommendationInput {
  type: RecommendationType;
  severity: RecommendationSeverity;
  title: string;
  description: string;
  evidence: EvidenceBlock;
  recommendedAction: string;
  affectedEntity: { type: string; id: string; label: string };
  dedupeKey: string;
}

export class RecommendationRepository {
  isAvailable(): boolean {
    return mongoose.connection.readyState === 1;
  }

  async findRecentByDedupeKey(dedupeKey: string, since: Date): Promise<IRecommendation | null> {
    if (!this.isAvailable()) return null;
    return Recommendation.findOne({ dedupeKey, createdAt: { $gte: since } }).sort({ createdAt: -1 });
  }

  async upsertOpen(input: CreateRecommendationInput): Promise<IRecommendation | null> {
    if (!this.isAvailable()) return null;

    const existing = await Recommendation.findOne({ dedupeKey: input.dedupeKey, status: 'OPEN' });
    if (existing) {
      existing.severity = input.severity;
      existing.title = input.title;
      existing.description = input.description;
      existing.evidence = input.evidence;
      existing.recommendedAction = input.recommendedAction;
      existing.affectedEntity = input.affectedEntity;
      await existing.save();
      return existing;
    }

    return Recommendation.create({ ...input, status: 'OPEN' });
  }

  async list(filters: {
    page: number;
    limit: number;
    type?: RecommendationType;
    severity?: RecommendationSeverity;
    status?: RecommendationStatus;
    entityType?: string;
    entityId?: string;
    search?: string;
  }) {
    if (!this.isAvailable()) {
      return { data: [], total: 0 };
    }

    const query: Record<string, unknown> = {};
    if (filters.type) query['type'] = filters.type;
    if (filters.severity) query['severity'] = filters.severity;
    if (filters.status) query['status'] = filters.status;
    if (filters.entityType) query['affectedEntity.type'] = filters.entityType;
    if (filters.entityId) query['affectedEntity.id'] = filters.entityId;
    if (filters.search) {
      query['$or'] = [
        { title: { $regex: filters.search, $options: 'i' } },
        { description: { $regex: filters.search, $options: 'i' } },
      ];
    }

    const skip = (filters.page - 1) * filters.limit;
    const [data, total] = await Promise.all([
      Recommendation.find(query).sort({ createdAt: -1 }).skip(skip).limit(filters.limit),
      Recommendation.countDocuments(query),
    ]);
    return { data, total };
  }

  async countOpenBySeverity(): Promise<{ critical: number; high: number; total: number }> {
    if (!this.isAvailable()) return { critical: 0, high: 0, total: 0 };
    const [critical, high, total] = await Promise.all([
      Recommendation.countDocuments({ status: 'OPEN', severity: 'CRITICAL' }),
      Recommendation.countDocuments({ status: 'OPEN', severity: 'HIGH' }),
      Recommendation.countDocuments({ status: 'OPEN' }),
    ]);
    return { critical, high, total };
  }

  async findById(id: string): Promise<IRecommendation | null> {
    if (!this.isAvailable()) return null;
    if (!mongoose.Types.ObjectId.isValid(id)) return null;
    return Recommendation.findById(id);
  }

  async updateStatus(
    id: string,
    status: RecommendationStatus,
    actorId: string,
  ): Promise<IRecommendation | null> {
    if (!this.isAvailable()) return null;
    const doc = await this.findById(id);
    if (!doc) return null;

    doc.status = status;
    if (status === 'ACKNOWLEDGED') doc.acknowledgedBy = actorId;
    if (status === 'DISMISSED') doc.dismissedBy = actorId;
    if (status === 'RESOLVED') doc.resolvedBy = actorId;
    await doc.save();
    return doc;
  }
}
