import { createLogger } from '../../utils/logger';

const log = createLogger('ElectricityEvents');

export interface ElectricityEventPayload {
  meterId: string;
  serialNumber: string;
  timestamp: string;
  actorId?: string;
  metadata?: Record<string, unknown>;
}

export type ElectricityEventName =
  | 'electricity:meter_created'
  | 'electricity:reading_created'
  | 'electricity:anomaly_detected';

export class ElectricityEventsService {
  private handlers: Array<(event: ElectricityEventName, payload: ElectricityEventPayload) => void> = [];

  subscribe(handler: (event: ElectricityEventName, payload: ElectricityEventPayload) => void) {
    this.handlers.push(handler);
  }

  emit(event: ElectricityEventName, payload: ElectricityEventPayload): void {
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

export const electricityEvents = new ElectricityEventsService();
