import { PrismaClient, Floor, Prisma } from '@prisma/client';
import type { CreateFloorDto, UpdateFloorDto } from './floor.dto';
import type { PaginationQuery } from '../../types';
import { getPrismaSkip, buildOrderBy } from '../../utils/pagination';

export interface ListFloorsRepoQuery extends PaginationQuery {
  buildingId?: string;
}

export class FloorRepository {
  constructor(private readonly db: PrismaClient) {}

  async findAll(query: ListFloorsRepoQuery): Promise<{
    data: (Floor & { building: { id: string; name: string; code: string }; _count: { rooms: number } })[];
    total: number;
    page: number;
    limit: number;
  }> {
    const { page, limit, sortBy, sortOrder, search, buildingId } = query;
    const skip = getPrismaSkip(page, limit);
    const orderBy = buildOrderBy(sortBy, sortOrder);

    const where: Prisma.FloorWhereInput = {
      ...(buildingId ? { buildingId } : {}),
      ...(search ? { level: { contains: search, mode: 'insensitive' as const } } : {}),
    };

    const [data, total] = await Promise.all([
      this.db.floor.findMany({
        where,
        skip,
        take: limit,
        orderBy,
        include: {
          building: { select: { id: true, name: true, code: true } },
          _count: { select: { rooms: true } },
        },
      }),
      this.db.floor.count({ where }),
    ]);
    return { data, total, page, limit };
  }

  async findById(id: string) {
    return this.db.floor.findUnique({
      where: { id },
      include: {
        building: true,
        rooms: { select: { id: true, roomNumber: true, roomType: true, occupancyStatus: true, capacity: true } },
      },
    });
  }

  async findByLevelAndBuilding(level: string, buildingId: string): Promise<Floor | null> {
    return this.db.floor.findUnique({ where: { level_buildingId: { level, buildingId } } });
  }

  async create(dto: CreateFloorDto): Promise<Floor> {
    return this.db.floor.create({ data: dto });
  }

  async update(id: string, dto: UpdateFloorDto): Promise<Floor> {
    return this.db.floor.update({ where: { id }, data: dto });
  }

  async delete(id: string): Promise<Floor> {
    return this.db.floor.delete({ where: { id } });
  }
}
