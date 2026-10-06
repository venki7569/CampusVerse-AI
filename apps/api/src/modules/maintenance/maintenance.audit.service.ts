import { AuditLog } from '../database/mongodb/schemas/auditLog.schema';
import { createLogger } from '../../utils/logger';
import { publishNotification } from '../notifications/notification.service';

const log = createLogger('MaintenanceAuditService');

export interface MaintenanceAuditEvent {
  actorId?: string;
  requestId: string;
  action:
    | 'createMaintenanceRequest'
    | 'updateMaintenanceRequest'
    | 'assignMaintenanceRequest'
    | 'startMaintenance'
    | 'resolveMaintenanceRequest'
    | 'closeMaintenanceRequest'
    | 'cancelMaintenanceRequest'
    | 'rejectMaintenanceRequest'
    | 'addMaintenanceComment';
  details?: Record<string, unknown>;
}

export interface MaintenanceNotificationEvent {
  userId: string;
  type: 'MAINTENANCE_UPDATE' | 'MAINTENANCE_ASSIGNED' | 'MAINTENANCE_RESOLVED' | 'MAINTENANCE_COMMENT';
  title: string;
  message: string;
  link?: string;
  metadata?: Record<string, unknown>;
}

function severityForMaintenanceType(type: MaintenanceNotificationEvent['type']): string {
  if (type === 'MAINTENANCE_UPDATE') return 'WARNING';
  if (type === 'MAINTENANCE_ASSIGNED') return 'INFO';
  if (type === 'MAINTENANCE_RESOLVED') return 'SUCCESS';
  return 'INFO';
}

export class MaintenanceAuditService {
  async logAuditEvent(entry: MaintenanceAuditEvent): Promise<void> {
    try {
      await AuditLog.create({
        actorId: entry.actorId ?? 'system',
        action: entry.action,
        entityName: 'MaintenanceRequest',
        entityId: entry.requestId,
        metadata: entry.details ?? {},
      });
    } catch (err) {
      log.warn('Failed to persist maintenance audit log', { err, requestId: entry.requestId });
    }
  }

  async sendNotification(event: MaintenanceNotificationEvent): Promise<void> {
    try {
      const severity =
        typeof event.metadata?.['severity'] === 'string'
          ? String(event.metadata['severity'])
          : severityForMaintenanceType(event.type);

      await publishNotification({
        userId: event.userId,
        type: event.type,
        title: event.title,
        message: event.message,
        link: event.link,
        severity,
        metadata: {
          ...event.metadata,
          severity,
          category: 'MAINTENANCE',
        },
      });
    } catch (err) {
      log.warn('Failed to create maintenance notification', { err, userId: event.userId });
    }
  }
}
