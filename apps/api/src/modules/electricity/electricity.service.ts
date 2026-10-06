import { PrismaClient, ElectricityMeter, ElectricityReading } from '@prisma/client';
import { AppError } from '../../utils/AppError';
import { buildPaginationMeta } from '../../utils/pagination';
import { createLogger } from '../../utils/logger';
import type { ElectricityRepository } from './electricity.repository';
import type { ElectricityAuditService } from './electricity.audit.service';
import { electricityEvents } from './electricity.events';
import type {
  CreateElectricityMeterDto,
  UpdateElectricityMeterDto,
  ListElectricityMetersQuery,
  CreateElectricityReadingDto,
  ListElectricityReadingsQuery,
  ElectricityAnalyticsQuery,
} from './electricity.dto';
import type { PaginatedResult } from '../../types';
import type { RequestActor } from '../../services/department-scope.service';
import {
  applyDepartmentQueryFilter,
  assertDepartmentAccess,
  resolveDepartmentScope,
} from '../../services/department-scope.service';

const log = createLogger('ElectricityService');

const ANOMALY_CONFIG = {
  thresholdMultiplier: 2.5,
  minHistoryCount: 3,
};

export class ElectricityService {
  constructor(
    private readonly repo: ElectricityRepository,
    private readonly audit: ElectricityAuditService,
    private readonly db: PrismaClient,
  ) {}

  async listMeters(query: ListElectricityMetersQuery, actor?: RequestActor): Promise<PaginatedResult<ElectricityMeter>> {
    let scopedQuery = query;
    if (actor) {
      const scope = await resolveDepartmentScope(this.db, actor);
      scopedQuery = applyDepartmentQueryFilter(scope, query);
    }
    const result = await this.repo.findAllMeters(scopedQuery);
    return {
      data: result.data,
      meta: {
        pagination: buildPaginationMeta(result.total, result.page, result.limit),
      },
    };
  }

  async getMeterById(id: string, actor?: RequestActor) {
    const meter = await this.repo.findMeterById(id);
    if (!meter) throw AppError.notFound('Electricity meter');
    if (actor) {
      const scope = await resolveDepartmentScope(this.db, actor);
      assertDepartmentAccess(scope, meter.departmentId);
    }
    return meter;
  }

  async createMeter(dto: CreateElectricityMeterDto, actorId?: string): Promise<ElectricityMeter> {
    // Check duplicate serialNumber
    const existing = await this.repo.findMeterBySerialNumber(dto.serialNumber);
    if (existing) {
      throw AppError.conflict(`Electricity meter with serial number "${dto.serialNumber}" already exists.`);
    }

    // Validate buildingId if provided
    if (dto.buildingId) {
      const bld = await this.db.building.findUnique({ where: { id: dto.buildingId } });
      if (!bld) throw AppError.notFound('Building not found');
      if (bld.operationalStatus === 'RETIRED') {
        throw AppError.badRequest('Cannot assign meter to a RETIRED building');
      }
    }

    // Validate departmentId if provided
    if (dto.departmentId) {
      const dept = await this.db.department.findUnique({ where: { id: dto.departmentId } });
      if (!dept) throw AppError.notFound('Department not found');
    }

    const meter = await this.repo.createMeter(dto);
    log.info(`Electricity meter created: ${meter.id} (${meter.serialNumber})`);

    await this.audit.logEvent({
      actorId,
      meterId: meter.id,
      serialNumber: meter.serialNumber,
      action: 'createElectricityMeter',
      details: { buildingId: meter.buildingId, departmentId: meter.departmentId },
    });

    electricityEvents.emit('electricity:meter_created', {
      meterId: meter.id,
      serialNumber: meter.serialNumber,
      timestamp: new Date().toISOString(),
      actorId,
    });

    return meter;
  }

  async updateMeter(id: string, dto: UpdateElectricityMeterDto, actorId?: string): Promise<ElectricityMeter> {
    const existing = await this.getMeterById(id);

    if (dto.serialNumber && dto.serialNumber !== existing.serialNumber) {
      const duplicate = await this.repo.findMeterBySerialNumber(dto.serialNumber);
      if (duplicate && duplicate.id !== id) {
        throw AppError.conflict(`Electricity meter with serial number "${dto.serialNumber}" already exists.`);
      }
    }

    if (dto.buildingId) {
      const bld = await this.db.building.findUnique({ where: { id: dto.buildingId } });
      if (!bld) throw AppError.notFound('Building not found');
      if (bld.operationalStatus === 'RETIRED') {
        throw AppError.badRequest('Cannot assign meter to a RETIRED building');
      }
    }

    if (dto.departmentId) {
      const dept = await this.db.department.findUnique({ where: { id: dto.departmentId } });
      if (!dept) throw AppError.notFound('Department not found');
    }

    const updated = await this.repo.updateMeter(id, dto);
    log.info(`Electricity meter updated: ${id}`);

    await this.audit.logEvent({
      actorId,
      meterId: id,
      serialNumber: updated.serialNumber,
      action: 'updateElectricityMeter',
      details: { changes: dto },
    });

    return updated;
  }

  async archiveMeter(id: string, actorId?: string): Promise<ElectricityMeter> {
    const existing = await this.getMeterById(id);
    const archived = await this.repo.archiveMeter(id);
    log.info(`Electricity meter archived: ${id}`);

    await this.audit.logEvent({
      actorId,
      meterId: id,
      serialNumber: existing.serialNumber,
      action: 'archiveElectricityMeter',
    });

    return archived;
  }

  async createReading(meterId: string, dto: CreateElectricityReadingDto, actorId?: string): Promise<ElectricityReading> {
    const meter = await this.getMeterById(meterId);
    if (!meter.isActive) {
      throw AppError.badRequest('Cannot enter utility reading for an inactive/archived meter.');
    }

    if (dto.kwhConsumption < 0) {
      throw AppError.badRequest('Electricity consumption cannot be negative.');
    }

    // Prevent future timestamps
    const now = new Date();
    if (dto.readingTime > now) {
      throw AppError.badRequest('Reading time cannot be in the future.');
    }

    const reading = await this.repo.createReading(meterId, dto.kwhConsumption, dto.readingTime);

    // Rule-based anomaly detection
    const recentReadings = await this.db.electricityReading.findMany({
      where: { meterId },
      orderBy: { readingTime: 'desc' },
      take: 11, // latest + 10 historical
    });

    const historical = recentReadings.filter((r) => r.id !== reading.id);
    if (historical.length >= ANOMALY_CONFIG.minHistoryCount) {
      const avg = historical.reduce((sum, r) => sum + r.kwhConsumption, 0) / historical.length;
      const threshold = avg * ANOMALY_CONFIG.thresholdMultiplier;

      if (dto.kwhConsumption > threshold) {
        // Flag anomaly
        const message = `Abnormal electricity consumption detected on meter ${meter.serialNumber}. Observed: ${dto.kwhConsumption} kWh, Historical Avg: ${avg.toFixed(1)} kWh (Threshold: ${threshold.toFixed(1)} kWh).`;
        
        // Find Admins to notify
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
            observedValue: dto.kwhConsumption,
            expectedValue: avg,
            message,
            severity: dto.kwhConsumption > avg * 4 ? 'CRITICAL' : 'HIGH',
          },
          admins.map((a) => a.id)
        );

        electricityEvents.emit('electricity:anomaly_detected', {
          meterId,
          serialNumber: meter.serialNumber,
          timestamp: reading.readingTime.toISOString(),
          actorId,
          metadata: { observed: dto.kwhConsumption, expected: avg, severity: 'HIGH' },
        });
      }
    }

    await this.audit.logEvent({
      actorId,
      meterId,
      serialNumber: meter.serialNumber,
      action: 'createElectricityReading',
      details: { readingId: reading.id, kwhConsumption: reading.kwhConsumption, readingTime: reading.readingTime },
    });

    electricityEvents.emit('electricity:reading_created', {
      meterId,
      serialNumber: meter.serialNumber,
      timestamp: reading.readingTime.toISOString(),
      actorId,
      metadata: { kwhConsumption: reading.kwhConsumption },
    });

    return reading;
  }

  async getReadings(meterId: string, query: ListElectricityReadingsQuery): Promise<PaginatedResult<ElectricityReading>> {
    await this.getMeterById(meterId);
    const result = await this.repo.findReadings(meterId, query);
    return {
      data: result.data,
      meta: {
        pagination: buildPaginationMeta(result.total, result.page, result.limit),
      },
    };
  }

  async getLatestReading(meterId: string): Promise<ElectricityReading | null> {
    await this.getMeterById(meterId);
    return this.repo.findLatestReading(meterId);
  }

  async getConsumptionAnalytics(query: ElectricityAnalyticsQuery) {
    const readings = await this.repo.getReadingsBetweenDates({
      from: query.from,
      to: query.to,
      buildingId: query.buildingId,
      departmentId: query.departmentId,
      meterId: query.meterId,
    });

    // Helper to format date keys
    const getDayKey = (date: Date) => date.toISOString().split('T')[0];
    const getMonthKey = (date: Date) => date.toISOString().substring(0, 7);
    const getWeekKey = (date: Date) => {
      // Return Year-Week
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
        groups.set(key, (groups.get(key) ?? 0) + r.kwhConsumption);
      });
      return Array.from(groups.entries()).map(([period, consumption]) => ({ period, consumption }));
    }

    if (query.groupBy === 'week') {
      const groups = new Map<string, number>();
      readings.forEach((r) => {
        const key = getWeekKey(r.readingTime);
        groups.set(key, (groups.get(key) ?? 0) + r.kwhConsumption);
      });
      return Array.from(groups.entries()).map(([period, consumption]) => ({ period, consumption }));
    }

    if (query.groupBy === 'month') {
      const groups = new Map<string, number>();
      readings.forEach((r) => {
        const key = getMonthKey(r.readingTime);
        groups.set(key, (groups.get(key) ?? 0) + r.kwhConsumption);
      });
      return Array.from(groups.entries()).map(([period, consumption]) => ({ period, consumption }));
    }

    if (query.groupBy === 'meter') {
      const groups = new Map<string, { label: string; consumption: number }>();
      readings.forEach((r) => {
        const key = r.meterId;
        const current = groups.get(key) ?? { label: r.meter.serialNumber, consumption: 0 };
        current.consumption += r.kwhConsumption;
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
        current.consumption += r.kwhConsumption;
        groups.set(key, current);
      });
      return Array.from(groups.entries()).map(([id, val]) => ({ id, label: val.label, consumption: val.consumption }));
    }

    if (query.groupBy === 'department') {
      const groups = new Map<string, { label: string; consumption: number }>();
      readings.forEach((r) => {
        const key = r.meter.departmentId ?? 'unassigned';
        const label = r.meter.department?.name ?? 'Unassigned';
        const current = groups.get(key) ?? { label, consumption: 0 };
        current.consumption += r.kwhConsumption;
        groups.set(key, current);
      });
      return Array.from(groups.entries()).map(([id, val]) => ({ id, label: val.label, consumption: val.consumption }));
    }

    return [];
  }
}
