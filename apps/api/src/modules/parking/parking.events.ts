import { createLogger } from '../../utils/logger';

const log = createLogger('ParkingEvents');

export type ParkingEventName =
  | 'parking.area.created'
  | 'parking.area.updated'
  | 'parking.area.archived'
  | 'parking.slot.created'
  | 'parking.slot.updated'
  | 'parking.slot.archived'
  | 'parking.slot.allocated'
  | 'parking.slot.released';

export interface ParkingEventPayload {
  timestamp: string;
  areaId?: string;
  slotId?: string;
  actorId?: string;
  metadata?: Record<string, unknown>;
}

type ParkingEventHandler = (event: ParkingEventName, payload: ParkingEventPayload) => void;

/**
 * In-process parking event bus.
 * Socket.IO (or another transport) can subscribe later without changing producers.
 */
export class ParkingEventsService {
  private handlers: ParkingEventHandler[] = [];

  subscribe(handler: ParkingEventHandler): () => void {
    this.handlers.push(handler);
    return () => {
      this.handlers = this.handlers.filter((h) => h !== handler);
    };
  }

  emit(event: ParkingEventName, payload: ParkingEventPayload): void {
    log.info(`[Event: ${event}] area=${payload.areaId ?? '-'} slot=${payload.slotId ?? '-'}`);
    for (const handler of this.handlers) {
      try {
        handler(event, payload);
      } catch (err) {
        log.warn(`Error in parking event handler for ${event}`, { err });
      }
    }
  }
}

export const parkingEvents = new ParkingEventsService();
