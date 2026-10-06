import { createLogger } from '../../utils/logger';

const log = createLogger('NotificationEvents');

export type NotificationEventName =
  | 'notification.created'
  | 'notification.read'
  | 'notification.readAll'
  | 'notification.deleted';

export interface NotificationEventPayload {
  timestamp: string;
  userId: string;
  notificationId?: string;
  unreadCount?: number;
  metadata?: Record<string, unknown>;
}

type NotificationEventHandler = (
  event: NotificationEventName,
  payload: NotificationEventPayload,
) => void;

/**
 * In-process notification event bus.
 * Socket.IO (or another transport) can subscribe without changing producers.
 */
export class NotificationEventsService {
  private handlers: NotificationEventHandler[] = [];

  subscribe(handler: NotificationEventHandler): () => void {
    this.handlers.push(handler);
    return () => {
      this.handlers = this.handlers.filter((h) => h !== handler);
    };
  }

  emit(event: NotificationEventName, payload: NotificationEventPayload): void {
    log.info(`[Event: ${event}] user=${payload.userId}`);
    for (const handler of this.handlers) {
      try {
        handler(event, payload);
      } catch (err) {
        log.warn(`Error in notification event handler for ${event}`, { err });
      }
    }
  }
}

export const notificationEvents = new NotificationEventsService();
