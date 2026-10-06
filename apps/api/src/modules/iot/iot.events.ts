type IoTEventPayload = {
  timestamp: string;
  deviceId?: string;
  deviceInternalId?: string;
  buildingId?: string;
  roomId?: string;
  metric?: string;
  alertType?: string;
  actionId?: string;
  metadata?: Record<string, unknown>;
};

type IoTEventHandler = (event: string, payload: IoTEventPayload) => void;

class IoTEventBus {
  private handlers: IoTEventHandler[] = [];

  subscribe(handler: IoTEventHandler): () => void {
    this.handlers.push(handler);
    return () => {
      this.handlers = this.handlers.filter((h) => h !== handler);
    };
  }

  emit(event: string, payload: IoTEventPayload): void {
    for (const handler of this.handlers) {
      try {
        handler(event, payload);
      } catch {
        // Never break producers
      }
    }
  }
}

export const iotEvents = new IoTEventBus();
