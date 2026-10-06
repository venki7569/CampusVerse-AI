import { z } from 'zod';
import { paginationSchema } from '../../utils/pagination';

export const DEVICE_TYPES = [
  'ELECTRICITY_METER',
  'WATER_METER',
  'OCCUPANCY_SENSOR',
  'TEMPERATURE_SENSOR',
  'HUMIDITY_SENSOR',
  'AIR_QUALITY_SENSOR',
  'LIGHT_SENSOR',
  'PARKING_SENSOR',
  'OTHER',
] as const;

export const DEVICE_STATUSES = ['ONLINE', 'OFFLINE', 'STALE', 'MAINTENANCE', 'ARCHIVED'] as const;

export const TELEMETRY_METRICS = [
  'power',
  'kwh',
  'flow',
  'liters',
  'occupancy',
  'temperature',
  'humidity',
  'air_quality',
  'light',
  'parking_occupied',
] as const;

export const TELEMETRY_QUALITY = ['GOOD', 'UNCERTAIN', 'BAD'] as const;

const metricUnitMap: Record<string, string[]> = {
  power: ['kW', 'W'],
  kwh: ['kWh'],
  flow: ['L/min', 'L/s'],
  liters: ['L'],
  occupancy: ['people', 'count'],
  temperature: ['Celsius', 'C', '°C'],
  humidity: ['percent', '%'],
  air_quality: ['AQI', 'ppm', 'index'],
  light: ['lux'],
  parking_occupied: ['count', 'boolean'],
};

export function isUnitCompatible(metric: string, unit: string): boolean {
  const allowed = metricUnitMap[metric];
  if (!allowed) return false;
  return allowed.some((u) => u.toLowerCase() === unit.toLowerCase());
}

export const telemetryPointSchema = z.object({
  deviceId: z.string().min(1).max(128),
  timestamp: z.coerce.date(),
  metric: z.enum(TELEMETRY_METRICS),
  value: z.number().finite(),
  unit: z.string().min(1).max(32),
  quality: z.enum(TELEMETRY_QUALITY).optional().default('GOOD'),
  metadata: z.record(z.string(), z.unknown()).optional(),
  idempotencyKey: z.string().max(128).optional(),
});

export const ingestTelemetrySchema = z.object({
  body: z.union([
    telemetryPointSchema,
    z.object({ readings: z.array(telemetryPointSchema).min(1).max(100) }),
  ]),
});

export const ingestDeviceTelemetrySchema = z.object({
  params: z.object({ deviceId: z.string().min(1) }),
  body: z.union([
    telemetryPointSchema.omit({ deviceId: true }),
    z.object({ readings: z.array(telemetryPointSchema.omit({ deviceId: true })).min(1).max(100) }),
  ]),
});

export type TelemetryPointDto = z.infer<typeof telemetryPointSchema>;

export const createDeviceSchema = z.object({
  body: z.object({
    deviceId: z.string().min(1).max(128).trim(),
    name: z.string().min(1).max(200).trim(),
    type: z.enum(DEVICE_TYPES),
    manufacturer: z.string().max(100).optional(),
    model: z.string().max(100).optional(),
    serialNumber: z.string().max(100).optional(),
    buildingId: z.string().uuid().optional().nullable(),
    floorId: z.string().uuid().optional().nullable(),
    roomId: z.string().uuid().optional().nullable(),
    assetId: z.string().uuid().optional().nullable(),
    electricityMeterId: z.string().uuid().optional().nullable(),
    waterMeterId: z.string().uuid().optional().nullable(),
    metadata: z.record(z.string(), z.unknown()).optional(),
    ingestKey: z.string().min(8).max(128).optional(),
  }),
});

export const updateDeviceSchema = z.object({
  params: z.object({ id: z.string().uuid() }),
  body: z.object({
    name: z.string().min(1).max(200).trim().optional(),
    manufacturer: z.string().max(100).optional().nullable(),
    model: z.string().max(100).optional().nullable(),
    serialNumber: z.string().max(100).optional().nullable(),
    buildingId: z.string().uuid().optional().nullable(),
    floorId: z.string().uuid().optional().nullable(),
    roomId: z.string().uuid().optional().nullable(),
    assetId: z.string().uuid().optional().nullable(),
    status: z.enum(DEVICE_STATUSES).optional(),
    metadata: z.record(z.string(), z.unknown()).optional(),
    isActive: z.boolean().optional(),
  }),
});

export const deviceIdParamSchema = z.object({
  params: z.object({ id: z.string().uuid() }),
});

export const listDevicesSchema = z.object({
  query: paginationSchema.extend({
    type: z.enum(DEVICE_TYPES).optional(),
    status: z.enum(DEVICE_STATUSES).optional(),
    buildingId: z.string().uuid().optional(),
    roomId: z.string().uuid().optional(),
    isActive: z.coerce.boolean().optional(),
  }),
});

export type ListDevicesQuery = z.infer<typeof listDevicesSchema>['query'];
export type CreateDeviceDto = z.infer<typeof createDeviceSchema>['body'];
export type UpdateDeviceDto = z.infer<typeof updateDeviceSchema>['body'];

export const proposeActionSchema = z.object({
  body: z.object({
    type: z.enum(['CREATE_MAINTENANCE_REQUEST', 'ACKNOWLEDGE_ALERT', 'ASSIGN_TECHNICIAN', 'MARK_DEVICE_INSPECTION', 'GENERAL']),
    title: z.string().min(1).max(200),
    description: z.string().min(1).max(2000),
    reason: z.string().min(1).max(500),
    source: z.string().min(1).max(100),
    evidence: z.record(z.string(), z.unknown()).optional(),
    affectedEntity: z.object({
      type: z.string(),
      id: z.string(),
      label: z.string(),
    }),
    dedupeKey: z.string().optional(),
  }),
});

export const actionIdParamSchema = z.object({
  params: z.object({ id: z.string().min(1) }),
});

export const listActionsSchema = z.object({
  query: paginationSchema.extend({
    status: z.enum(['PROPOSED', 'APPROVED', 'EXECUTING', 'COMPLETED', 'FAILED', 'CANCELLED']).optional(),
  }),
});

export type ProposeActionDto = z.infer<typeof proposeActionSchema>['body'];
