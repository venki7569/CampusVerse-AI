import { config } from '../../config/env';
import { cacheService } from '../../services/cache.service';
import type { IoTDevice } from '@prisma/client';
import type { ProcessedTelemetryPoint } from './telemetry.adapters';

export interface RuleEvent {
  type: string;
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  title: string;
  description: string;
  rule: string;
  dedupeKey: string;
  affectedEntity: { type: string; id: string; label: string };
  evidence: Record<string, unknown>;
  proposedAction?: string;
}

export class OperationalRuleEngine {
  evaluateTelemetry(device: IoTDevice & { room?: { capacity?: number; roomNumber?: string } | null }, point: ProcessedTelemetryPoint): RuleEvent[] {
    const events: RuleEvent[] = [];

    if (point.metric === 'occupancy' && device.roomId && device.room) {
      const capacity = device.room.capacity ?? 0;
      const occupancy = point.normalizedValue;
      if (capacity > 0 && occupancy > capacity) {
        events.push({
          type: 'OCCUPANCY_OVER_CAPACITY',
          severity: 'CRITICAL',
          title: `Room ${device.room.roomNumber} over capacity`,
          description: `Occupancy (${occupancy}) exceeds capacity (${capacity}).`,
          rule: 'IF occupancy > capacity THEN CRITICAL occupancy alert',
          dedupeKey: `occupancy-over:${device.roomId}`,
          affectedEntity: { type: 'room', id: device.roomId, label: device.room.roomNumber ?? device.roomId },
          evidence: { occupancy, capacity, utilizationPercent: Math.round((occupancy / capacity) * 100) },
          proposedAction: 'Review room allocation and occupancy limits.',
        });
      }
    }

    if (point.metric === 'kwh' || point.metric === 'power') {
      const baselineKey = `iot:baseline:${device.id}:${point.metric}`;
      void cacheService.get<number>(baselineKey, { prefix: 'cv' }).then((baseline) => {
        if (baseline && point.normalizedValue > baseline * config.iot.utilityAnomalyMultiplier) {
          // baseline comparison handled async in service layer
        }
      });
    }

    if (
      (point.metric === 'temperature' && (point.normalizedValue > config.iot.temperatureHighC || point.normalizedValue < config.iot.temperatureLowC)) ||
      (point.metric === 'humidity' && (point.normalizedValue > config.iot.humidityHighPercent || point.normalizedValue < config.iot.humidityLowPercent)) ||
      (point.metric === 'air_quality' && point.normalizedValue > config.iot.airQualityHighIndex)
    ) {
      events.push({
        type: 'ENVIRONMENTAL_THRESHOLD',
        severity: 'MEDIUM',
        title: `Environmental threshold exceeded on ${device.name}`,
        description: `${point.metric} reading ${point.normalizedValue} ${point.normalizedUnit} is outside configured thresholds.`,
        rule: 'IF environmental metric outside threshold THEN environmental alert',
        dedupeKey: `env:${device.id}:${point.metric}`,
        affectedEntity: {
          type: device.roomId ? 'room' : 'device',
          id: device.roomId ?? device.id,
          label: device.name,
        },
        evidence: { metric: point.metric, value: point.normalizedValue, unit: point.normalizedUnit },
        proposedAction: 'Inspect HVAC or ventilation systems.',
      });
    }

    return events;
  }

  evaluateDeviceOffline(device: IoTDevice, minutesSinceLastSeen: number): RuleEvent | null {
    if (minutesSinceLastSeen < config.iot.offlineThresholdMinutes) return null;
    return {
      type: 'DEVICE_OFFLINE',
      severity: minutesSinceLastSeen > config.iot.offlineThresholdMinutes * 2 ? 'HIGH' : 'MEDIUM',
      title: `Device offline: ${device.name}`,
      description: `Device has not reported for ${minutesSinceLastSeen} minutes.`,
      rule: 'IF device lastSeen > threshold THEN device offline alert',
      dedupeKey: `device-offline:${device.id}`,
      affectedEntity: { type: 'device', id: device.id, label: device.name },
      evidence: { minutesSinceLastSeen, deviceId: device.deviceId },
      proposedAction: 'Mark device for inspection.',
    };
  }

  evaluateUtilityAnomaly(device: IoTDevice, metric: string, value: number, baseline: number): RuleEvent | null {
    if (baseline <= 0) return null;
    const ratio = value / baseline;
    if (ratio <= config.iot.utilityAnomalyMultiplier) return null;
    const isWater = metric === 'flow' || metric === 'liters';
    return {
      type: 'UTILITY_ANOMALY',
      severity: ratio > config.iot.utilityAnomalyMultiplier * 1.5 ? 'HIGH' : 'MEDIUM',
      title: `${isWater ? 'Water' : 'Electricity'} anomaly on ${device.name}`,
      description: `Observed ${value} vs baseline ${baseline.toFixed(1)} (${ratio.toFixed(1)}x). ${isWater ? 'Possible abnormal flow pattern.' : 'Consumption above baseline.'}`,
      rule: 'IF utility > baseline threshold THEN utility anomaly',
      dedupeKey: `utility-anomaly:${device.id}:${metric}`,
      affectedEntity: { type: 'device', id: device.id, label: device.name },
      evidence: { metric, value, baseline, ratio },
      proposedAction: isWater ? 'Inspect plumbing and meter health.' : 'Inspect electrical load and meter health.',
    };
  }
}
