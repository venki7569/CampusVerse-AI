import mongoose, { Schema, Document } from 'mongoose';

export type TelemetryQuality = 'GOOD' | 'UNCERTAIN' | 'BAD';

export interface ITelemetryReading extends Document {
  deviceId: string;
  deviceInternalId: string;
  timestamp: Date;
  metric: string;
  value: number;
  unit: string;
  quality: TelemetryQuality;
  metadata?: Record<string, unknown>;
  idempotencyKey?: string;
  createdAt: Date;
}

const TelemetrySchema = new Schema(
  {
    deviceId: { type: String, required: true, index: true },
    deviceInternalId: { type: String, required: true, index: true },
    timestamp: { type: Date, required: true, index: true },
    metric: { type: String, required: true, index: true },
    value: { type: Number, required: true },
    unit: { type: String, required: true },
    quality: { type: String, required: true, default: 'GOOD' },
    metadata: { type: Schema.Types.Mixed },
    idempotencyKey: { type: String, sparse: true },
  },
  { timestamps: { createdAt: true, updatedAt: false }, versionKey: false },
);

TelemetrySchema.index({ deviceId: 1, timestamp: -1 });
TelemetrySchema.index({ deviceInternalId: 1, metric: 1, timestamp: -1 });
TelemetrySchema.index(
  { idempotencyKey: 1 },
  { unique: true, partialFilterExpression: { idempotencyKey: { $type: 'string' } } },
);
// Retention: TTL 90 days on createdAt
TelemetrySchema.index({ createdAt: 1 }, { expireAfterSeconds: 90 * 24 * 60 * 60 });

export const TelemetryReading = mongoose.model<ITelemetryReading>('TelemetryReading', TelemetrySchema);
