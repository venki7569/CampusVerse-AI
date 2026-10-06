import { AppError } from '../../utils/AppError';
import { buildPaginationMeta } from '../../utils/pagination';
import { createLogger } from '../../utils/logger';
import type { ParkingRepository } from './parking.repository';
import type { ParkingAuditService } from './parking.audit.service';
import { parkingEvents } from './parking.events';
import type {
  AllocateParkingSlotDto,
  CreateParkingAreaDto,
  CreateParkingSlotDto,
  ListParkingAreasQuery,
  ListParkingSlotsQuery,
  ParkingAreaDto,
  ParkingAvailabilityQuery,
  ParkingAvailabilitySummary,
  ParkingSlotDto,
  ParkingSlotStatus,
  UpdateParkingAreaDto,
  UpdateParkingSlotDto,
} from './parking.dto';

const log = createLogger('ParkingService');

function utilizationPercent(occupied: number, reserved: number, total: number): number | null {
  if (total <= 0) return null;
  return Math.round(((occupied + reserved) / total) * 1000) / 10;
}

function emptySlotCounts() {
  return { total: 0, available: 0, occupied: 0, reserved: 0, underMaintenance: 0 };
}

export class ParkingService {
  constructor(
    private readonly repo: ParkingRepository,
    private readonly audit: ParkingAuditService,
  ) {}

  private toAreaDto(
    area: {
      id: string;
      name: string;
      location: string | null;
      buildingId: string | null;
      totalSlots: number;
      isActive: boolean;
      createdAt: Date;
      updatedAt: Date;
      building?: { id: string; code: string; name: string } | null;
      _count?: { slots: number };
    },
    slotCounts?: ParkingAreaDto['slotCounts'],
  ): ParkingAreaDto {
    return {
      id: area.id,
      name: area.name,
      location: area.location,
      buildingId: area.buildingId,
      totalSlots: area.totalSlots,
      isActive: area.isActive,
      createdAt: area.createdAt.toISOString(),
      updatedAt: area.updatedAt.toISOString(),
      building: area.building ?? null,
      slotCounts,
      _count: area._count,
    };
  }

  private toSlotDto(
    slot: {
      id: string;
      areaId: string;
      slotNumber: string;
      slotType: string;
      status: string;
      reservedForId: string | null;
      createdAt: Date;
      updatedAt: Date;
      area?: ParkingSlotDto['area'];
    },
    reservedFor?: ParkingSlotDto['reservedFor'],
  ): ParkingSlotDto {
    return {
      id: slot.id,
      areaId: slot.areaId,
      slotNumber: slot.slotNumber,
      slotType: slot.slotType,
      status: slot.status,
      reservedForId: slot.reservedForId,
      createdAt: slot.createdAt.toISOString(),
      updatedAt: slot.updatedAt.toISOString(),
      area: slot.area,
      reservedFor: reservedFor ?? null,
    };
  }

  private async assertBuilding(buildingId: string | null | undefined): Promise<void> {
    if (!buildingId) return;
    const building = await this.repo.findBuildingById(buildingId);
    if (!building) throw AppError.badRequest('Invalid building');
    if (building.operationalStatus === 'RETIRED') {
      throw AppError.badRequest('Cannot associate parking with a RETIRED building');
    }
  }

  private async slotCountsForAreas(areaIds: string[]): Promise<Map<string, ParkingAreaDto['slotCounts']>> {
    const map = new Map<string, NonNullable<ParkingAreaDto['slotCounts']>>();
    for (const id of areaIds) map.set(id, emptySlotCounts());
    if (areaIds.length === 0) return map;

    const groups = await this.repo.groupSlotStatuses();
    for (const row of groups) {
      if (!areaIds.includes(row.areaId)) continue;
      const counts = map.get(row.areaId) ?? emptySlotCounts();
      counts.total += row._count._all;
      if (row.status === 'AVAILABLE') counts.available += row._count._all;
      if (row.status === 'OCCUPIED') counts.occupied += row._count._all;
      if (row.status === 'RESERVED') counts.reserved += row._count._all;
      if (row.status === 'UNDER_MAINTENANCE') counts.underMaintenance += row._count._all;
      map.set(row.areaId, counts);
    }
    return map;
  }

  private async attachReservedUsers(
    slots: Array<{ reservedForId: string | null } & Parameters<ParkingService['toSlotDto']>[0]>,
  ): Promise<ParkingSlotDto[]> {
    const ids = [
      ...new Set(slots.map((s) => s.reservedForId).filter((id): id is string => Boolean(id))),
    ];
    const users = await this.repo.findUsersByIds(ids);
    const byId = new Map(users.map((u) => [u.id, u]));
    return slots.map((slot) =>
      this.toSlotDto(slot, slot.reservedForId ? byId.get(slot.reservedForId) ?? null : null),
    );
  }

  async listAreas(query: ListParkingAreasQuery) {
    const result = await this.repo.findAreas(query);
    const counts = await this.slotCountsForAreas(result.data.map((a) => a.id));
    return {
      data: result.data.map((area) => this.toAreaDto(area, counts.get(area.id))),
      meta: { pagination: buildPaginationMeta(result.total, result.page, result.limit) },
    };
  }

  async getArea(id: string): Promise<ParkingAreaDto> {
    const area = await this.repo.findAreaById(id);
    if (!area) throw AppError.notFound('Parking area');
    const counts = await this.slotCountsForAreas([id]);
    return this.toAreaDto(area, counts.get(id));
  }

  async createArea(dto: CreateParkingAreaDto, actorId?: string): Promise<ParkingAreaDto> {
    const existing = await this.repo.findAreaByName(dto.name);
    if (existing) throw AppError.conflict(`Parking area "${dto.name}" already exists`);
    await this.assertBuilding(dto.buildingId);

    const created = await this.repo.createArea(dto);
    log.info(`Parking area created: ${created.id}`);

    await this.audit.logEvent({
      actorId,
      action: 'createParkingArea',
      entityName: 'ParkingArea',
      entityId: created.id,
      metadata: { name: created.name, buildingId: created.buildingId },
    });

    parkingEvents.emit('parking.area.created', {
      timestamp: new Date().toISOString(),
      areaId: created.id,
      actorId,
      metadata: { name: created.name },
    });

    return this.toAreaDto(created, emptySlotCounts());
  }

  async updateArea(id: string, dto: UpdateParkingAreaDto, actorId?: string): Promise<ParkingAreaDto> {
    const existing = await this.repo.findAreaById(id);
    if (!existing) throw AppError.notFound('Parking area');

    if (dto.name && dto.name.toLowerCase() !== existing.name.toLowerCase()) {
      const duplicate = await this.repo.findAreaByName(dto.name);
      if (duplicate && duplicate.id !== id) {
        throw AppError.conflict(`Parking area "${dto.name}" already exists`);
      }
    }
    if (dto.buildingId !== undefined) await this.assertBuilding(dto.buildingId);

    if (dto.isActive === false) {
      const activeAllocations = await this.repo.countActiveAllocationsInArea(id);
      if (activeAllocations > 0) {
        throw AppError.conflict('Cannot deactivate a parking area with active allocations');
      }
    }

    const updated = await this.repo.updateArea(id, dto);
    const counts = await this.slotCountsForAreas([id]);

    await this.audit.logEvent({
      actorId,
      action: dto.isActive === false ? 'archiveParkingArea' : 'updateParkingArea',
      entityName: 'ParkingArea',
      entityId: id,
      metadata: { changes: dto },
    });

    parkingEvents.emit(dto.isActive === false ? 'parking.area.archived' : 'parking.area.updated', {
      timestamp: new Date().toISOString(),
      areaId: id,
      actorId,
    });

    return this.toAreaDto(updated, counts.get(id));
  }

  async archiveArea(id: string, actorId?: string): Promise<ParkingAreaDto> {
    return this.updateArea(id, { isActive: false }, actorId);
  }

  async deleteArea(id: string, actorId?: string): Promise<void> {
    const existing = await this.repo.findAreaById(id);
    if (!existing) throw AppError.notFound('Parking area');

    const activeAllocations = await this.repo.countActiveAllocationsInArea(id);
    if (activeAllocations > 0) {
      throw AppError.conflict('Cannot delete a parking area with active allocations');
    }
    if (existing._count.slots > 0) {
      throw AppError.conflict('Cannot delete a parking area that still has slots. Archive it instead.');
    }

    await this.repo.deleteArea(id);
    await this.audit.logEvent({
      actorId,
      action: 'deleteParkingArea',
      entityName: 'ParkingArea',
      entityId: id,
      metadata: { name: existing.name },
    });
    parkingEvents.emit('parking.area.archived', {
      timestamp: new Date().toISOString(),
      areaId: id,
      actorId,
      metadata: { deleted: true },
    });
  }

  async listSlots(query: ListParkingSlotsQuery) {
    const result = await this.repo.findSlots(query);
    const data = await this.attachReservedUsers(result.data);
    return {
      data,
      meta: { pagination: buildPaginationMeta(result.total, result.page, result.limit) },
    };
  }

  async getSlot(id: string): Promise<ParkingSlotDto> {
    const slot = await this.repo.findSlotById(id);
    if (!slot) throw AppError.notFound('Parking slot');
    const [dto] = await this.attachReservedUsers([slot]);
    return dto!;
  }

  async createSlot(dto: CreateParkingSlotDto, actorId?: string): Promise<ParkingSlotDto> {
    const area = await this.repo.findAreaById(dto.areaId);
    if (!area) throw AppError.badRequest('Parking area does not exist');
    if (!area.isActive) throw AppError.badRequest('Cannot add slots to an inactive parking area');

    const duplicate = await this.repo.findSlotByAreaAndNumber(dto.areaId, dto.slotNumber);
    if (duplicate) {
      throw AppError.conflict(`Slot "${dto.slotNumber}" already exists in this parking area`);
    }

    if (dto.status && dto.status !== 'AVAILABLE' && dto.status !== 'UNDER_MAINTENANCE') {
      throw AppError.badRequest('New slots must start as AVAILABLE or UNDER_MAINTENANCE');
    }

    const created = await this.repo.createSlot(dto);
    log.info(`Parking slot created: ${created.id}`);

    await this.audit.logEvent({
      actorId,
      action: 'createParkingSlot',
      entityName: 'ParkingSlot',
      entityId: created.id,
      metadata: { areaId: created.areaId, slotNumber: created.slotNumber },
    });

    parkingEvents.emit('parking.slot.created', {
      timestamp: new Date().toISOString(),
      areaId: created.areaId,
      slotId: created.id,
      actorId,
    });

    return this.toSlotDto(created);
  }

  private assertValidStatusTransition(
    current: string,
    next: ParkingSlotStatus,
    reservedForId: string | null,
  ): void {
    if (current === next) return;
    if (reservedForId && (next === 'AVAILABLE' || next === 'UNDER_MAINTENANCE')) {
      throw AppError.badRequest('Release the allocation before changing status to AVAILABLE or UNDER_MAINTENANCE');
    }
    if ((next === 'OCCUPIED' || next === 'RESERVED') && !reservedForId) {
      throw AppError.badRequest('Use allocate endpoint to mark a slot as OCCUPIED or RESERVED');
    }
  }

  async updateSlot(id: string, dto: UpdateParkingSlotDto, actorId?: string): Promise<ParkingSlotDto> {
    const existing = await this.repo.findSlotById(id);
    if (!existing) throw AppError.notFound('Parking slot');

    if (dto.slotNumber && dto.slotNumber !== existing.slotNumber) {
      const duplicate = await this.repo.findSlotByAreaAndNumber(existing.areaId, dto.slotNumber);
      if (duplicate && duplicate.id !== id) {
        throw AppError.conflict(`Slot "${dto.slotNumber}" already exists in this parking area`);
      }
    }

    if (dto.status) {
      this.assertValidStatusTransition(existing.status, dto.status, existing.reservedForId);
    }

    const updated = await this.repo.updateSlot(id, dto);
    await this.audit.logEvent({
      actorId,
      action: 'updateParkingSlot',
      entityName: 'ParkingSlot',
      entityId: id,
      metadata: { changes: dto },
    });
    parkingEvents.emit('parking.slot.updated', {
      timestamp: new Date().toISOString(),
      areaId: updated.areaId,
      slotId: updated.id,
      actorId,
    });

    const [dtoOut] = await this.attachReservedUsers([updated]);
    return dtoOut!;
  }

  async archiveSlot(id: string, actorId?: string): Promise<ParkingSlotDto> {
    const existing = await this.repo.findSlotById(id);
    if (!existing) throw AppError.notFound('Parking slot');
    if (existing.reservedForId || existing.status === 'OCCUPIED' || existing.status === 'RESERVED') {
      throw AppError.conflict('Cannot archive a slot with an active allocation');
    }

    const updated = await this.repo.updateSlot(id, { status: 'UNDER_MAINTENANCE' });
    await this.audit.logEvent({
      actorId,
      action: 'archiveParkingSlot',
      entityName: 'ParkingSlot',
      entityId: id,
    });
    parkingEvents.emit('parking.slot.archived', {
      timestamp: new Date().toISOString(),
      areaId: updated.areaId,
      slotId: updated.id,
      actorId,
    });
    return this.toSlotDto(updated);
  }

  async deleteSlot(id: string, actorId?: string): Promise<void> {
    const existing = await this.repo.findSlotById(id);
    if (!existing) throw AppError.notFound('Parking slot');
    if (existing.reservedForId || existing.status === 'OCCUPIED' || existing.status === 'RESERVED') {
      throw AppError.conflict('Cannot delete a slot with an active allocation');
    }

    await this.repo.deleteSlot(id, existing.areaId);
    await this.audit.logEvent({
      actorId,
      action: 'deleteParkingSlot',
      entityName: 'ParkingSlot',
      entityId: id,
      metadata: { areaId: existing.areaId, slotNumber: existing.slotNumber },
    });
    parkingEvents.emit('parking.slot.archived', {
      timestamp: new Date().toISOString(),
      areaId: existing.areaId,
      slotId: id,
      actorId,
      metadata: { deleted: true },
    });
  }

  async allocateSlot(
    id: string,
    dto: AllocateParkingSlotDto,
    actorId?: string,
  ): Promise<ParkingSlotDto> {
    const existing = await this.repo.findSlotById(id);
    if (!existing) throw AppError.notFound('Parking slot');
    if (!existing.area?.isActive) {
      throw AppError.badRequest('Cannot allocate a slot in an inactive parking area');
    }
    if (existing.status === 'UNDER_MAINTENANCE') {
      throw AppError.badRequest('Cannot allocate a slot that is under maintenance');
    }
    if (existing.status !== 'AVAILABLE' || existing.reservedForId) {
      throw AppError.conflict('Slot is not available for allocation');
    }

    const user = await this.repo.findUserById(dto.userId);
    if (!user) throw AppError.badRequest('Invalid user for allocation');
    if (!user.isActive) throw AppError.badRequest('Cannot allocate parking to an inactive user');

    const conflict = await this.repo.findActiveAllocationForUser(dto.userId, id);
    if (conflict) {
      throw AppError.conflict('User already has an active parking allocation');
    }

    const status = dto.status ?? 'OCCUPIED';
    const allocated = await this.repo.allocateSlotIfAvailable(id, dto.userId, status);
    if (!allocated) {
      throw AppError.conflict('Slot is no longer available for allocation');
    }

    await this.audit.logEvent({
      actorId,
      action: 'allocateParkingSlot',
      entityName: 'ParkingSlot',
      entityId: id,
      metadata: { userId: dto.userId, status },
    });

    parkingEvents.emit('parking.slot.allocated', {
      timestamp: new Date().toISOString(),
      areaId: allocated.areaId,
      slotId: allocated.id,
      actorId,
      metadata: { userId: dto.userId, status },
    });

    await this.audit.notifyUser({
      userId: dto.userId,
      title: 'Parking allocated',
      message: `Slot ${allocated.slotNumber} in ${allocated.area?.name ?? 'parking area'} has been allocated to you.`,
      severity: 'INFO',
      link: '/parking',
      metadata: { slotId: allocated.id, areaId: allocated.areaId },
    });

    return this.toSlotDto(allocated, {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
    });
  }

  async releaseSlot(id: string, actorId?: string): Promise<ParkingSlotDto> {
    const existing = await this.repo.findSlotById(id);
    if (!existing) throw AppError.notFound('Parking slot');
    if (!existing.reservedForId && existing.status === 'AVAILABLE') {
      throw AppError.badRequest('Slot has no active allocation to release');
    }

    const previousUserId = existing.reservedForId;
    const released = await this.repo.releaseSlot(id);

    await this.audit.logEvent({
      actorId,
      action: 'releaseParkingSlot',
      entityName: 'ParkingSlot',
      entityId: id,
      metadata: { previousUserId },
    });

    parkingEvents.emit('parking.slot.released', {
      timestamp: new Date().toISOString(),
      areaId: released.areaId,
      slotId: released.id,
      actorId,
      metadata: { previousUserId },
    });

    if (previousUserId) {
      await this.audit.notifyUser({
        userId: previousUserId,
        title: 'Parking allocation released',
        message: `Your allocation for slot ${released.slotNumber} has been released.`,
        severity: 'INFO',
        link: '/parking',
        metadata: { slotId: released.id },
      });
    }

    return this.toSlotDto(released);
  }

  async getAvailability(query: ParkingAvailabilityQuery = {}): Promise<ParkingAvailabilitySummary> {
    const [areas, activeAreas, areaRows, groups] = await Promise.all([
      this.repo.countAreas(query),
      this.repo.countActiveAreas(query),
      this.repo.listAreasForSummary(query),
      this.repo.groupSlotStatuses(query.areaId, query.buildingId),
    ]);

    const byAreaMap = new Map(
      areaRows.map((area) => [
        area.id,
        {
          areaId: area.id,
          name: area.name,
          isActive: area.isActive,
          ...emptySlotCounts(),
          utilizationPercent: null as number | null,
        },
      ]),
    );

    let totalSlots = 0;
    let available = 0;
    let occupied = 0;
    let reserved = 0;
    let underMaintenance = 0;

    for (const row of groups) {
      const entry = byAreaMap.get(row.areaId);
      if (!entry) continue;
      entry.total += row._count._all;
      totalSlots += row._count._all;
      if (row.status === 'AVAILABLE') {
        entry.available += row._count._all;
        available += row._count._all;
      }
      if (row.status === 'OCCUPIED') {
        entry.occupied += row._count._all;
        occupied += row._count._all;
      }
      if (row.status === 'RESERVED') {
        entry.reserved += row._count._all;
        reserved += row._count._all;
      }
      if (row.status === 'UNDER_MAINTENANCE') {
        entry.underMaintenance += row._count._all;
        underMaintenance += row._count._all;
      }
    }

    const byArea = [...byAreaMap.values()].map((entry) => ({
      ...entry,
      utilizationPercent: utilizationPercent(entry.occupied, entry.reserved, entry.total),
    }));

    return {
      areas,
      activeAreas,
      totalSlots,
      available,
      occupied,
      reserved,
      underMaintenance,
      utilizationPercent: utilizationPercent(occupied, reserved, totalSlots),
      byArea,
    };
  }
}
