import { createLogger } from '../../utils/logger';

const log = createLogger('DashboardEvents');

export type DashboardEventName =
  | 'dashboard.updated'
  | 'occupancy.updated'
  | 'room.occupancy.changed'
  | 'maintenance.created'
  | 'maintenance.updated'
  | 'electricity.anomaly'
  | 'water.anomaly'
  | 'asset.updated';

export interface DashboardEventPayload {
  timestamp: string;
  entityId?: string;
  metadata?: Record<string, unknown>;
}

type DashboardEventHandler = (event: DashboardEventName, payload: DashboardEventPayload) => void;

/**
 * In-process event bus for dashboard cache invalidation.
 * Socket.IO (or another transport) can subscribe here without changing producers.
 */
export class DashboardEventsService {
  private handlers: DashboardEventHandler[] = [];

  subscribe(handler: DashboardEventHandler): () => void {
    this.handlers.push(handler);
    return () => {
      this.handlers = this.handlers.filter((h) => h !== handler);
    };
  }

  emit(event: DashboardEventName, payload: DashboardEventPayload): void {
    log.info(`[Event: ${event}]`);
    for (const handler of this.handlers) {
      try {
        handler(event, payload);
      } catch (err) {
        log.warn(`Error in dashboard event handler for ${event}`, { err });
      }
    }
  }
}

export const dashboardEvents = new DashboardEventsService();
