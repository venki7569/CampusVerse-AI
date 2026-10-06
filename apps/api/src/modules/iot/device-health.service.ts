import { config } from '../../config/env';
import type { IoTDevice } from '@prisma/client';

export interface DeviceHealthIssue {
  code: string;
  message: string;
  severity: 'LOW' | 'MEDIUM' | 'HIGH';
}

export interface DeviceHealthReport {
  status: IoTDevice['status'];
  lastSeenAt: string | null;
  healthScore: number;
  issues: DeviceHealthIssue[];
  recommendedAction: string | null;
  dataFreshness: 'LIVE' | 'STALE' | 'UNKNOWN';
}

export class DeviceHealthService {
  assess(device: IoTDevice, invalidReadingCount = 0): DeviceHealthReport {
    const issues: DeviceHealthIssue[] = [];
    const now = Date.now();
    const staleMs = config.iot.staleThresholdMinutes * 60 * 1000;
    const offlineMs = config.iot.offlineThresholdMinutes * 60 * 1000;

    let dataFreshness: DeviceHealthReport['dataFreshness'] = 'UNKNOWN';
    let healthScore = 100;

    if (!device.isActive || device.status === 'ARCHIVED') {
      return {
        status: device.status,
        lastSeenAt: device.lastSeenAt?.toISOString() ?? null,
        healthScore: 0,
        issues: [{ code: 'ARCHIVED', message: 'Device is archived.', severity: 'LOW' }],
        recommendedAction: 'Restore or replace device if needed.',
        dataFreshness: 'UNKNOWN',
      };
    }

    if (!device.lastSeenAt) {
      issues.push({
        code: 'NEVER_SEEN',
        message: 'Device has never reported telemetry.',
        severity: 'HIGH',
      });
      healthScore -= 50;
      dataFreshness = 'UNKNOWN';
    } else {
      const ageMs = now - device.lastSeenAt.getTime();
      const ageMinutes = Math.floor(ageMs / 60_000);

      if (ageMs > offlineMs) {
        issues.push({
          code: 'OFFLINE',
          message: `Device has not reported for ${ageMinutes} minutes.`,
          severity: 'HIGH',
        });
        healthScore -= 40;
        dataFreshness = 'STALE';
      } else if (ageMs > staleMs) {
        issues.push({
          code: 'STALE',
          message: `Last telemetry received ${ageMinutes} minutes ago; data may be stale.`,
          severity: 'MEDIUM',
        });
        healthScore -= 20;
        dataFreshness = 'STALE';
      } else {
        dataFreshness = 'LIVE';
      }
    }

    if (invalidReadingCount >= config.iot.invalidReadingAlertThreshold) {
      issues.push({
        code: 'INVALID_READINGS',
        message: `Device submitted ${invalidReadingCount} invalid readings recently.`,
        severity: 'MEDIUM',
      });
      healthScore -= 15;
    }

    healthScore = Math.max(0, Math.min(100, healthScore));

    let recommendedAction: string | null = null;
    if (issues.some((i) => i.code === 'OFFLINE' || i.code === 'NEVER_SEEN')) {
      recommendedAction = 'Check network connectivity and power; verify ingest credentials.';
    } else if (issues.some((i) => i.code === 'STALE')) {
      recommendedAction = 'Inspect device communication path; confirm telemetry schedule.';
    } else if (issues.some((i) => i.code === 'INVALID_READINGS')) {
      recommendedAction = 'Review sensor calibration and payload format.';
    }

    return {
      status: device.status,
      lastSeenAt: device.lastSeenAt?.toISOString() ?? null,
      healthScore,
      issues,
      recommendedAction,
      dataFreshness,
    };
  }
}
