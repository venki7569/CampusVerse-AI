import mongoose, { Schema, Document } from 'mongoose';

/**
 * Existing notification types written by operational modules.
 * Keep values stable — producers already persist these strings.
 */
export const NOTIFICATION_TYPES = [
  'MAINTENANCE_UPDATE',
  'MAINTENANCE_ASSIGNED',
  'MAINTENANCE_RESOLVED',
  'MAINTENANCE_COMMENT',
  'UTILITY_ANOMALY',
  'SYSTEM',
] as const;

export type NotificationType = (typeof NOTIFICATION_TYPES)[number] | string;

export const NOTIFICATION_SEVERITIES = ['INFO', 'LOW', 'MEDIUM', 'HIGH', 'CRITICAL', 'SUCCESS', 'WARNING'] as const;
export type NotificationSeverity = (typeof NOTIFICATION_SEVERITIES)[number];

export interface INotification extends Document {
  userId: string;
  type: string;
  title: string;
  message: string;
  isRead: boolean;
  /** Optional top-level severity for filtering. Older docs may only store this in metadata. */
  severity?: string;
  link?: string;
  metadata?: Record<string, unknown>;
  createdAt: Date;
}

const NotificationSchema = new Schema(
  {
    userId: { type: String, required: true, index: true },
    type: { type: String, required: true, index: true },
    title: { type: String, required: true },
    message: { type: String, required: true },
    isRead: { type: Boolean, default: false, index: true },
    severity: { type: String, required: false, index: true },
    link: { type: String },
    metadata: { type: Schema.Types.Mixed },
    createdAt: { type: Date, default: Date.now, index: true },
  },
  {
    // Keep lean lean documents compatible with existing writers
    versionKey: false,
  },
);

NotificationSchema.index({ userId: 1, isRead: 1, createdAt: -1 });
NotificationSchema.index({ userId: 1, createdAt: -1 });

export const Notification = mongoose.model<INotification>('Notification', NotificationSchema);
