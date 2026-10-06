import { TelemetryReading } from './telemetry.schema';
import { cacheService } from '../../services/cache.service';
import type { ProcessedTelemetryPoint, TelemetryRepository } from './telemetry.adapters';

export class MongoTelemetryRepository implements TelemetryRepository {
  async storeEnvironmental(point: ProcessedTelemetryPoint, deviceInternalId: string): Promise<void> {
    await TelemetryReading.create({
      deviceId: point.deviceId,
      deviceInternalId,
      timestamp: point.timestamp,
      metric: point.metric,
      value: point.normalizedValue,
      unit: point.normalizedUnit,
      quality: point.quality ?? 'GOOD',
      metadata: point.metadata,
      idempotencyKey: point.idempotencyKey,
    });
  }

  async findRecent(deviceInternalId: string, metric: string, limit: number) {
    const docs = await TelemetryReading.find({ deviceInternalId, metric })
      .sort({ timestamp: -1 })
      .limit(limit)
      .lean();
    return docs.map((d) => ({
      timestamp: d.timestamp,
      value: d.value,
      unit: d.unit,
    }));
  }

  async isDuplicate(idempotencyKey: string): Promise<boolean> {
    if (!idempotencyKey) return false;
    const cached = await cacheService.get<boolean>(`iot:dedup:${idempotencyKey}`, { prefix: 'cv' });
    if (cached) return true;
    const existing = await TelemetryReading.findOne({ idempotencyKey }).select('_id').lean();
    return !!existing;
  }

  async markProcessed(idempotencyKey: string, ttlSeconds: number): Promise<void> {
    if (!idempotencyKey) return;
    await cacheService.set(`iot:dedup:${idempotencyKey}`, true, { ttlSeconds, prefix: 'cv' });
  }
}

export class RestTelemetrySource {
  readonly name = 'REST';

  async ingest(payload: unknown): Promise<import('./iot.dto').TelemetryPointDto[]> {
    if (!payload || typeof payload !== 'object') return [];
    const body = payload as Record<string, unknown>;
    if (Array.isArray(body.readings)) {
      return body.readings as import('./iot.dto').TelemetryPointDto[];
    }
    return [body as import('./iot.dto').TelemetryPointDto];
  }
}

/** Placeholder interface for future MQTT adapter — no broker required in Phase 20. */
export interface MqttTelemetrySource {
  readonly name: string;
  connect(): Promise<void>;
  disconnect(): Promise<void>;
  ingest(payload: unknown): Promise<import('./iot.dto').TelemetryPointDto[]>;
}
