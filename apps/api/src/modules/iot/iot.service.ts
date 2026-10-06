import crypto from 'node:crypto';
import { PrismaClient, IoTDevice, IoTDeviceStatus } from '@prisma/client';
import { AppError } from '../../utils/AppError';
import { buildPaginationMeta } from '../../utils/pagination';
import { createLogger } from '../../utils/logger';
import { config } from '../../config/env';
import { cacheService } from '../../services/cache.service';
import { publishNotification } from '../notifications/notification.service';
import { ElectricityRepository } from '../electricity/electricity.repository';
import { ElectricityService } from '../electricity/electricity.service';
import { ElectricityAuditService } from '../electricity/electricity.audit.service';
import { WaterRepository } from '../water/water.repository';
import { WaterService } from '../water/water.service';
import { WaterAuditService } from '../water/water.audit.service';
import { RoomRepository } from '../rooms/room.repository';
import { RoomService } from '../rooms/room.service';
import { digitalTwinEvents } from '../digital-twin/digital-twin.events';
import type { IoTRepository } from './iot.repository';
import type { IoTAuditService } from './iot.audit.service';
import type { DeviceHealthService } from './device-health.service';
import type { DefaultTelemetryProcessor } from './telemetry.processor';
import type { MongoTelemetryRepository } from './telemetry.repository';
import type { OperationalRuleEngine } from './rule-engine.service';
import type { OperationalActionService } from './operational-action.service';
import type {
  CreateDeviceDto,
  ListDevicesQuery,
  TelemetryPointDto,
  UpdateDeviceDto,
} from './iot.dto';
import { iotEvents } from './iot.events';
import type { ProcessedTelemetryPoint } from './telemetry.adapters';

const log = createLogger('IoTService');

function hashIngestKey(key: string): string {
  return crypto.createHash('sha256').update(key).digest('hex');
}

export class IoTService {
  private electricityService: ElectricityService;
  private waterService: WaterService;
  private roomService: RoomService;

  constructor(
    private readonly repo: IoTRepository,
    private readonly telemetryRepo: MongoTelemetryRepository,
    private readonly processor: DefaultTelemetryProcessor,
    private readonly healthService: DeviceHealthService,
    private readonly ruleEngine: OperationalRuleEngine,
    private readonly actionService: OperationalActionService,
    private readonly audit: IoTAuditService,
    private readonly db: PrismaClient,
  ) {
    const elecRepo = new ElectricityRepository(db);
    const waterRepo = new WaterRepository(db);
    const roomRepo = new RoomRepository(db);
    this.electricityService = new ElectricityService(elecRepo, new ElectricityAuditService(), db);
    this.waterService = new WaterService(waterRepo, new WaterAuditService(), db);
    this.roomService = new RoomService(roomRepo, db);
  }

  async listDevices(query: ListDevicesQuery) {
    const result = await this.repo.findAll(query);
    return {
      data: result.data,
      meta: { pagination: buildPaginationMeta(result.total, result.page, result.limit) },
    };
  }

  async getDevice(id: string) {
    const device = await this.repo.findById(id);
    if (!device) throw AppError.notFound('IoT device');
    return device;
  }

  async getDeviceHealth(id: string) {
    const device = await this.getDevice(id);
    const invalidCount = (await cacheService.get<number>(`iot:invalid:${id}`, { prefix: 'cv' })) ?? 0;
    return this.healthService.assess(device, invalidCount);
  }

  async createDevice(dto: CreateDeviceDto, actorId?: string) {
    const existing = await this.repo.findByDeviceId(dto.deviceId);
    if (existing) throw AppError.conflict(`Device ID "${dto.deviceId}" already exists`);

    const ingestKeyHash = dto.ingestKey ? hashIngestKey(dto.ingestKey) : undefined;
    const device = await this.repo.create(dto, ingestKeyHash);

    await this.audit.logEvent({
      actorId,
      action: 'deviceCreated',
      resourceType: 'iot_device',
      resourceId: device.id,
      details: { deviceId: device.deviceId, type: device.type },
    });

    return device;
  }

  async updateDevice(id: string, dto: UpdateDeviceDto, actorId?: string) {
    await this.getDevice(id);
    const updated = await this.repo.update(id, dto);

    await this.audit.logEvent({
      actorId,
      action: 'deviceUpdated',
      resourceType: 'iot_device',
      resourceId: id,
      details: dto as Record<string, unknown>,
    });

    return updated;
  }

  async archiveDevice(id: string, actorId?: string) {
    await this.getDevice(id);
    const archived = await this.repo.archive(id);

    await this.audit.logEvent({
      actorId,
      action: 'deviceArchived',
      resourceType: 'iot_device',
      resourceId: id,
    });

    return archived;
  }

  async getControlCenterSummary() {
    const [total, statusGroups, staleDevices] = await Promise.all([
      this.repo.countActive(),
      this.repo.countByStatus(),
      this.repo.findStaleDevices(new Date(Date.now() - config.iot.staleThresholdMinutes * 60_000)),
    ]);

    const byStatus = Object.fromEntries(statusGroups.map((g: { status: string; _count: { _all: number } }) => [g.status, g._count._all]));

    return {
      totalDevices: total,
      online: byStatus.ONLINE ?? 0,
      offline: byStatus.OFFLINE ?? 0,
      stale: staleDevices.length,
      maintenance: byStatus.MAINTENANCE ?? 0,
      staleDeviceIds: staleDevices.map((d: { id: string }) => d.id),
    };
  }

  async ingestTelemetry(
    rawPoints: TelemetryPointDto[],
    options: { actorId?: string; deviceIdOverride?: string; ingestKey?: string } = {},
  ) {
    const results: Array<{ deviceId: string; accepted: number; rejected: number }> = [];

    const batch = await this.processor.process(rawPoints);
    for (const rejection of batch.rejected) {
      log.warn('Telemetry rejected', { reason: rejection.reason, deviceId: rejection.point.deviceId });
    }

    const byDevice = new Map<string, ProcessedTelemetryPoint[]>();
    for (const point of batch.accepted) {
      const key = options.deviceIdOverride ?? point.deviceId;
      if (!byDevice.has(key)) byDevice.set(key, []);
      byDevice.get(key)!.push({ ...point, deviceId: key });
    }

    for (const [deviceId, points] of byDevice) {
      const device = await this.repo.findByDeviceId(deviceId);
      if (!device) {
        results.push({ deviceId, accepted: 0, rejected: points.length });
        continue;
      }

      if (!device.isActive) {
        results.push({ deviceId, accepted: 0, rejected: points.length });
        continue;
      }

      if (options.ingestKey && device.ingestKeyHash) {
        if (hashIngestKey(options.ingestKey) !== device.ingestKeyHash) {
          throw AppError.unauthorized('Invalid device ingest key');
        }
      }

      let accepted = 0;
      let rejected = 0;
      const wasOffline = device.status === 'OFFLINE' || !device.lastSeenAt;

      for (const point of points) {
        if (point.idempotencyKey) {
          const dup = await this.telemetryRepo.isDuplicate(point.idempotencyKey);
          if (dup) {
            rejected += 1;
            continue;
          }
        }

        try {
          await this.routeTelemetry(device, point, options.actorId);
          if (point.idempotencyKey) {
            await this.telemetryRepo.markProcessed(point.idempotencyKey, config.iot.dedupTtlSeconds);
          }
          accepted += 1;
        } catch (err) {
          rejected += 1;
          const invalidCount = ((await cacheService.get<number>(`iot:invalid:${device.id}`, { prefix: 'cv' })) ?? 0) + 1;
          await cacheService.set(`iot:invalid:${device.id}`, invalidCount, { ttlSeconds: 3600, prefix: 'cv' });
          log.warn('Telemetry routing failed', { deviceId, err });
        }
      }

      const latestTs = points.reduce((max, p) => (p.timestamp > max ? p.timestamp : max), points[0]!.timestamp);
      const newStatus = this.resolveDeviceStatus(latestTs);
      await this.repo.updateLastSeen(device.id, newStatus, latestTs);

      await cacheService.set(
        `iot:device:${device.id}:latest`,
        { timestamp: latestTs.toISOString(), accepted },
        { ttlSeconds: config.iot.deviceStateTtlSeconds, prefix: 'cv' },
      );

      if (wasOffline && newStatus === 'ONLINE') {
        iotEvents.emit('device.online', {
          timestamp: new Date().toISOString(),
          deviceId: device.deviceId,
          deviceInternalId: device.id,
          buildingId: device.buildingId ?? undefined,
        });
      }

      iotEvents.emit('telemetry.updated', {
        timestamp: new Date().toISOString(),
        deviceId: device.deviceId,
        deviceInternalId: device.id,
        buildingId: device.buildingId ?? undefined,
        roomId: device.roomId ?? undefined,
        metadata: { accepted, rejected },
      });

      await this.audit.logEvent({
        actorId: options.actorId,
        action: 'telemetryIngested',
        resourceType: 'iot_device',
        resourceId: device.id,
        details: { accepted, rejected, deviceId: device.deviceId },
      });

      digitalTwinEvents.emit('digitalTwin.updated', {
        timestamp: new Date().toISOString(),
        entityId: device.buildingId ?? device.id,
        metadata: { source: 'iot' },
      });

      results.push({ deviceId, accepted, rejected });
    }

    return { results, rejected: batch.rejected };
  }

  private resolveDeviceStatus(lastSeenAt: Date): IoTDeviceStatus {
    const ageMs = Date.now() - lastSeenAt.getTime();
    if (ageMs > config.iot.offlineThresholdMinutes * 60_000) return 'OFFLINE';
    if (ageMs > config.iot.staleThresholdMinutes * 60_000) return 'STALE';
    return 'ONLINE';
  }

  private async routeTelemetry(device: IoTDevice, point: ProcessedTelemetryPoint, actorId?: string) {
    if (point.metric === 'kwh' && device.electricityMeterId) {
      await this.electricityService.createReading(
        device.electricityMeterId,
        { kwhConsumption: point.normalizedValue, readingTime: point.timestamp },
        actorId,
      );
      iotEvents.emit('utility.updated', {
        timestamp: new Date().toISOString(),
        deviceInternalId: device.id,
        metric: 'kwh',
        metadata: { value: point.normalizedValue },
      });
      await this.checkUtilityBaseline(device, point);
      return;
    }

    if (point.metric === 'liters' && device.waterMeterId) {
      await this.waterService.createReading(
        device.waterMeterId,
        { litersConsumption: point.normalizedValue, readingTime: point.timestamp },
        actorId,
      );
      iotEvents.emit('utility.updated', {
        timestamp: new Date().toISOString(),
        deviceInternalId: device.id,
        metric: 'liters',
        metadata: { value: point.normalizedValue },
      });
      await this.checkUtilityBaseline(device, point);
      return;
    }

    if (point.metric === 'occupancy' && device.roomId) {
      await this.telemetryRepo.storeEnvironmental(point, device.id);
      const status = point.normalizedValue > 0 ? 'OCCUPIED' : 'AVAILABLE';
      await this.roomService.updateOccupancy(
        device.roomId,
        { occupancyStatus: status, source: 'IOT_SENSOR', sensorId: device.deviceId },
        actorId,
      );
      await cacheService.set(
        `iot:occupancy:${device.roomId}`,
        {
          count: point.normalizedValue,
          timestamp: point.timestamp.toISOString(),
          status: 'LIVE',
        },
        { ttlSeconds: config.iot.deviceStateTtlSeconds, prefix: 'cv' },
      );
      iotEvents.emit('occupancy.updated', {
        timestamp: new Date().toISOString(),
        roomId: device.roomId,
        metadata: { occupancy: point.normalizedValue },
      });
    } else {
      await this.telemetryRepo.storeEnvironmental(point, device.id);
    }

    const deviceWithRoom = await this.repo.findById(device.id);
    const ruleEvents = this.ruleEngine.evaluateTelemetry(deviceWithRoom ?? device, point);
    for (const evt of ruleEvents) {
      await this.handleRuleEvent(evt, actorId);
    }
  }

  private async checkUtilityBaseline(device: IoTDevice, point: ProcessedTelemetryPoint) {
    const baselineKey = `iot:baseline:${device.id}:${point.metric}`;
    const cachedBaseline = await cacheService.get<number>(baselineKey, { prefix: 'cv' });
    const baseline = cachedBaseline ?? point.normalizedValue * 0.8;
    if (!cachedBaseline) {
      await cacheService.set(baselineKey, baseline, { ttlSeconds: 86400, prefix: 'cv' });
    }
    const anomaly = this.ruleEngine.evaluateUtilityAnomaly(device, point.metric, point.normalizedValue, baseline);
    if (anomaly) await this.handleRuleEvent(anomaly, undefined);
  }

  private async handleRuleEvent(evt: import('./rule-engine.service').RuleEvent, actorId?: string) {
    const cooldownKey = `iot:alert:${evt.dedupeKey}`;
    const seen = await cacheService.get<boolean>(cooldownKey, { prefix: 'cv' });
    if (seen) return;
    await cacheService.set(cooldownKey, true, {
      ttlSeconds: config.iot.alertCooldownSeconds,
      prefix: 'cv',
    });

    iotEvents.emit('device.alert', {
      timestamp: new Date().toISOString(),
      alertType: evt.type,
      deviceInternalId: evt.affectedEntity.type === 'device' ? evt.affectedEntity.id : undefined,
      metadata: { severity: evt.severity, title: evt.title },
    });

    await this.audit.logEvent({
      actorId,
      action: 'deviceAlertCreated',
      resourceType: evt.affectedEntity.type,
      resourceId: evt.affectedEntity.id,
      details: { alertType: evt.type, rule: evt.rule },
    });

    const admins = await this.db.user.findMany({
      where: {
        userRoles: {
          some: { role: { name: { in: ['SUPER_ADMIN', 'CAMPUS_ADMIN'] } } },
        },
      },
      select: { id: true },
      take: 20,
    });

    for (const admin of admins) {
      await publishNotification({
        userId: admin.id,
        type: 'SYSTEM',
        title: evt.title,
        message: evt.description,
        metadata: { alertType: evt.type, dedupeKey: evt.dedupeKey },
      });
    }

    if (evt.proposedAction) {
      await this.actionService.propose(
        {
          type: evt.type === 'DEVICE_OFFLINE' ? 'MARK_DEVICE_INSPECTION' : 'GENERAL',
          title: evt.title,
          description: evt.description,
          reason: evt.rule,
          source: 'rule_engine',
          evidence: evt.evidence,
          affectedEntity: evt.affectedEntity,
          dedupeKey: `action:${evt.dedupeKey}`,
        },
        actorId,
      );
    }
  }

  async getRecentTelemetry(deviceId: string, limit = 20) {
    const device = await this.getDevice(deviceId);
    const metrics = ['temperature', 'humidity', 'air_quality', 'occupancy', 'light'];
    const results: Record<string, Array<{ timestamp: Date; value: number; unit: string }>> = {};
    for (const metric of metrics) {
      results[metric] = await this.telemetryRepo.findRecent(device.id, metric, limit);
    }
    return results;
  }

  async getOccupancyInsight(roomId: string) {
    const cached = await cacheService.get<{
      count: number;
      timestamp: string;
      status: 'LIVE' | 'STALE';
    }>(`iot:occupancy:${roomId}`, { prefix: 'cv' });

    const room = await this.db.room.findUnique({
      where: { id: roomId },
      select: { id: true, roomNumber: true, capacity: true, occupancyStatus: true },
    });
    if (!room) throw AppError.notFound('Room');

    let dataStatus: 'LIVE' | 'STALE' | 'UNKNOWN' = 'UNKNOWN';
    let occupancy = room.occupancyStatus === 'OCCUPIED' ? 1 : 0;

    if (cached) {
      const ageMs = Date.now() - new Date(cached.timestamp).getTime();
      dataStatus = ageMs > config.iot.staleThresholdMinutes * 60_000 ? 'STALE' : cached.status;
      occupancy = cached.count;
    }

    const utilization = room.capacity > 0 ? Math.round((occupancy / room.capacity) * 100) : null;

    return {
      roomId: room.id,
      roomNumber: room.roomNumber,
      capacity: room.capacity,
      occupancy,
      utilizationPercent: utilization,
      dataStatus,
    };
  }

  async getEnvironmentalSummary(buildingId: string) {
    const devices = await this.db.ioTDevice.findMany({
      where: {
        buildingId,
        isActive: true,
        type: { in: ['TEMPERATURE_SENSOR', 'HUMIDITY_SENSOR', 'AIR_QUALITY_SENSOR'] },
      },
      take: 50,
    });

    const summaries = [];
    for (const device of devices) {
      const recent = await this.telemetryRepo.findRecent(device.id, this.typeToMetric(device.type), 1);
      const latest = recent[0];
      summaries.push({
        deviceId: device.id,
        deviceName: device.name,
        type: device.type,
        roomId: device.roomId,
        latest: latest
          ? {
              value: latest.value,
              unit: latest.unit,
              timestamp: latest.timestamp.toISOString(),
              status:
                Date.now() - latest.timestamp.getTime() > config.iot.staleThresholdMinutes * 60_000
                  ? 'STALE'
                  : 'LIVE',
            }
          : null,
      });
    }

    return { buildingId, sensors: summaries };
  }

  private typeToMetric(type: IoTDevice['type']): string {
    const map: Record<string, string> = {
      TEMPERATURE_SENSOR: 'temperature',
      HUMIDITY_SENSOR: 'humidity',
      AIR_QUALITY_SENSOR: 'air_quality',
      LIGHT_SENSOR: 'light',
    };
    return map[type] ?? 'temperature';
  }

  async scanOfflineDevices() {
    const stale = await this.repo.findStaleDevices(
      new Date(Date.now() - config.iot.offlineThresholdMinutes * 60_000),
    );
    for (const device of stale) {
      const minutes = device.lastSeenAt
        ? Math.floor((Date.now() - device.lastSeenAt.getTime()) / 60_000)
        : config.iot.offlineThresholdMinutes * 2;
      const evt = this.ruleEngine.evaluateDeviceOffline(device, minutes);
      if (evt) {
        await this.repo.updateLastSeen(device.id, 'OFFLINE', device.lastSeenAt ?? new Date(0));
        iotEvents.emit('device.offline', {
          timestamp: new Date().toISOString(),
          deviceId: device.deviceId,
          deviceInternalId: device.id,
        });
        await this.handleRuleEvent(evt);
      }
    }
    return { scanned: stale.length };
  }
}
