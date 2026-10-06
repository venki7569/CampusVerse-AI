import { AuditLog } from '../database/mongodb/schemas/auditLog.schema';
import { createLogger } from '../../utils/logger';
import type { CampusToolName } from './ai.tools';

const log = createLogger('AIAuditService');

export type AIAuditAction =
  | 'aiConversationCreated'
  | 'aiQuery'
  | 'aiConversationDeleted'
  | 'aiToolUsed';

export class AIAuditService {
  async logEvent(entry: {
    actorId?: string;
    action: AIAuditAction;
    conversationId?: string;
    metadata?: Record<string, unknown>;
  }): Promise<void> {
    try {
      await AuditLog.create({
        actorId: entry.actorId ?? 'system',
        action: entry.action,
        entityName: 'AIConversation',
        entityId: entry.conversationId ?? 'campus-ai',
        metadata: entry.metadata ?? {},
      });
    } catch (err) {
      log.warn('Failed to persist AI audit log', { err, action: entry.action });
    }
  }

  async logToolUse(actorId: string, conversationId: string, tool: CampusToolName, success: boolean): Promise<void> {
    await this.logEvent({
      actorId,
      action: 'aiToolUsed',
      conversationId,
      metadata: { tool, success },
    });
  }
}
