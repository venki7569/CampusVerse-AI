import { AuditLog } from '../database/mongodb/schemas/auditLog.schema';
import { createLogger } from '../../utils/logger';

const log = createLogger('AnnouncementAuditService');

export type AnnouncementAuditAction =
  | 'announcementCreated'
  | 'announcementUpdated'
  | 'announcementScheduled'
  | 'announcementPublished'
  | 'announcementCancelled'
  | 'announcementArchived'
  | 'announcementRead';

export class AnnouncementAuditService {
  async logEvent(entry: {
    actorId?: string;
    action: AnnouncementAuditAction;
    announcementId: string;
    metadata?: Record<string, unknown>;
  }): Promise<void> {
    try {
      await AuditLog.create({
        actorId: entry.actorId ?? 'system',
        action: entry.action,
        entityName: 'Announcement',
        entityId: entry.announcementId,
        metadata: entry.metadata ?? {},
      });
    } catch (err) {
      log.warn('Failed to persist announcement audit log', { err, action: entry.action });
    }
  }
}
