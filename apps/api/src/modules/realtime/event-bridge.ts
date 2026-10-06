import { createLogger } from '../../utils/logger';
import { dashboardEvents } from '../dashboard/dashboard.events';
import { notificationEvents } from '../notifications/notification.events';
import { parkingEvents } from '../parking/parking.events';
import { analyticsEvents } from '../analytics/analytics.events';
import { maintenanceEvents } from '../maintenance/maintenance.events';
import { aiEvents } from '../ai/ai.events';
import { announcementEvents } from '../announcements/announcement.events';
import { digitalTwinEvents } from '../digital-twin/digital-twin.events';
import { iotEvents } from '../iot/iot.events';
import { electricityEvents } from '../electricity/electricity.events';
import { waterEvents } from '../water/water.events';
import {
  emitToCampus,
  emitToUser,
  type RealtimeEnvelope,
} from './socket.server';

const log = createLogger('EventBridge');

function sanitizePayload(payload: Record<string, unknown> | undefined): Record<string, unknown> | undefined {
  if (!payload) return undefined;
  const safe: Record<string, unknown> = {};
  const allowedKeys = [
    'timestamp',
    'entityId',
    'requestId',
    'status',
    'areaId',
    'slotId',
    'section',
    'category',
    'announcementId',
    'notificationId',
    'unreadCount',
    'conversationId',
    'tool',
    'recommendationId',
    'deviceId',
    'metric',
    'alertType',
    'actionId',
    'buildingId',
    'roomId',
  ];
  for (const key of allowedKeys) {
    if (payload[key] !== undefined) {
      safe[key] = payload[key];
    }
  }
  return Object.keys(safe).length > 0 ? safe : undefined;
}

function envelope(channel: string, event: string, payload?: Record<string, unknown>): RealtimeEnvelope {
  return {
    channel,
    event,
    timestamp: new Date().toISOString(),
    payload: sanitizePayload(payload),
  };
}

/**
 * Bridges in-process domain event buses to Socket.IO without changing producers.
 * Failures here must never affect REST operations.
 */
export function registerEventBridge(): void {
  dashboardEvents.subscribe((event, payload) => {
    emitToCampus(
      envelope('dashboard', event, {
        timestamp: payload.timestamp,
        entityId: payload.entityId,
        ...payload.metadata,
      }),
    );
  });

  notificationEvents.subscribe((event, payload) => {
    emitToUser(
      payload.userId,
      envelope('notification', event, {
        timestamp: payload.timestamp,
        notificationId: payload.notificationId,
        unreadCount: payload.unreadCount,
      }),
    );
  });

  parkingEvents.subscribe((event, payload) => {
    emitToCampus(
      envelope('parking', event, {
        timestamp: payload.timestamp,
        areaId: payload.areaId,
        slotId: payload.slotId,
      }),
    );
  });

  analyticsEvents.subscribe((event, payload) => {
    emitToCampus(
      envelope('analytics', event, {
        timestamp: payload.timestamp,
        section: payload.section,
        category: payload.category,
      }),
    );
  });

  maintenanceEvents.subscribe((event, payload) => {
    emitToCampus(
      envelope('maintenance', event, {
        timestamp: payload.timestamp,
        requestId: payload.requestId,
        status: payload.status,
      }),
    );
  });

  aiEvents.subscribe((event, payload) => {
    if (!payload.userId) return;
    emitToUser(
      payload.userId,
      envelope('ai', event, {
        timestamp: payload.timestamp,
        conversationId: payload.conversationId,
        tool: payload.tool,
      }),
    );
  });

  announcementEvents.subscribe((event, payload) => {
    if (event === 'announcement.read' && payload.userId) {
      emitToUser(
        payload.userId,
        envelope('announcement', event, {
          timestamp: payload.timestamp,
          announcementId: payload.announcementId,
        }),
      );
      return;
    }

    emitToCampus(
      envelope('announcement', event, {
        timestamp: payload.timestamp,
        announcementId: payload.announcementId,
      }),
    );
  });

  digitalTwinEvents.subscribe((event, payload) => {
    emitToCampus(
      envelope('digital-twin', event, {
        timestamp: payload.timestamp,
        entityId: payload.entityId,
        recommendationId: payload.recommendationId,
        ...payload.metadata,
      }),
    );
  });

  iotEvents.subscribe((event, payload) => {
    emitToCampus(
      envelope('iot', event, {
        timestamp: payload.timestamp,
        entityId: payload.deviceInternalId,
        deviceId: payload.deviceId,
        buildingId: payload.buildingId,
        roomId: payload.roomId,
        metric: payload.metric,
        alertType: payload.alertType,
        actionId: payload.actionId,
        ...payload.metadata,
      }),
    );
    if (event.startsWith('telemetry') || event.startsWith('device') || event.startsWith('utility') || event.startsWith('occupancy')) {
      emitToCampus(
        envelope('digital-twin', 'digitalTwin.updated', {
          timestamp: payload.timestamp,
          entityId: payload.buildingId ?? payload.deviceInternalId,
        }),
      );
    }
  });

  electricityEvents.subscribe((event, payload) => {
    emitToCampus(
      envelope('iot', event, {
        timestamp: payload.timestamp,
        entityId: payload.meterId,
        ...payload.metadata,
      }),
    );
  });

  waterEvents.subscribe((event, payload) => {
    emitToCampus(
      envelope('iot', event, {
        timestamp: payload.timestamp,
        entityId: payload.meterId,
        ...payload.metadata,
      }),
    );
  });

  log.info('Realtime event bridge registered');
}
