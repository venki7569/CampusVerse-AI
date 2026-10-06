import { AuditLog } from '../database/mongodb/schemas/auditLog.schema';
import { createLogger } from '../../utils/logger';
import type { RoomOccupancyStatus } from '@prisma/client';

const log = createLogger('RoomAuditService');

export interface RoomOccupancyAuditEntry {
  actorId?: string;
  roomId: string;
  roomNumber: string;
  floorId: string;
  previousStatus: RoomOccupancyStatus;
  newStatus: RoomOccupancyStatus;
  source: 'MANUAL' | 'SIMULATED' | 'IOT_SENSOR';
  sensorId?: string;
  reason?: string;
}

export interface RoomOccupancyHistoryItem {
  actorId?: string;
  action: string;
  entityName: string;
  entityId: string;
  metadata: Record<string, unknown>;
  createdAt: string;
}

export class RoomAuditService {
  async logOccupancyChange(payload: RoomOccupancyAuditEntry): Promise<void> {
    try {
      await AuditLog.create({
        actorId: payload.actorId ?? 'system',
        action: 'updateOccupancy',
        entityName: 'Room',
        entityId: payload.roomId,
        metadata: {
          roomNumber: payload.roomNumber,
          floorId: payload.floorId,
          previousStatus: payload.previousStatus,
          newStatus: payload.newStatus,
          source: payload.source,
          sensorId: payload.sensorId,
          reason: payload.reason,
        },
      });
    } catch (err) {
      log.warn('Failed to persist room occupancy audit record', { err, roomId: payload.roomId });
    }
  }

  async getOccupancyHistory(roomId: string, limit = 25): Promise<RoomOccupancyHistoryItem[]> {
    try {
      const history = await AuditLog.find({ entityName: 'Room', entityId: roomId })
        .sort({ createdAt: -1 })
        .limit(limit)
        .lean()
        .exec();

      return history.map((item) => ({
        actorId: item.actorId,
        action: item.action,
        entityName: item.entityName,
        entityId: item.entityId,
        metadata: item.metadata,
        createdAt: item.createdAt?.toISOString?.() ?? new Date().toISOString(),
      }));
    } catch (err) {
      log.warn('Failed to retrieve room occupancy history', { err, roomId });
      return [];
    }
  }
}
