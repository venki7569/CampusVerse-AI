import { createLogger } from '../../utils/logger';

const log = createLogger('WaterEvents');

export interface WaterEventPayload {
  meterId: string;
  serialNumber: string;
  timestamp: string;
  actorId?: string;
  metadata?: Record<string, unknown>;
}

export type WaterEventName =
  | 'water:meter_created'
  | 'water:reading_created'
  | 'water:anomaly_detected';

export class WaterEventsService {
  private handlers: Array<(event: WaterEventName, payload: WaterEventPayload) => void> = [];

  subscribe(handler: (event: WaterEventName, payload: WaterEventPayload) => void) {
    this.handlers.push(handler);
  }

  emit(event: WaterEventName, payload: WaterEventPayload): void {
    log.info(`[Event: ${event}] Meter: ${payload.serialNumber}`);
    for (const handler of this.handlers) {
      try {
        handler(event, payload);
      } catch (err) {
        log.warn(`Error in event handler for ${event}`, { err });
      }
    }
  }
}

export const waterEvents = new WaterEventsService();
