import mongoose, { Schema, Document } from 'mongoose';

export interface ISystemEvent extends Document {
  eventType: string;
  source: string;
  payload: Record<string, any>;
  level: 'info' | 'warn' | 'error' | 'critical';
  createdAt: Date;
}

const SystemEventSchema = new Schema({
  eventType: { type: String, required: true, index: true },
  source: { type: String, required: true },
  payload: { type: Schema.Types.Mixed, required: true },
  level: { type: String, enum: ['info', 'warn', 'error', 'critical'], default: 'info' },
  createdAt: { type: Date, default: Date.now, expires: '90d' }, // Auto delete after 90 days
});

export const SystemEvent = mongoose.model<ISystemEvent>('SystemEvent', SystemEventSchema);
