import { RoomOccupancyStatus, PrismaClient } from '@prisma/client';
import { AppError } from '../../utils/AppError';
import { buildPaginationMeta } from '../../utils/pagination';
import { createLogger } from '../../utils/logger';
import type { RoomRepository } from './room.repository';
import { RoomAuditService } from './room.audit.service';
import { dashboardEvents } from '../dashboard/dashboard.events';
import type {
  CreateRoomDto,
  UpdateRoomDto,
  UpdateOccupancyDto,
  ListRoomsQuery,
} from './room.dto';
import type { RequestActor } from '../../services/department-scope.service';
import {
  applyDepartmentQueryFilter,
  assertDepartmentAccess,
  resolveDepartmentScope,
} from '../../services/department-scope.service';

const log = createLogger('RoomService');

export class RoomService {
  private readonly audit = new RoomAuditService();

  constructor(
    private readonly repo: RoomRepository,
    private readonly db?: PrismaClient,
  ) {}

  async list(query: ListRoomsQuery, actor?: RequestActor) {
    let scopedQuery = query;
    if (actor && this.db) {
      const scope = await resolveDepartmentScope(this.db, actor);
      scopedQuery = applyDepartmentQueryFilter(scope, query);
    }
    const result = await this.repo.findAll(scopedQuery);
    return {
      data: result.data,
      meta: { pagination: buildPaginationMeta(result.total, result.page, result.limit) },
    };
  }

  async getById(id: string, actor?: RequestActor) {
    const room = await this.repo.findById(id);
    if (!room) throw AppError.notFound('Room');
    if (actor && this.db) {
      const scope = await resolveDepartmentScope(this.db, actor);
      assertDepartmentAccess(scope, room.departmentId);
    }
    return room;
  }

  async create(dto: CreateRoomDto) {
    if (this.db) {
      const floor = await this.db.floor.findUnique({
        where: { id: dto.floorId },
        include: { building: true },
      });
      if (!floor) throw AppError.notFound('Floor');
      if (floor.building.operationalStatus === 'RETIRED') {
        throw AppError.badRequest('Cannot add rooms to a floor in a retired building');
      }
      if (dto.departmentId) {
        const dept = await this.db.department.findUnique({ where: { id: dto.departmentId } });
        if (!dept) throw AppError.notFound('Department');
      }
    }

    const existing = await this.repo.findByRoomNumberAndFloor(dto.roomNumber, dto.floorId);
    if (existing) {
      throw AppError.conflict(`Room '${dto.roomNumber}' already exists on this floor`);
    }
    const room = await this.repo.create(dto);
    log.info(`Room created: ${room.id} (${room.roomNumber}, type=${room.roomType})`);
    return room;
  }

  async update(id: string, dto: UpdateRoomDto) {
    const existing = await this.getById(id);
    if (dto.roomNumber && dto.roomNumber !== existing.roomNumber) {
      const duplicate = await this.repo.findByRoomNumberAndFloor(dto.roomNumber, existing.floorId);
      if (duplicate) {
        throw AppError.conflict(`Room '${dto.roomNumber}' already exists on this floor`);
      }
    }
    if (this.db && dto.departmentId) {
      const dept = await this.db.department.findUnique({ where: { id: dto.departmentId } });
      if (!dept) throw AppError.notFound('Department');
    }
    const updated = await this.repo.update(id, dto);
    log.info(`Room updated: ${id}`);
    return updated;
  }

  async updateOccupancy(id: string, dto: UpdateOccupancyDto, actorId?: string) {
    const existing = await this.getById(id);
    const statusMap: Record<string, RoomOccupancyStatus> = {
      AVAILABLE: RoomOccupancyStatus.AVAILABLE,
      OCCUPIED: RoomOccupancyStatus.OCCUPIED,
      RESERVED: RoomOccupancyStatus.RESERVED,
      UNDER_MAINTENANCE: RoomOccupancyStatus.UNDER_MAINTENANCE,
    };

    const newStatus = statusMap[dto.occupancyStatus];
    if (!newStatus) throw AppError.badRequest(`Invalid occupancy status: ${dto.occupancyStatus}`);

    const updated = await this.repo.updateOccupancy(id, newStatus);
    void this.audit.logOccupancyChange({
      actorId,
      roomId: updated.id,
      roomNumber: updated.roomNumber,
      floorId: updated.floorId,
      previousStatus: existing.occupancyStatus,
      newStatus,
      source: dto.source,
      sensorId: dto.sensorId,
      reason: dto.reason,
    });
    dashboardEvents.emit('room.occupancy.changed', {
      timestamp: new Date().toISOString(),
      entityId: id,
      metadata: { occupancyStatus: newStatus, source: dto.source },
    });
    log.info(`Room occupancy updated: ${id} -> ${newStatus}`);
    return updated;
  }

  async simulateOccupancyEvents() {
    const rooms = await this.repo.findAll({ page: 1, limit: 50, sortOrder: 'asc' });
    const statuses: RoomOccupancyStatus[] = [
      RoomOccupancyStatus.AVAILABLE,
      RoomOccupancyStatus.OCCUPIED,
      RoomOccupancyStatus.RESERVED,
    ];

    const updates = await Promise.all(
      rooms.data.map(async (room) => {
        const randomStatus = statuses[Math.floor(Math.random() * statuses.length)];
        await this.repo.updateOccupancy(room.id, randomStatus!);
        return { roomId: room.id, roomNumber: room.roomNumber, newStatus: randomStatus };
      }),
    );

    log.warn('[SIMULATED EVENT - DEV ONLY] Occupancy simulation run completed', {
      updatedRooms: updates.length,
    });

    return { simulated: true, message: '[SIMULATED] Occupancy events applied — DEV ONLY', updatedRooms: updates };
  }

  async delete(id: string) {
    await this.getById(id);
    const archived = await this.repo.archive(id);
    log.info(`Room archived: ${id}`);
    return archived;
  }

  async getOccupancySummary() {
    return this.repo.getOccupancySummary();
  }
}
