import { AuditLog } from '../database/mongodb/schemas/auditLog.schema';
import { createLogger } from '../../utils/logger';
import { publishNotification } from '../notifications/notification.service';

const log = createLogger('WaterAuditService');

export interface WaterAuditEntry {
  actorId?: string;
  meterId: string;
  serialNumber: string;
  action: 'createWaterMeter' | 'updateWaterMeter' | 'archiveWaterMeter' | 'createWaterReading';
  details?: Record<string, unknown>;
}

export interface WaterAnomalyEntry {
  meterId: string;
  serialNumber: string;
  observedValue: number;
  expectedValue: number;
  message: string;
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
}

export class WaterAuditService {
  async logEvent(entry: WaterAuditEntry): Promise<void> {
    try {
      await AuditLog.create({
        actorId: entry.actorId ?? 'system',
        action: entry.action,
        entityName: 'WaterMeter',
        entityId: entry.meterId,
        metadata: {
          serialNumber: entry.serialNumber,
          ...entry.details,
        },
      });
    } catch (err) {
      log.warn('Failed to persist water audit record', { err, meterId: entry.meterId });
    }
  }

  async createAnomalyNotification(entry: WaterAnomalyEntry, adminIds: string[]): Promise<void> {
    try {
      log.warn(`Anomaly detected for meter ${entry.serialNumber}: ${entry.message}`);

      await Promise.all(
        adminIds.map((adminId) =>
          publishNotification({
            userId: adminId,
            type: 'UTILITY_ANOMALY',
            title: `Water Anomaly - ${entry.severity}`,
            message: entry.message,
            link: `/water?meterId=${entry.meterId}`,
            severity: entry.severity,
            metadata: {
              meterId: entry.meterId,
              serialNumber: entry.serialNumber,
              observedValue: entry.observedValue,
              expectedValue: entry.expectedValue,
              severity: entry.severity,
              category: 'WATER',
            },
          }),
        ),
      );
    } catch (err) {
      log.warn('Failed to create water anomaly notifications', { err, meterId: entry.meterId });
    }
  }
}
