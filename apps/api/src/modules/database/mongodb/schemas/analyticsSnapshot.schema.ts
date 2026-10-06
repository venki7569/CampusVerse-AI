import mongoose, { Schema, Document } from 'mongoose';

export interface IAnalyticsSnapshot extends Document {
  metricName: string;
  dimension: string; // e.g. 'campus', 'building-123'
  period: 'daily' | 'weekly' | 'monthly';
  startDate: Date;
  endDate: Date;
  value: number;
  metadata?: Record<string, any>;
  createdAt: Date;
}

const AnalyticsSnapshotSchema = new Schema({
  metricName: { type: String, required: true, index: true },
  dimension: { type: String, required: true, index: true },
  period: { type: String, enum: ['daily', 'weekly', 'monthly'], required: true },
  startDate: { type: Date, required: true },
  endDate: { type: Date, required: true },
  value: { type: Number, required: true },
  metadata: { type: Schema.Types.Mixed },
  createdAt: { type: Date, default: Date.now }
});

// Compound index for quick querying
AnalyticsSnapshotSchema.index({ metricName: 1, dimension: 1, period: 1, startDate: 1 }, { unique: true });

export const AnalyticsSnapshot = mongoose.model<IAnalyticsSnapshot>('AnalyticsSnapshot', AnalyticsSnapshotSchema);
