import { PrismaClient, Room, RoomOccupancyStatus, OperationalStatus, Prisma } from '@prisma/client';
import type { CreateRoomDto, UpdateRoomDto, ListRoomsQuery } from './room.dto';
import { getPrismaSkip, buildOrderBy } from '../../utils/pagination';

export class RoomRepository {
  constructor(private readonly db: PrismaClient) {}

  async findAll(query: ListRoomsQuery) {
    const { page, limit, sortBy, sortOrder, search, floorId, buildingId, departmentId, roomType, occupancyStatus, operationalStatus } = query;
    const skip = getPrismaSkip(page, limit);
    const orderBy = buildOrderBy(sortBy, sortOrder);

    const where: Prisma.RoomWhereInput = {
      ...(floorId ? { floorId } : {}),
      ...(departmentId ? { departmentId } : {}),
      ...(roomType ? { roomType } : {}),
      ...(occupancyStatus ? { occupancyStatus } : {}),
      ...(operationalStatus ? { operationalStatus } : {}),
      ...(buildingId ? { floor: { buildingId } } : {}),
      ...(search ? {
        OR: [
          { roomNumber: { contains: search, mode: 'insensitive' as const } },
          { roomType: { contains: search, mode: 'insensitive' as const } },
        ],
      } : {}),
    };

    const [data, total] = await Promise.all([
      this.db.room.findMany({
        where,
        skip,
        take: limit,
        orderBy,
        include: {
          floor: { include: { building: { select: { id: true, name: true, code: true } } } },
          department: { select: { id: true, name: true, code: true } },
        },
      }),
      this.db.room.count({ where }),
    ]);

    return { data, total, page, limit };
  }

  async findById(id: string) {
    return this.db.room.findUnique({
      where: { id },
      include: {
        floor: { include: { building: true } },
        department: true,
        assets: { select: { id: true, assetTag: true, name: true, operationalStatus: true } },
        roomAllocations: { orderBy: { startTime: 'desc' }, take: 5 },
      },
    });
  }

  async findByRoomNumberAndFloor(roomNumber: string, floorId: string): Promise<Room | null> {
    return this.db.room.findFirst({ where: { roomNumber, floorId } });
  }

  async create(dto: CreateRoomDto): Promise<Room> {
    return this.db.room.create({ data: dto });
  }

  async update(id: string, dto: UpdateRoomDto): Promise<Room> {
    return this.db.room.update({ where: { id }, data: dto });
  }

  async updateOccupancy(id: string, status: RoomOccupancyStatus): Promise<Room> {
    return this.db.room.update({ where: { id }, data: { occupancyStatus: status } });
  }

  async delete(id: string): Promise<Room> {
    return this.db.room.delete({ where: { id } });
  }

  async archive(id: string): Promise<Room> {
    return this.db.room.update({ where: { id }, data: { operationalStatus: OperationalStatus.RETIRED } });
  }

  async getOccupancySummary() {
    return this.db.room.groupBy({
      by: ['occupancyStatus', 'roomType'],
      _count: { _all: true },
    });
  }
}
