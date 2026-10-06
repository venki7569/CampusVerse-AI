import { PrismaClient, Building, Prisma } from '@prisma/client';
import type { CreateBuildingDto, UpdateBuildingDto } from './building.dto';
import type { PaginationQuery } from '../../types';
import { getPrismaSkip, buildOrderBy } from '../../utils/pagination';

export class BuildingRepository {
  constructor(private readonly db: PrismaClient) {}

  async findAll(query: PaginationQuery): Promise<{
    data: Building[];
    total: number;
    page: number;
    limit: number;
  }> {
    const { page, limit, sortBy, sortOrder, search } = query;
    const skip = getPrismaSkip(page, limit);
    const orderBy = buildOrderBy(sortBy, sortOrder);

    const where: Prisma.BuildingWhereInput = search
      ? {
          OR: [
            { name: { contains: search, mode: 'insensitive' } },
            { code: { contains: search, mode: 'insensitive' } },
            { location: { contains: search, mode: 'insensitive' } },
          ],
        }
      : {};

    const [data, total] = await Promise.all([
      this.db.building.findMany({
        where,
        skip,
        take: limit,
        orderBy,
        include: { _count: { select: { floors: true, assets: true } } },
      }),
      this.db.building.count({ where }),
    ]);

    return { data, total, page, limit };
  }

  async findById(id: string): Promise<Building | null> {
    return this.db.building.findUnique({
      where: { id },
      include: { floors: { include: { rooms: true } } },
    });
  }

  async findByCode(code: string): Promise<Building | null> {
    return this.db.building.findUnique({ where: { code } });
  }

  async create(dto: CreateBuildingDto): Promise<Building> {
    return this.db.building.create({ data: dto });
  }

  async update(id: string, dto: UpdateBuildingDto): Promise<Building> {
    return this.db.building.update({ where: { id }, data: dto });
  }

  /** Soft-delete: mark as RETIRED rather than destroying the row. */
  async archive(id: string): Promise<Building> {
    return this.db.building.update({
      where: { id },
      data: { operationalStatus: 'RETIRED' },
    });
  }
}
