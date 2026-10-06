import { PrismaClient, WaterMeter, WaterReading, Prisma } from '@prisma/client';
import type { CreateWaterMeterDto, UpdateWaterMeterDto, ListWaterMetersQuery, ListWaterReadingsQuery } from './water.dto';
import { getPrismaSkip, buildOrderBy } from '../../utils/pagination';

export class WaterRepository {
  constructor(private readonly db: PrismaClient) {}

  async findAllMeters(query: ListWaterMetersQuery): Promise<{
    data: WaterMeter[];
    total: number;
    page: number;
    limit: number;
  }> {
    const { page, limit, sortBy, sortOrder, search, buildingId, isActive } = query;
    const skip = getPrismaSkip(page, limit);
    const orderBy = buildOrderBy(sortBy, sortOrder);

    const where: Prisma.WaterMeterWhereInput = {
      ...(buildingId ? { buildingId } : {}),
      ...(isActive !== undefined ? { isActive } : {}),
      ...(search
        ? {
            serialNumber: { contains: search, mode: 'insensitive' },
          }
        : {}),
    };

    const [data, total] = await Promise.all([
      this.db.waterMeter.findMany({
        where,
        skip,
        take: limit,
        orderBy,
        include: {
          building: { select: { id: true, name: true, code: true } },
          _count: { select: { readings: true } },
        },
      }),
      this.db.waterMeter.count({ where }),
    ]);

    return { data, total, page, limit };
  }

  async findMeterById(id: string) {
    return this.db.waterMeter.findUnique({
      where: { id },
      include: {
        building: true,
      },
    });
  }

  async findMeterBySerialNumber(serialNumber: string): Promise<WaterMeter | null> {
    return this.db.waterMeter.findUnique({ where: { serialNumber } });
  }

  async createMeter(dto: CreateWaterMeterDto): Promise<WaterMeter> {
    return this.db.waterMeter.create({
      data: {
        serialNumber: dto.serialNumber,
        buildingId: dto.buildingId,
        isActive: dto.isActive,
      },
    });
  }

  async updateMeter(id: string, dto: UpdateWaterMeterDto): Promise<WaterMeter> {
    return this.db.waterMeter.update({
      where: { id },
      data: {
        ...(dto.serialNumber !== undefined ? { serialNumber: dto.serialNumber } : {}),
        ...(dto.buildingId !== undefined ? { buildingId: dto.buildingId } : {}),
        ...(dto.isActive !== undefined ? { isActive: dto.isActive } : {}),
      },
    });
  }

  async archiveMeter(id: string): Promise<WaterMeter> {
    return this.db.waterMeter.update({
      where: { id },
      data: { isActive: false },
    });
  }

  async findReadings(meterId: string, query: ListWaterReadingsQuery): Promise<{
    data: WaterReading[];
    total: number;
    page: number;
    limit: number;
  }> {
    const { page, limit, from, to } = query;
    const skip = getPrismaSkip(page, limit);

    const where: Prisma.WaterReadingWhereInput = {
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
      this.db.waterReading.findMany({
        where,
        skip,
        take: limit,
        orderBy: { readingTime: 'desc' },
      }),
      this.db.waterReading.count({ where }),
    ]);

    return { data, total, page, limit };
  }

  async findLatestReading(meterId: string): Promise<WaterReading | null> {
    return this.db.waterReading.findFirst({
      where: { meterId },
      orderBy: { readingTime: 'desc' },
    });
  }

  async createReading(meterId: string, litersConsumption: number, readingTime: Date): Promise<WaterReading> {
    return this.db.waterReading.create({
      data: {
        meterId,
        litersConsumption,
        readingTime,
      },
    });
  }

  async getReadingsBetweenDates(filters: {
    from?: Date;
    to?: Date;
    buildingId?: string;
    meterId?: string;
  }) {
    const { from, to, buildingId, meterId } = filters;
    const where: Prisma.WaterReadingWhereInput = {
      ...(meterId ? { meterId } : {}),
      ...(buildingId ? { meter: { buildingId } } : {}),
      ...(from || to
        ? {
            readingTime: {
              ...(from ? { gte: from } : {}),
              ...(to ? { lte: to } : {}),
            },
          }
        : {}),
    };

    return this.db.waterReading.findMany({
      where,
      orderBy: { readingTime: 'asc' },
      include: {
        meter: {
          include: {
            building: { select: { id: true, name: true, code: true } },
          },
        },
      },
    });
  }
}
