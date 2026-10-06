import { createLogger } from '../../utils/logger';

const log = createLogger('AnnouncementEvents');

export type AnnouncementEventName =
  | 'announcement.created'
  | 'announcement.updated'
  | 'announcement.scheduled'
  | 'announcement.published'
  | 'announcement.cancelled'
  | 'announcement.archived'
  | 'announcement.read';

export interface AnnouncementEventPayload {
  timestamp: string;
  announcementId: string;
  actorId?: string;
  userId?: string;
  metadata?: Record<string, unknown>;
}

type AnnouncementEventHandler = (event: AnnouncementEventName, payload: AnnouncementEventPayload) => void;

export class AnnouncementEventsService {
  private handlers: AnnouncementEventHandler[] = [];

  subscribe(handler: AnnouncementEventHandler): () => void {
    this.handlers.push(handler);
    return () => {
      this.handlers = this.handlers.filter((h) => h !== handler);
    };
  }

  emit(event: AnnouncementEventName, payload: AnnouncementEventPayload): void {
    log.info(`[Event: ${event}] announcement=${payload.announcementId}`);
    for (const handler of this.handlers) {
      try {
        handler(event, payload);
      } catch (err) {
        log.warn(`Error in announcement event handler for ${event}`, { err });
      }
    }
  }
}

export const announcementEvents = new AnnouncementEventsService();
