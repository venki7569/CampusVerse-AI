import { createLogger } from '../../utils/logger';

const log = createLogger('DigitalTwinEvents');

export type DigitalTwinEventName =
  | 'digitalTwin.updated'
  | 'recommendation.created'
  | 'recommendation.updated'
  | 'campusHealth.updated'
  | 'maintenanceRisk.updated'
  | 'utilityAnomaly.detected';

export interface DigitalTwinEventPayload {
  timestamp: string;
  recommendationId?: string;
  entityId?: string;
  actorId?: string;
  metadata?: Record<string, unknown>;
}

type DigitalTwinEventHandler = (event: DigitalTwinEventName, payload: DigitalTwinEventPayload) => void;

export class DigitalTwinEventsService {
  private handlers: DigitalTwinEventHandler[] = [];

  subscribe(handler: DigitalTwinEventHandler): () => void {
    this.handlers.push(handler);
    return () => {
      this.handlers = this.handlers.filter((h) => h !== handler);
    };
  }

  emit(event: DigitalTwinEventName, payload: DigitalTwinEventPayload): void {
    log.info(`[Event: ${event}]`);
    for (const handler of this.handlers) {
      try {
        handler(event, payload);
      } catch (err) {
        log.warn(`Error in digital twin event handler for ${event}`, { err });
      }
    }
  }
}

export const digitalTwinEvents = new DigitalTwinEventsService();
