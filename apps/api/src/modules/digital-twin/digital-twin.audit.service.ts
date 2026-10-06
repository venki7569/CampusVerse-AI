import mongoose from 'mongoose';
import { AuditLog } from '../database/mongodb/schemas/auditLog.schema';
import { createLogger } from '../../utils/logger';

const log = createLogger('DigitalTwinAudit');

export class DigitalTwinAuditService {
  async logEvent(input: {
    actorId: string;
    action: string;
    metadata?: Record<string, unknown>;
  }): Promise<void> {
    if (mongoose.connection.readyState !== 1) return;
    try {
      await AuditLog.create({
        actorId: input.actorId,
        action: input.action,
        entityName: 'DigitalTwin',
        entityId: 'campus',
        metadata: input.metadata ?? {},
      });
    } catch (err) {
      log.warn('Failed to persist digital twin audit record', { err, action: input.action });
    }
  }
}
