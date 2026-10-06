import { AuditLog } from '../database/mongodb/schemas/auditLog.schema';
import { createLogger } from '../../utils/logger';
import { publishNotification } from '../notifications/notification.service';

const log = createLogger('ParkingAuditService');

export type ParkingAuditAction =
  | 'createParkingArea'
  | 'updateParkingArea'
  | 'archiveParkingArea'
  | 'deleteParkingArea'
  | 'createParkingSlot'
  | 'updateParkingSlot'
  | 'archiveParkingSlot'
  | 'deleteParkingSlot'
  | 'allocateParkingSlot'
  | 'releaseParkingSlot';

export class ParkingAuditService {
  async logEvent(entry: {
    actorId?: string;
    action: ParkingAuditAction;
    entityName: 'ParkingArea' | 'ParkingSlot';
    entityId: string;
    metadata?: Record<string, unknown>;
  }): Promise<void> {
    try {
      await AuditLog.create({
        actorId: entry.actorId ?? 'system',
        action: entry.action,
        entityName: entry.entityName,
        entityId: entry.entityId,
        metadata: entry.metadata ?? {},
      });
    } catch (err) {
      log.warn('Failed to persist parking audit log', { err, action: entry.action });
    }
  }

  async notifyUser(input: {
    userId: string;
    title: string;
    message: string;
    severity?: string;
    link?: string;
    metadata?: Record<string, unknown>;
  }): Promise<void> {
    try {
      await publishNotification({
        userId: input.userId,
        type: 'SYSTEM',
        title: input.title,
        message: input.message,
        link: input.link ?? '/parking',
        severity: input.severity ?? 'INFO',
        metadata: {
          ...(input.metadata ?? {}),
          category: 'PARKING',
          severity: input.severity ?? 'INFO',
        },
      });
    } catch (err) {
      log.warn('Failed to publish parking notification', { err, userId: input.userId });
    }
  }
}
