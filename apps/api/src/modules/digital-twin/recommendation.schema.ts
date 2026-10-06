import mongoose, { Schema, Document } from 'mongoose';

export const RECOMMENDATION_TYPES = [
  'MAINTENANCE',
  'UTILITY',
  'OCCUPANCY',
  'ASSET',
  'PARKING',
  'BUILDING',
  'CAMPUS',
] as const;

export type RecommendationType = (typeof RECOMMENDATION_TYPES)[number];

export const RECOMMENDATION_SEVERITIES = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'] as const;
export type RecommendationSeverity = (typeof RECOMMENDATION_SEVERITIES)[number];

export const RECOMMENDATION_STATUSES = ['OPEN', 'ACKNOWLEDGED', 'DISMISSED', 'RESOLVED'] as const;
export type RecommendationStatus = (typeof RECOMMENDATION_STATUSES)[number];

export interface RecommendationEvidence {
  dataWindow?: string;
  baseline?: number | string | null;
  actual?: number | string | null;
  threshold?: number | string | null;
  rule?: string;
  factors?: string[];
  confidence?: 'LOW' | 'MEDIUM' | 'HIGH';
  limitations?: string[];
  sources?: string[];
}

export interface AffectedEntity {
  type: string;
  id: string;
  label: string;
}

export interface IRecommendation extends Document {
  type: RecommendationType;
  severity: RecommendationSeverity;
  status: RecommendationStatus;
  title: string;
  description: string;
  evidence: RecommendationEvidence;
  recommendedAction: string;
  affectedEntity: AffectedEntity;
  dedupeKey: string;
  acknowledgedBy?: string;
  dismissedBy?: string;
  resolvedBy?: string;
  createdAt: Date;
  updatedAt: Date;
}

const RecommendationSchema = new Schema(
  {
    type: { type: String, required: true, index: true },
    severity: { type: String, required: true, index: true },
    status: { type: String, required: true, default: 'OPEN', index: true },
    title: { type: String, required: true },
    description: { type: String, required: true },
    evidence: { type: Schema.Types.Mixed, default: {} },
    recommendedAction: { type: String, required: true },
    affectedEntity: {
      type: new Schema(
        {
          type: { type: String, required: true },
          id: { type: String, required: true },
          label: { type: String, required: true },
        },
        { _id: false },
      ),
      required: true,
    },
    dedupeKey: { type: String, required: true, index: true },
    acknowledgedBy: { type: String },
    dismissedBy: { type: String },
    resolvedBy: { type: String },
  },
  { timestamps: true, versionKey: false },
);

RecommendationSchema.index({ status: 1, severity: 1, createdAt: -1 });
RecommendationSchema.index({ dedupeKey: 1, status: 1, createdAt: -1 });
RecommendationSchema.index({ 'affectedEntity.type': 1, 'affectedEntity.id': 1 });

export const Recommendation = mongoose.model<IRecommendation>('Recommendation', RecommendationSchema);
