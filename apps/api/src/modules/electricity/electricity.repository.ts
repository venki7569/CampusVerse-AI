import { PrismaClient, ElectricityMeter, ElectricityReading, Prisma } from '@prisma/client';
import type { CreateElectricityMeterDto, UpdateElectricityMeterDto, ListElectricityMetersQuery, ListElectricityReadingsQuery } from './electricity.dto';
import { getPrismaSkip, buildOrderBy } from '../../utils/pagination';

export class ElectricityRepository {
  constructor(private readonly db: PrismaClient) {}

  async findAllMeters(query: ListElectricityMetersQuery): Promise<{
    data: ElectricityMeter[];
    total: number;
    page: number;
    limit: number;
  }> {
    const { page, limit, sortBy, sortOrder, search, buildingId, departmentId, isActive } = query;
    const skip = getPrismaSkip(page, limit);
    const orderBy = buildOrderBy(sortBy, sortOrder);

    const where: Prisma.ElectricityMeterWhereInput = {
      ...(buildingId ? { buildingId } : {}),
      ...(departmentId ? { departmentId } : {}),
      ...(isActive !== undefined ? { isActive } : {}),
      ...(search
        ? {
            serialNumber: { contains: search, mode: 'insensitive' },
          }
        : {}),
    };

    const [data, total] = await Promise.all([
      this.db.electricityMeter.findMany({
        where,
        skip,
        take: limit,
        orderBy,
        include: {
          building: { select: { id: true, name: true, code: true } },
          department: { select: { id: true, name: true, code: true } },
          _count: { select: { readings: true } },
        },
      }),
      this.db.electricityMeter.count({ where }),
    ]);

    return { data, total, page, limit };
  }

  async findMeterById(id: string) {
    return this.db.electricityMeter.findUnique({
      where: { id },
      include: {
        building: true,
        department: true,
      },
    });
  }

  async findMeterBySerialNumber(serialNumber: string): Promise<ElectricityMeter | null> {
    return this.db.electricityMeter.findUnique({ where: { serialNumber } });
  }

  async createMeter(dto: CreateElectricityMeterDto): Promise<ElectricityMeter> {
    return this.db.electricityMeter.create({
      data: {
        serialNumber: dto.serialNumber,
        buildingId: dto.buildingId,
        departmentId: dto.departmentId,
        isActive: dto.isActive,
      },
    });
  }

  async updateMeter(id: string, dto: UpdateElectricityMeterDto): Promise<ElectricityMeter> {
    return this.db.electricityMeter.update({
      where: { id },
      data: {
        ...(dto.serialNumber !== undefined ? { serialNumber: dto.serialNumber } : {}),
        ...(dto.buildingId !== undefined ? { buildingId: dto.buildingId } : {}),
        ...(dto.departmentId !== undefined ? { departmentId: dto.departmentId } : {}),
        ...(dto.isActive !== undefined ? { isActive: dto.isActive } : {}),
      },
    });
  }

  async archiveMeter(id: string): Promise<ElectricityMeter> {
    return this.db.electricityMeter.update({
      where: { id },
      data: { isActive: false },
    });
  }

  async findReadings(meterId: string, query: ListElectricityReadingsQuery): Promise<{
    data: ElectricityReading[];
    total: number;
    page: number;
    limit: number;
  }> {
    const { page, limit, from, to } = query;
    const skip = getPrismaSkip(page, limit);

    const where: Prisma.ElectricityReadingWhereInput = {
      meterId,
      ...(from || to
        ? {
            readingTime: {
              ...(from ? { gte: from } : {}),
              ...(to ? { lte: to } : {}),
            },
          }
        : {}),
    };

    const [data, total] = await Promise.all([
      this.db.electricityReading.findMany({
        where,
        skip,
        take: limit,
        orderBy: { readingTime: 'desc' },
      }),
      this.db.electricityReading.count({ where }),
    ]);

    return { data, total, page, limit };
  }

  async findLatestReading(meterId: string): Promise<ElectricityReading | null> {
    return this.db.electricityReading.findFirst({
      where: { meterId },
      orderBy: { readingTime: 'desc' },
    });
  }

  async createReading(meterId: string, kwhConsumption: number, readingTime: Date): Promise<ElectricityReading> {
    return this.db.electricityReading.create({
      data: {
        meterId,
        kwhConsumption,
        readingTime,
      },
    });
  }

  async getReadingsBetweenDates(filters: {
    from?: Date;
    to?: Date;
    buildingId?: string;
    departmentId?: string;
    meterId?: string;
  }) {
    const { from, to, buildingId, departmentId, meterId } = filters;
    const where: Prisma.ElectricityReadingWhereInput = {
      ...(meterId ? { meterId } : {}),
      ...(buildingId ? { meter: { buildingId } } : {}),
      ...(departmentId ? { meter: { departmentId } } : {}),
      ...(from || to
        ? {
            readingTime: {
              ...(from ? { gte: from } : {}),
              ...(to ? { lte: to } : {}),
            },
          }
        : {}),
    };

    return this.db.electricityReading.findMany({
      where,
      orderBy: { readingTime: 'asc' },
      include: {
        meter: {
          include: {
            building: { select: { id: true, name: true, code: true } },
            department: { select: { id: true, name: true, code: true } },
          },
        },
      },
    });
  }
}
