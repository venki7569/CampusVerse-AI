import mongoose, { Schema, Document } from 'mongoose';

export interface IAuditLog extends Document {
  actorId: string;
  action: string;
  entityName: string;
  entityId: string;
  metadata: Record<string, any>;
  createdAt: Date;
}

const AuditLogSchema = new Schema({
  actorId: { type: String, required: true, index: true },
  action: { type: String, required: true },
  entityName: { type: String, required: true, index: true },
  entityId: { type: String, required: true },
  metadata: { type: Schema.Types.Mixed, default: {} },
  createdAt: { type: Date, default: Date.now, index: true },
});

AuditLogSchema.index({ entityName: 1, entityId: 1, createdAt: -1 });

export const AuditLog = mongoose.model<IAuditLog>('AuditLog', AuditLogSchema);
