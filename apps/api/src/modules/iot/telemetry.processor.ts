import { config } from '../../config/env';
import type { TelemetryPointDto } from './iot.dto';
import { isUnitCompatible } from './iot.dto';
import type { ProcessedTelemetryBatch, ProcessedTelemetryPoint, TelemetryProcessor } from './telemetry.adapters';

const VALUE_RANGES: Record<string, { min: number; max: number }> = {
  power: { min: 0, max: 1_000_000 },
  kwh: { min: 0, max: 1_000_000 },
  flow: { min: 0, max: 100_000 },
  liters: { min: 0, max: 1_000_000 },
  occupancy: { min: 0, max: 10_000 },
  temperature: { min: -50, max: 80 },
  humidity: { min: 0, max: 100 },
  air_quality: { min: 0, max: 500 },
  light: { min: 0, max: 200_000 },
  parking_occupied: { min: 0, max: 1 },
};

function normalizeUnit(metric: string, unit: string): string {
  const map: Record<string, string> = {
    C: 'Celsius',
    '°C': 'Celsius',
    '%': 'percent',
    count: 'people',
  };
  if (metric === 'occupancy' && unit.toLowerCase() === 'count') return 'people';
  return map[unit] ?? unit;
}

function normalizeValue(metric: string, value: number, unit: string): number {
  if (metric === 'parking_occupied' && (unit === 'boolean' || value <= 1)) {
    return value > 0 ? 1 : 0;
  }
  if (metric === 'temperature' && unit.toLowerCase() === 'f') {
    return ((value - 32) * 5) / 9;
  }
  return value;
}

export class DefaultTelemetryProcessor implements TelemetryProcessor {
  process(points: TelemetryPointDto[]): Promise<ProcessedTelemetryBatch> {
    const accepted: ProcessedTelemetryPoint[] = [];
    const rejected: Array<{ point: TelemetryPointDto; reason: string }> = [];

    const now = Date.now();
    const maxFutureMs = 5 * 60 * 1000;
    const maxPastMs = config.iot.maxTelemetryAgeDays * 24 * 60 * 60 * 1000;

    for (const point of points) {
      if (!isUnitCompatible(point.metric, point.unit)) {
        rejected.push({ point, reason: `Unit "${point.unit}" is not compatible with metric "${point.metric}"` });
        continue;
      }

      const ts = point.timestamp.getTime();
      if (ts > now + maxFutureMs) {
        rejected.push({ point, reason: 'Timestamp cannot be in the future' });
        continue;
      }
      if (ts < now - maxPastMs) {
        rejected.push({ point, reason: 'Timestamp is too old' });
        continue;
      }

      const range = VALUE_RANGES[point.metric];
      if (range && (point.value < range.min || point.value > range.max)) {
        rejected.push({ point, reason: `Value ${point.value} is outside valid range for ${point.metric}` });
        continue;
      }

      if (point.quality === 'BAD') {
        rejected.push({ point, reason: 'Quality indicator is BAD' });
        continue;
      }

      const normalizedUnit = normalizeUnit(point.metric, point.unit);
      const normalizedValue = normalizeValue(point.metric, point.value, point.unit);

      accepted.push({
        ...point,
        normalizedValue,
        normalizedUnit,
      });
    }

    return Promise.resolve({ accepted, rejected });
  }
}
