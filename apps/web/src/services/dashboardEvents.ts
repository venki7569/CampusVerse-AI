export type DashboardClientEvent =
  | 'dashboard.updated'
  | 'occupancy.updated'
  | 'room.occupancy.changed'
  | 'maintenance.created'
  | 'maintenance.updated'
  | 'electricity.anomaly'
  | 'water.anomaly'
  | 'asset.updated';

export type DashboardEventHandler = (event: DashboardClientEvent) => void;

/**
 * Integration point for a future Socket.IO (or SSE) client.
 * Producers can call `notifyDashboardEvent` after mutations.
 * A real socket subscriber should replace the in-memory list without changing callers.
 */
const handlers = new Set<DashboardEventHandler>();

export function subscribeToDashboardEvents(handler: DashboardEventHandler): () => void {
  handlers.add(handler);
  return () => {
    handlers.delete(handler);
  };
}

export function notifyDashboardEvent(event: DashboardClientEvent = 'dashboard.updated'): void {
  for (const handler of handlers) {
    handler(event);
  }
}
