import { PrismaClient, Asset, AssetCategory, Vendor, Prisma } from '@prisma/client';
import type { CreateAssetDto, UpdateAssetDto, ListAssetsQuery } from './asset.dto';
import { getPrismaSkip, buildOrderBy } from '../../utils/pagination';

export class AssetRepository {
  constructor(private readonly db: PrismaClient) {}

  async findAll(query: ListAssetsQuery): Promise<{
    data: (Asset & {
      category: AssetCategory;
      vendor: Vendor | null;
      department: { id: string; name: string; code: string } | null;
      building: { id: string; name: string; code: string } | null;
      room: {
        id: string;
        roomNumber: string;
        roomType: string;
        floor: { id: string; level: string; building: { id: string; name: string; code: string } };
      } | null;
    })[];
    total: number;
    page: number;
    limit: number;
  }> {
    const {
      page,
      limit,
      sortBy,
      sortOrder,
      search,
      categoryId,
      departmentId,
      buildingId,
      roomId,
      condition,
      operationalStatus,
    } = query;

    const skip = getPrismaSkip(page, limit);
    const orderBy = buildOrderBy(sortBy, sortOrder);

    const where: Prisma.AssetWhereInput = {
      ...(categoryId ? { categoryId } : {}),
      ...(departmentId ? { departmentId } : {}),
      ...(buildingId ? { buildingId } : {}),
      ...(roomId ? { roomId } : {}),
      ...(condition ? { condition } : {}),
      ...(operationalStatus ? { operationalStatus } : {}),
      ...(search
        ? {
            OR: [
              { name: { contains: search, mode: 'insensitive' } },
              { assetTag: { contains: search, mode: 'insensitive' } },
              { serialNumber: { contains: search, mode: 'insensitive' } },
            ],
          }
        : {}),
    };

    const [data, total] = await Promise.all([
      this.db.asset.findMany({
        where,
        skip,
        take: limit,
        orderBy,
        include: {
          category: true,
          vendor: true,
          department: { select: { id: true, name: true, code: true } },
          building: { select: { id: true, name: true, code: true } },
          room: {
            select: {
              id: true,
              roomNumber: true,
              roomType: true,
              floor: {
                select: {
                  id: true,
                  level: true,
                  building: { select: { id: true, name: true, code: true } },
                },
              },
            },
          },
        },
      }),
      this.db.asset.count({ where }),
    ]);

    return { data, total, page, limit };
  }

  async findById(id: string) {
    return this.db.asset.findUnique({
      where: { id },
      include: {
        category: true,
        vendor: true,
        department: true,
        building: true,
        room: {
          include: {
            floor: {
              include: {
                building: true,
              },
            },
          },
        },
        maintenanceHistory: {
          orderBy: { performedAt: 'desc' },
        },
      },
    });
  }

  async findByAssetTag(assetTag: string): Promise<Asset | null> {
    return this.db.asset.findUnique({ where: { assetTag } });
  }

  async findBySerialNumber(serialNumber: string): Promise<Asset | null> {
    return this.db.asset.findFirst({ where: { serialNumber } });
  }

  async create(data: CreateAssetDto): Promise<Asset> {
    return this.db.asset.create({
      data: {
        assetTag: data.assetTag,
        name: data.name,
        categoryId: data.categoryId,
        vendorId: data.vendorId,
        departmentId: data.departmentId,
        buildingId: data.buildingId,
        roomId: data.roomId,
        serialNumber: data.serialNumber,
        purchaseDate: data.purchaseDate,
        purchaseCost: data.purchaseCost,
        warrantyExpiry: data.warrantyExpiry,
        condition: data.condition,
        operationalStatus: data.operationalStatus,
        lastMaintenance: data.lastMaintenance,
        nextMaintenance: data.nextMaintenance,
      },
    });
  }

  async update(id: string, data: UpdateAssetDto): Promise<Asset> {
    return this.db.asset.update({
      where: { id },
      data: {
        ...(data.assetTag !== undefined ? { assetTag: data.assetTag } : {}),
        ...(data.name !== undefined ? { name: data.name } : {}),
        ...(data.categoryId !== undefined ? { categoryId: data.categoryId } : {}),
        ...(data.vendorId !== undefined ? { vendorId: data.vendorId } : {}),
        ...(data.departmentId !== undefined ? { departmentId: data.departmentId } : {}),
        ...(data.buildingId !== undefined ? { buildingId: data.buildingId } : {}),
        ...(data.roomId !== undefined ? { roomId: data.roomId } : {}),
        ...(data.serialNumber !== undefined ? { serialNumber: data.serialNumber } : {}),
        ...(data.purchaseDate !== undefined ? { purchaseDate: data.purchaseDate } : {}),
        ...(data.purchaseCost !== undefined ? { purchaseCost: data.purchaseCost } : {}),
        ...(data.warrantyExpiry !== undefined ? { warrantyExpiry: data.warrantyExpiry } : {}),
        ...(data.condition !== undefined ? { condition: data.condition } : {}),
        ...(data.operationalStatus !== undefined ? { operationalStatus: data.operationalStatus } : {}),
        ...(data.lastMaintenance !== undefined ? { lastMaintenance: data.lastMaintenance } : {}),
        ...(data.nextMaintenance !== undefined ? { nextMaintenance: data.nextMaintenance } : {}),
      },
    });
  }

  async archive(id: string): Promise<Asset> {
    return this.db.asset.update({
      where: { id },
      data: { operationalStatus: 'RETIRED' },
    });
  }

  async getCategories(): Promise<AssetCategory[]> {
    return this.db.assetCategory.findMany({ orderBy: { name: 'asc' } });
  }

  async getVendors(): Promise<Vendor[]> {
    return this.db.vendor.findMany({ orderBy: { name: 'asc' } });
  }
}
