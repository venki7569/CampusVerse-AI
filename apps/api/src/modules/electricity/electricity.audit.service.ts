import { AuditLog } from '../database/mongodb/schemas/auditLog.schema';
import { createLogger } from '../../utils/logger';
import { publishNotification } from '../notifications/notification.service';

const log = createLogger('ElectricityAuditService');

export interface ElectricityAuditEntry {
  actorId?: string;
  meterId: string;
  serialNumber: string;
  action: 'createElectricityMeter' | 'updateElectricityMeter' | 'archiveElectricityMeter' | 'createElectricityReading';
  details?: Record<string, unknown>;
}

export interface ElectricityAnomalyEntry {
  meterId: string;
  serialNumber: string;
  observedValue: number;
  expectedValue: number;
  message: string;
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
}

export class ElectricityAuditService {
  async logEvent(entry: ElectricityAuditEntry): Promise<void> {
    try {
      await AuditLog.create({
        actorId: entry.actorId ?? 'system',
        action: entry.action,
        entityName: 'ElectricityMeter',
        entityId: entry.meterId,
        metadata: {
          serialNumber: entry.serialNumber,
          ...entry.details,
        },
      });
    } catch (err) {
      log.warn('Failed to persist electricity audit record', { err, meterId: entry.meterId });
    }
  }

  async createAnomalyNotification(entry: ElectricityAnomalyEntry, adminIds: string[]): Promise<void> {
    try {
      log.warn(`Anomaly detected for meter ${entry.serialNumber}: ${entry.message}`);

      await Promise.all(
        adminIds.map((adminId) =>
          publishNotification({
            userId: adminId,
            type: 'UTILITY_ANOMALY',
            title: `Electricity Anomaly - ${entry.severity}`,
            message: entry.message,
            link: `/electricity?meterId=${entry.meterId}`,
            severity: entry.severity,
            metadata: {
              meterId: entry.meterId,
              serialNumber: entry.serialNumber,
              observedValue: entry.observedValue,
              expectedValue: entry.expectedValue,
              severity: entry.severity,
              category: 'ELECTRICITY',
            },
          }),
        ),
      );
    } catch (err) {
      log.warn('Failed to create electricity anomaly notifications', { err, meterId: entry.meterId });
    }
  }
}
