import type { TelemetryPointDto } from './iot.dto';

/** Transport-agnostic telemetry source (REST, MQTT, WebSocket, gateways). */
export interface TelemetrySource {
  readonly name: string;
  ingest(payload: unknown): Promise<TelemetryPointDto[]>;
}

/** Normalizes and validates telemetry before persistence. */
export interface TelemetryProcessor {
  process(points: TelemetryPointDto[]): Promise<ProcessedTelemetryBatch>;
}

export interface ProcessedTelemetryPoint extends TelemetryPointDto {
  normalizedValue: number;
  normalizedUnit: string;
  rejected?: boolean;
  rejectionReason?: string;
}

export interface ProcessedTelemetryBatch {
  accepted: ProcessedTelemetryPoint[];
  rejected: Array<{ point: TelemetryPointDto; reason: string }>;
}

/** Persists telemetry to appropriate stores (Prisma meters, Mongo time-series). */
export interface TelemetryRepository {
  storeEnvironmental(point: ProcessedTelemetryPoint, deviceInternalId: string): Promise<void>;
  findRecent(deviceInternalId: string, metric: string, limit: number): Promise<Array<{ timestamp: Date; value: number; unit: string }>>;
  isDuplicate(idempotencyKey: string): Promise<boolean>;
  markProcessed(idempotencyKey: string, ttlSeconds: number): Promise<void>;
}
