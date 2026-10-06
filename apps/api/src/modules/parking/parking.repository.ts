import { Prisma, PrismaClient } from '@prisma/client';
import { getPrismaSkip, buildOrderBy } from '../../utils/pagination';
import type {
  CreateParkingAreaDto,
  CreateParkingSlotDto,
  ListParkingAreasQuery,
  ListParkingSlotsQuery,
  ParkingAvailabilityQuery,
  UpdateParkingAreaDto,
  UpdateParkingSlotDto,
} from './parking.dto';

const areaInclude = {
  building: { select: { id: true, code: true, name: true } },
  _count: { select: { slots: true } },
} as const;

const slotInclude = {
  area: {
    select: {
      id: true,
      name: true,
      location: true,
      buildingId: true,
      isActive: true,
      building: { select: { id: true, code: true, name: true } },
    },
  },
} as const;

export class ParkingRepository {
  constructor(private readonly db: PrismaClient) {}

  async findAreas(query: ListParkingAreasQuery) {
    const { page, limit, sortBy, sortOrder, search, buildingId, isActive } = query;
    const skip = getPrismaSkip(page, limit);
    const allowed = new Set(['createdAt', 'name', 'totalSlots', 'isActive']);
    const orderBy = buildOrderBy(sortBy && allowed.has(sortBy) ? sortBy : 'name', sortOrder ?? 'asc');

    const where: Prisma.ParkingAreaWhereInput = {};
    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { location: { contains: search, mode: 'insensitive' } },
      ];
    }
    if (buildingId) where.buildingId = buildingId;
    if (typeof isActive === 'boolean') where.isActive = isActive;

    const [data, total] = await Promise.all([
      this.db.parkingArea.findMany({ where, skip, take: limit, orderBy, include: areaInclude }),
      this.db.parkingArea.count({ where }),
    ]);

    return { data, total, page, limit };
  }

  async findAreaById(id: string) {
    return this.db.parkingArea.findUnique({
      where: { id },
      include: {
        ...areaInclude,
        slots: { orderBy: { slotNumber: 'asc' }, take: 200 },
      },
    });
  }

  async findAreaByName(name: string) {
    return this.db.parkingArea.findFirst({
      where: { name: { equals: name, mode: 'insensitive' } },
    });
  }

  async createArea(dto: CreateParkingAreaDto) {
    return this.db.parkingArea.create({
      data: {
        name: dto.name,
        location: dto.location ?? null,
        buildingId: dto.buildingId ?? null,
        isActive: dto.isActive ?? true,
        totalSlots: 0,
      },
      include: areaInclude,
    });
  }

  async updateArea(id: string, dto: UpdateParkingAreaDto) {
    return this.db.parkingArea.update({
      where: { id },
      data: {
        name: dto.name,
        location: dto.location,
        buildingId: dto.buildingId,
        isActive: dto.isActive,
      },
      include: areaInclude,
    });
  }

  async archiveArea(id: string) {
    return this.db.parkingArea.update({
      where: { id },
      data: { isActive: false },
      include: areaInclude,
    });
  }

  async deleteArea(id: string) {
    return this.db.parkingArea.delete({ where: { id } });
  }

  async countActiveAllocationsInArea(areaId: string): Promise<number> {
    return this.db.parkingSlot.count({
      where: {
        areaId,
        OR: [{ status: { in: ['OCCUPIED', 'RESERVED'] } }, { reservedForId: { not: null } }],
      },
    });
  }

  async recountAreaSlots(areaId: string): Promise<number> {
    const total = await this.db.parkingSlot.count({ where: { areaId } });
    await this.db.parkingArea.update({ where: { id: areaId }, data: { totalSlots: total } });
    return total;
  }

  async groupSlotStatuses(areaId?: string, buildingId?: string) {
    const where: Prisma.ParkingSlotWhereInput = {};
    if (areaId) where.areaId = areaId;
    if (buildingId) where.area = { buildingId };
    return this.db.parkingSlot.groupBy({
      by: ['areaId', 'status'],
      where,
      _count: { _all: true },
    });
  }

  async findSlots(query: ListParkingSlotsQuery) {
    const { page, limit, sortBy, sortOrder, search, areaId, buildingId, status, slotType, reservedForId } =
      query;
    const skip = getPrismaSkip(page, limit);
    const allowed = new Set(['createdAt', 'slotNumber', 'status', 'slotType']);
    const orderBy = buildOrderBy(
      sortBy && allowed.has(sortBy) ? sortBy : 'slotNumber',
      sortOrder ?? 'asc',
    );

    const where: Prisma.ParkingSlotWhereInput = {};
    if (areaId) where.areaId = areaId;
    if (buildingId) where.area = { buildingId };
    if (status) where.status = status;
    if (slotType) where.slotType = slotType;
    if (reservedForId) where.reservedForId = reservedForId;
    if (search) {
      where.OR = [
        { slotNumber: { contains: search, mode: 'insensitive' } },
        { slotType: { contains: search, mode: 'insensitive' } },
        { status: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [data, total] = await Promise.all([
      this.db.parkingSlot.findMany({ where, skip, take: limit, orderBy, include: slotInclude }),
      this.db.parkingSlot.count({ where }),
    ]);

    return { data, total, page, limit };
  }

  async findSlotById(id: string) {
    return this.db.parkingSlot.findUnique({ where: { id }, include: slotInclude });
  }

  async findSlotByAreaAndNumber(areaId: string, slotNumber: string) {
    return this.db.parkingSlot.findUnique({
      where: { areaId_slotNumber: { areaId, slotNumber } },
    });
  }

  async createSlot(dto: CreateParkingSlotDto) {
    const created = await this.db.parkingSlot.create({
      data: {
        areaId: dto.areaId,
        slotNumber: dto.slotNumber,
        slotType: dto.slotType ?? 'STANDARD',
        status: dto.status ?? 'AVAILABLE',
      },
      include: slotInclude,
    });
    await this.recountAreaSlots(dto.areaId);
    return created;
  }

  async updateSlot(id: string, dto: UpdateParkingSlotDto) {
    return this.db.parkingSlot.update({
      where: { id },
      data: {
        slotNumber: dto.slotNumber,
        slotType: dto.slotType,
        status: dto.status,
      },
      include: slotInclude,
    });
  }

  /**
   * Conditional update to reduce double-allocation races:
   * only succeeds when slot is AVAILABLE and not reserved.
   */
  async allocateSlotIfAvailable(id: string, userId: string, status: 'OCCUPIED' | 'RESERVED') {
    const result = await this.db.parkingSlot.updateMany({
      where: { id, status: 'AVAILABLE', reservedForId: null },
      data: { reservedForId: userId, status },
    });
    if (result.count === 0) return null;
    return this.findSlotById(id);
  }

  async releaseSlot(id: string) {
    return this.db.parkingSlot.update({
      where: { id },
      data: { reservedForId: null, status: 'AVAILABLE' },
      include: slotInclude,
    });
  }

  async deleteSlot(id: string, areaId: string) {
    const deleted = await this.db.parkingSlot.delete({ where: { id } });
    await this.recountAreaSlots(areaId);
    return deleted;
  }

  async findActiveAllocationForUser(userId: string, excludeSlotId?: string) {
    return this.db.parkingSlot.findFirst({
      where: {
        reservedForId: userId,
        status: { in: ['OCCUPIED', 'RESERVED'] },
        ...(excludeSlotId ? { id: { not: excludeSlotId } } : {}),
      },
    });
  }

  async findUserById(id: string) {
    return this.db.user.findUnique({
      where: { id },
      select: { id: true, email: true, firstName: true, lastName: true, isActive: true },
    });
  }

  async findUsersByIds(ids: string[]) {
    if (ids.length === 0) return [];
    return this.db.user.findMany({
      where: { id: { in: ids } },
      select: { id: true, email: true, firstName: true, lastName: true },
    });
  }

  async findBuildingById(id: string) {
    return this.db.building.findUnique({
      where: { id },
      select: { id: true, code: true, name: true, operationalStatus: true },
    });
  }

  async countAreas(query: ParkingAvailabilityQuery = {}) {
    const where: Prisma.ParkingAreaWhereInput = {};
    if (query.buildingId) where.buildingId = query.buildingId;
    if (query.areaId) where.id = query.areaId;
    return this.db.parkingArea.count({ where });
  }

  async countActiveAreas(query: ParkingAvailabilityQuery = {}) {
    const where: Prisma.ParkingAreaWhereInput = { isActive: true };
    if (query.buildingId) where.buildingId = query.buildingId;
    if (query.areaId) where.id = query.areaId;
    return this.db.parkingArea.count({ where });
  }

  async listAreasForSummary(query: ParkingAvailabilityQuery = {}) {
    const where: Prisma.ParkingAreaWhereInput = {};
    if (query.buildingId) where.buildingId = query.buildingId;
    if (query.areaId) where.id = query.areaId;
    return this.db.parkingArea.findMany({
      where,
      select: { id: true, name: true, isActive: true },
      orderBy: { name: 'asc' },
    });
  }
}
