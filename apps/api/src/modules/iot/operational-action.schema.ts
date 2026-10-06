import mongoose, { Schema, Document } from 'mongoose';

export const ACTION_STATUSES = ['PROPOSED', 'APPROVED', 'EXECUTING', 'COMPLETED', 'FAILED', 'CANCELLED'] as const;
export type ActionStatus = (typeof ACTION_STATUSES)[number];

export const ACTION_TYPES = [
  'CREATE_MAINTENANCE_REQUEST',
  'ACKNOWLEDGE_ALERT',
  'ASSIGN_TECHNICIAN',
  'MARK_DEVICE_INSPECTION',
  'GENERAL',
] as const;
export type ActionType = (typeof ACTION_TYPES)[number];

export interface ActionEvidence {
  rule?: string;
  factors?: string[];
  sources?: string[];
  recommendationId?: string;
  alertType?: string;
  confidence?: 'LOW' | 'MEDIUM' | 'HIGH';
}

export interface ActionAffectedEntity {
  type: string;
  id: string;
  label: string;
}

export interface IOperationalAction extends Document {
  type: ActionType;
  status: ActionStatus;
  title: string;
  description: string;
  reason: string;
  source: string;
  evidence: ActionEvidence;
  affectedEntity: ActionAffectedEntity;
  proposedBy?: string;
  approvedBy?: string;
  rejectedBy?: string;
  executedBy?: string;
  result?: string;
  dedupeKey?: string;
  createdAt: Date;
  updatedAt: Date;
}

const OperationalActionSchema = new Schema(
  {
    type: { type: String, required: true, index: true },
    status: { type: String, required: true, default: 'PROPOSED', index: true },
    title: { type: String, required: true },
    description: { type: String, required: true },
    reason: { type: String, required: true },
    source: { type: String, required: true },
    evidence: { type: Schema.Types.Mixed, default: {} },
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
    proposedBy: { type: String },
    approvedBy: { type: String },
    rejectedBy: { type: String },
    executedBy: { type: String },
    result: { type: String },
    dedupeKey: { type: String, index: true },
  },
  { timestamps: true, versionKey: false },
);

OperationalActionSchema.index({ status: 1, createdAt: -1 });

export const OperationalAction = mongoose.model<IOperationalAction>(
  'OperationalAction',
  OperationalActionSchema,
);
