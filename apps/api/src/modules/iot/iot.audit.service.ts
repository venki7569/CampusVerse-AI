import { AuditLog } from '../database/mongodb/schemas/auditLog.schema';
import { createLogger } from '../../utils/logger';

const log = createLogger('IoTAuditService');

export class IoTAuditService {
  async logEvent(event: {
    actorId?: string;
    action: string;
    resourceType: string;
    resourceId: string;
    details?: Record<string, unknown>;
  }): Promise<void> {
    try {
      await AuditLog.create({
        actorId: event.actorId ?? 'system',
        action: event.action,
        entityName: event.resourceType,
        entityId: event.resourceId,
        metadata: event.details ?? {},
      });
    } catch (err) {
      log.warn('Failed to write IoT audit log', { err, action: event.action });
    }
  }
}
