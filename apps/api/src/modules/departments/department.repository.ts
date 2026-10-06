import { PrismaClient, Department, Prisma } from '@prisma/client';
import type { CreateDepartmentDto, UpdateDepartmentDto } from './department.dto';
import type { PaginationQuery } from '../../types';
import { getPrismaSkip, buildOrderBy } from '../../utils/pagination';

export class DepartmentRepository {
  constructor(private readonly db: PrismaClient) {}

  async findAll(query: PaginationQuery): Promise<{
    data: (Department & { _count: { rooms: number; assets: number } })[];
    total: number;
    page: number;
    limit: number;
  }> {
    const { page, limit, sortBy, sortOrder, search } = query;
    const skip = getPrismaSkip(page, limit);
    const orderBy = buildOrderBy(sortBy, sortOrder);

    const where: Prisma.DepartmentWhereInput = search
      ? {
          OR: [
            { name: { contains: search, mode: 'insensitive' } },
            { code: { contains: search, mode: 'insensitive' } },
            { headName: { contains: search, mode: 'insensitive' } },
          ],
        }
      : {};

    const [data, total] = await Promise.all([
      this.db.department.findMany({
        where,
        skip,
        take: limit,
        orderBy,
        include: {
          _count: {
            select: { rooms: true, assets: true },
          },
        },
      }),
      this.db.department.count({ where }),
    ]);

    return { data, total, page, limit };
  }

  async findById(id: string) {
    return this.db.department.findUnique({
      where: { id },
      include: {
        rooms: { select: { id: true, roomNumber: true, roomType: true, capacity: true } },
        _count: { select: { rooms: true, assets: true } },
      },
    });
  }

  async findByCode(code: string): Promise<Department | null> {
    return this.db.department.findUnique({ where: { code } });
  }

  async create(dto: CreateDepartmentDto): Promise<Department> {
    return this.db.department.create({ data: dto });
  }

  async update(id: string, dto: UpdateDepartmentDto): Promise<Department> {
    return this.db.department.update({ where: { id }, data: dto });
  }

  async delete(id: string): Promise<Department> {
    return this.db.department.delete({ where: { id } });
  }
}
