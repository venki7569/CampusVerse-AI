import { AuditLog } from '../database/mongodb/schemas/auditLog.schema';
import { createLogger } from '../../utils/logger';

const log = createLogger('AnalyticsAuditService');

export type AnalyticsAuditAction =
  | 'analyticsViewed'
  | 'analyticsReportGenerated'
  | 'analyticsExportRequested';

export class AnalyticsAuditService {
  async logEvent(entry: {
    actorId?: string;
    action: AnalyticsAuditAction;
    metadata?: Record<string, unknown>;
  }): Promise<void> {
    try {
      await AuditLog.create({
        actorId: entry.actorId ?? 'system',
        action: entry.action,
        entityName: 'Analytics',
        entityId: entry.metadata?.['section']?.toString() ?? entry.metadata?.['category']?.toString() ?? 'campus',
        metadata: entry.metadata ?? {},
      });
    } catch (err) {
      log.warn('Failed to persist analytics audit log', { err, action: entry.action });
    }
  }
}
