import { PrismaClient, WaterMeter, WaterReading } from '@prisma/client';
import { AppError } from '../../utils/AppError';
import { buildPaginationMeta } from '../../utils/pagination';
import { createLogger } from '../../utils/logger';
import type { WaterRepository } from './water.repository';
import type { WaterAuditService } from './water.audit.service';
import { waterEvents } from './water.events';
import type {
  CreateWaterMeterDto,
  UpdateWaterMeterDto,
  ListWaterMetersQuery,
  CreateWaterReadingDto,
  ListWaterReadingsQuery,
  WaterAnalyticsQuery,
} from './water.dto';
import type { PaginatedResult } from '../../types';

const log = createLogger('WaterService');

const ANOMALY_CONFIG = {
  thresholdMultiplier: 2.5,
  minHistoryCount: 3,
};

export class WaterService {
  constructor(
    private readonly repo: WaterRepository,
    private readonly audit: WaterAuditService,
    private readonly db: PrismaClient,
  ) {}

  async listMeters(query: ListWaterMetersQuery): Promise<PaginatedResult<WaterMeter>> {
    const result = await this.repo.findAllMeters(query);
    return {
      data: result.data,
      meta: {
        pagination: buildPaginationMeta(result.total, result.page, result.limit),
      },
    };
  }

  async getMeterById(id: string) {
    const meter = await this.repo.findMeterById(id);
    if (!meter) throw AppError.notFound('Water meter');
    return meter;
  }

  async createMeter(dto: CreateWaterMeterDto, actorId?: string): Promise<WaterMeter> {
    const existing = await this.repo.findMeterBySerialNumber(dto.serialNumber);
    if (existing) {
      throw AppError.conflict(`Water meter with serial number "${dto.serialNumber}" already exists.`);
    }

    if (dto.buildingId) {
      const bld = await this.db.building.findUnique({ where: { id: dto.buildingId } });
      if (!bld) throw AppError.notFound('Building not found');
      if (bld.operationalStatus === 'RETIRED') {
        throw AppError.badRequest('Cannot assign meter to a RETIRED building');
      }
    }

    const meter = await this.repo.createMeter(dto);
    log.info(`Water meter created: ${meter.id} (${meter.serialNumber})`);

    await this.audit.logEvent({
      actorId,
      meterId: meter.id,
      serialNumber: meter.serialNumber,
      action: 'createWaterMeter',
      details: { buildingId: meter.buildingId },
    });

    waterEvents.emit('water:meter_created', {
      meterId: meter.id,
      serialNumber: meter.serialNumber,
      timestamp: new Date().toISOString(),
      actorId,
    });

    return meter;
  }

  async updateMeter(id: string, dto: UpdateWaterMeterDto, actorId?: string): Promise<WaterMeter> {
    const existing = await this.getMeterById(id);

    if (dto.serialNumber && dto.serialNumber !== existing.serialNumber) {
      const duplicate = await this.repo.findMeterBySerialNumber(dto.serialNumber);
      if (duplicate && duplicate.id !== id) {
        throw AppError.conflict(`Water meter with serial number "${dto.serialNumber}" already exists.`);
      }
    }

    if (dto.buildingId) {
      const bld = await this.db.building.findUnique({ where: { id: dto.buildingId } });
      if (!bld) throw AppError.notFound('Building not found');
      if (bld.operationalStatus === 'RETIRED') {
        throw AppError.badRequest('Cannot assign meter to a RETIRED building');
      }
    }

    const updated = await this.repo.updateMeter(id, dto);
    log.info(`Water meter updated: ${id}`);

    await this.audit.logEvent({
      actorId,
      meterId: id,
      serialNumber: updated.serialNumber,
      action: 'updateWaterMeter',
      details: { changes: dto },
    });

    return updated;
  }

  async archiveMeter(id: string, actorId?: string): Promise<WaterMeter> {
    const existing = await this.getMeterById(id);
    const archived = await this.repo.archiveMeter(id);
    log.info(`Water meter archived: ${id}`);

    await this.audit.logEvent({
      actorId,
      meterId: id,
      serialNumber: existing.serialNumber,
      action: 'archiveWaterMeter',
    });

    return archived;
  }

  async createReading(meterId: string, dto: CreateWaterReadingDto, actorId?: string): Promise<WaterReading> {
    const meter = await this.getMeterById(meterId);
    if (!meter.isActive) {
      throw AppError.badRequest('Cannot enter utility reading for an inactive/archived meter.');
    }

    if (dto.litersConsumption < 0) {
      throw AppError.badRequest('Water consumption cannot be negative.');
    }

    const now = new Date();
    if (dto.readingTime > now) {
      throw AppError.badRequest('Reading time cannot be in the future.');
    }

    const reading = await this.repo.createReading(meterId, dto.litersConsumption, dto.readingTime);

    // Rule-based anomaly detection
    const recentReadings = await this.db.waterReading.findMany({
      where: { meterId },
      orderBy: { readingTime: 'desc' },
      take: 11,
    });

    const historical = recentReadings.filter((r) => r.id !== reading.id);
    if (historical.length >= ANOMALY_CONFIG.minHistoryCount) {
      const avg = historical.reduce((sum, r) => sum + r.litersConsumption, 0) / historical.length;
      const threshold = avg * ANOMALY_CONFIG.thresholdMultiplier;

      if (dto.litersConsumption > threshold) {
        const message = `Abnormal water consumption detected on meter ${meter.serialNumber}. Observed: ${dto.litersConsumption} L, Historical Avg: ${avg.toFixed(1)} L (Threshold: ${threshold.toFixed(1)} L). Possible water leak!`;
        
        const admins = await this.db.user.findMany({
          where: {
            userRoles: {
              some: {
                role: {
                  name: { in: ['SUPER_ADMIN', 'CAMPUS_ADMIN'] },
                },
              },
            },
          },
          select: { id: true },
        });

        await this.audit.createAnomalyNotification(
          {
            meterId,
            serialNumber: meter.serialNumber,
            observedValue: dto.litersConsumption,
            expectedValue: avg,
            message,
            severity: dto.litersConsumption > avg * 4 ? 'CRITICAL' : 'HIGH',
          },
          admins.map((a) => a.id)
        );

        waterEvents.emit('water:anomaly_detected', {
          meterId,
          serialNumber: meter.serialNumber,
          timestamp: reading.readingTime.toISOString(),
          actorId,
          metadata: { observed: dto.litersConsumption, expected: avg, severity: 'HIGH' },
        });
      }
    }

    await this.audit.logEvent({
      actorId,
      meterId,
      serialNumber: meter.serialNumber,
      action: 'createWaterReading',
      details: { readingId: reading.id, litersConsumption: reading.litersConsumption, readingTime: reading.readingTime },
    });

    waterEvents.emit('water:reading_created', {
      meterId,
      serialNumber: meter.serialNumber,
      timestamp: reading.readingTime.toISOString(),
      actorId,
      metadata: { litersConsumption: reading.litersConsumption },
    });

    return reading;
  }

  async getReadings(meterId: string, query: ListWaterReadingsQuery): Promise<PaginatedResult<WaterReading>> {
    await this.getMeterById(meterId);
    const result = await this.repo.findReadings(meterId, query);
    return {
      data: result.data,
      meta: {
        pagination: buildPaginationMeta(result.total, result.page, result.limit),
      },
    };
  }

  async getLatestReading(meterId: string): Promise<WaterReading | null> {
    await this.getMeterById(meterId);
    return this.repo.findLatestReading(meterId);
  }

  async getConsumptionAnalytics(query: WaterAnalyticsQuery) {
    const readings = await this.repo.getReadingsBetweenDates({
      from: query.from,
      to: query.to,
      buildingId: query.buildingId,
      meterId: query.meterId,
    });

    const getDayKey = (date: Date) => date.toISOString().split('T')[0];
    const getMonthKey = (date: Date) => date.toISOString().substring(0, 7);
    const getWeekKey = (date: Date) => {
      const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
      const dayNum = d.getUTCDay() || 7;
      d.setUTCDate(d.getUTCDate() + 4 - dayNum);
      const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
      const weekNo = Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
      return `${d.getUTCFullYear()}-W${String(weekNo).padStart(2, '0')}`;
    };

    if (query.groupBy === 'day') {
      const groups = new Map<string, number>();
      readings.forEach((r) => {
        const key = getDayKey(r.readingTime);
        groups.set(key, (groups.get(key) ?? 0) + r.litersConsumption);
      });
      return Array.from(groups.entries()).map(([period, consumption]) => ({ period, consumption }));
    }

    if (query.groupBy === 'week') {
      const groups = new Map<string, number>();
      readings.forEach((r) => {
        const key = getWeekKey(r.readingTime);
        groups.set(key, (groups.get(key) ?? 0) + r.litersConsumption);
      });
      return Array.from(groups.entries()).map(([period, consumption]) => ({ period, consumption }));
    }

    if (query.groupBy === 'month') {
      const groups = new Map<string, number>();
      readings.forEach((r) => {
        const key = getMonthKey(r.readingTime);
        groups.set(key, (groups.get(key) ?? 0) + r.litersConsumption);
      });
      return Array.from(groups.entries()).map(([period, consumption]) => ({ period, consumption }));
    }

    if (query.groupBy === 'meter') {
      const groups = new Map<string, { label: string; consumption: number }>();
      readings.forEach((r) => {
        const key = r.meterId;
        const current = groups.get(key) ?? { label: r.meter.serialNumber, consumption: 0 };
        current.consumption += r.litersConsumption;
        groups.set(key, current);
      });
      return Array.from(groups.entries()).map(([id, val]) => ({ id, label: val.label, consumption: val.consumption }));
    }

    if (query.groupBy === 'building') {
      const groups = new Map<string, { label: string; consumption: number }>();
      readings.forEach((r) => {
        const key = r.meter.buildingId ?? 'unassigned';
        const label = r.meter.building?.name ?? 'Unassigned';
        const current = groups.get(key) ?? { label, consumption: 0 };
        current.consumption += r.litersConsumption;
        groups.set(key, current);
      });
      return Array.from(groups.entries()).map(([id, val]) => ({ id, label: val.label, consumption: val.consumption }));
    }

    return [];
  }
}
