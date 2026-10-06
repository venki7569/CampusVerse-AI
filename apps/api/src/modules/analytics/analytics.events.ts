import { createLogger } from '../../utils/logger';

const log = createLogger('AnalyticsEvents');

export type AnalyticsEventName =
  | 'analytics.updated'
  | 'analytics.snapshot.created'
  | 'analytics.report.generated';

export interface AnalyticsEventPayload {
  timestamp: string;
  section?: string;
  category?: string;
  actorId?: string;
  metadata?: Record<string, unknown>;
}

type AnalyticsEventHandler = (event: AnalyticsEventName, payload: AnalyticsEventPayload) => void;

export class AnalyticsEventsService {
  private handlers: AnalyticsEventHandler[] = [];

  subscribe(handler: AnalyticsEventHandler): () => void {
    this.handlers.push(handler);
    return () => {
      this.handlers = this.handlers.filter((h) => h !== handler);
    };
  }

  emit(event: AnalyticsEventName, payload: AnalyticsEventPayload): void {
    log.info(`[Event: ${event}] section=${payload.section ?? payload.category ?? '-'}`);
    for (const handler of this.handlers) {
      try {
        handler(event, payload);
      } catch (err) {
        log.warn(`Error in analytics event handler for ${event}`, { err });
      }
    }
  }
}

export const analyticsEvents = new AnalyticsEventsService();
