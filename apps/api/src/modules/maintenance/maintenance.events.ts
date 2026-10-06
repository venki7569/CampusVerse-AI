import { createLogger } from '../../utils/logger';

const log = createLogger('MaintenanceEvents');

export interface MaintenanceEventPayload {
  requestId: string;
  status: string;
  timestamp: string;
  actorId?: string;
  metadata?: Record<string, unknown>;
}

export type MaintenanceEventName =
  | 'maintenance:created'
  | 'maintenance:assigned'
  | 'maintenance:status_changed'
  | 'maintenance:comment_added'
  | 'maintenance:resolved'
  | 'maintenance:closed'
  | 'maintenance:cancelled'
  | 'maintenance:rejected';

export class MaintenanceEventsService {
  private handlers: Array<(event: MaintenanceEventName, payload: MaintenanceEventPayload) => void> = [];

  /**
   * Register a listener (for future Socket.IO or background event bridge)
   */
  subscribe(handler: (event: MaintenanceEventName, payload: MaintenanceEventPayload) => void) {
    this.handlers.push(handler);
  }

  /**
   * Emit a maintenance domain event in a Socket.IO-ready structure
   */
  emit(event: MaintenanceEventName, payload: MaintenanceEventPayload): void {
    log.info(`[Event: ${event}] Request: ${payload.requestId} - Status: ${payload.status}`);
    for (const handler of this.handlers) {
      try {
        handler(event, payload);
      } catch (err) {
        log.warn(`Error in event handler for ${event}`, { err });
      }
    }
  }
}

export const maintenanceEvents = new MaintenanceEventsService();
