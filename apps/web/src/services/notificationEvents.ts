export type NotificationClientEvent =
  | 'notification.created'
  | 'notification.read'
  | 'notification.readAll'
  | 'notification.deleted';

export type NotificationEventHandler = (event: NotificationClientEvent) => void;

/**
 * Transport-agnostic subscription point for notification realtime updates.
 * A future Socket.IO client can call notifyNotificationEvent without changing hooks.
 */
const handlers = new Set<NotificationEventHandler>();

export function subscribeToNotificationEvents(handler: NotificationEventHandler): () => void {
  handlers.add(handler);
  return () => {
    handlers.delete(handler);
  };
}

export function notifyNotificationEvent(
  event: NotificationClientEvent = 'notification.created',
): void {
  for (const handler of handlers) {
    handler(event);
  }
}
