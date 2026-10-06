import { PrismaClient, Asset, AssetCategory, Vendor } from '@prisma/client';
import { AppError } from '../../utils/AppError';
import { buildPaginationMeta } from '../../utils/pagination';
import { createLogger } from '../../utils/logger';
import type { AssetRepository } from './asset.repository';
import type { AssetAuditService } from './asset.audit.service';
import type { CreateAssetDto, UpdateAssetDto, ListAssetsQuery } from './asset.dto';
import type { PaginatedResult } from '../../types';
import type { RequestActor } from '../../services/department-scope.service';
import {
  applyDepartmentQueryFilter,
  assertDepartmentAccess,
  resolveDepartmentScope,
} from '../../services/department-scope.service';

const log = createLogger('AssetService');

export class AssetService {
  constructor(
    private readonly repo: AssetRepository,
    private readonly audit: AssetAuditService,
    private readonly db: PrismaClient,
  ) {}

  async list(query: ListAssetsQuery, actor?: RequestActor): Promise<PaginatedResult<any>> {
    let scopedQuery = query;
    if (actor) {
      const scope = await resolveDepartmentScope(this.db, actor);
      scopedQuery = applyDepartmentQueryFilter(scope, query);
    }
    const result = await this.repo.findAll(scopedQuery);
    return {
      data: result.data,
      meta: {
        pagination: buildPaginationMeta(result.total, result.page, result.limit),
      },
    };
  }

  async getById(id: string, actor?: RequestActor) {
    const asset = await this.repo.findById(id);
    if (!asset) throw AppError.notFound('Asset');
    if (actor) {
      const scope = await resolveDepartmentScope(this.db, actor);
      assertDepartmentAccess(scope, asset.departmentId);
    }
    return asset;
  }

  async create(dto: CreateAssetDto, actorId?: string): Promise<Asset> {
    // 1. Check duplicate assetTag
    const existingTag = await this.repo.findByAssetTag(dto.assetTag);
    if (existingTag) {
      throw AppError.conflict(`Asset tag "${dto.assetTag}" is already in use.`);
    }

    // 2. Service-level check duplicate serialNumber if provided
    if (dto.serialNumber) {
      const existingSerial = await this.repo.findBySerialNumber(dto.serialNumber);
      if (existingSerial) {
        throw AppError.conflict(`Serial number "${dto.serialNumber}" is already in use by another asset.`);
      }
    }

    // 3. Verify Category exists
    const category = await this.db.assetCategory.findUnique({ where: { id: dto.categoryId } });
    if (!category) {
      throw AppError.notFound('Asset category not found');
    }

    // 4. Verify Vendor if provided
    if (dto.vendorId) {
      const vendor = await this.db.vendor.findUnique({ where: { id: dto.vendorId } });
      if (!vendor) {
        throw AppError.notFound('Vendor not found');
      }
    }

    // 5. Verify Department if provided
    if (dto.departmentId) {
      const dept = await this.db.department.findUnique({ where: { id: dto.departmentId } });
      if (!dept) {
        throw AppError.notFound('Department not found');
      }
    }

    // 6. Location Validation & Derivation
    let resolvedBuildingId = dto.buildingId;
    if (dto.roomId) {
      const room = await this.db.room.findUnique({
        where: { id: dto.roomId },
        include: { floor: true },
      });
      if (!room) {
        throw AppError.notFound('Target room not found');
      }
      if (room.operationalStatus === 'RETIRED') {
        throw AppError.badRequest('Cannot assign asset to a RETIRED room');
      }

      const roomBuildingId = room.floor.buildingId;
      if (dto.buildingId && dto.buildingId !== roomBuildingId) {
        throw AppError.conflict(
          `Conflict: Room ${room.roomNumber} is in a different building than the provided building ID.`,
        );
      }
      resolvedBuildingId = roomBuildingId;
    } else if (dto.buildingId) {
      const building = await this.db.building.findUnique({ where: { id: dto.buildingId } });
      if (!building) {
        throw AppError.notFound('Building not found');
      }
      if (building.operationalStatus === 'RETIRED') {
        throw AppError.badRequest('Cannot assign asset to a RETIRED building');
      }
    }

    const asset = await this.repo.create({
      ...dto,
      buildingId: resolvedBuildingId,
    });

    log.info(`Asset created: ${asset.id} (${asset.assetTag})`);
    await this.audit.logAssetEvent({
      actorId,
      assetId: asset.id,
      assetTag: asset.assetTag,
      action: 'createAsset',
      details: {
        name: asset.name,
        categoryId: asset.categoryId,
        departmentId: asset.departmentId,
        buildingId: asset.buildingId,
        roomId: asset.roomId,
        operationalStatus: asset.operationalStatus,
      },
    });

    return asset;
  }

  async update(id: string, dto: UpdateAssetDto, actorId?: string): Promise<Asset> {
    const existing = await this.getById(id);

    // Rule: Cannot update a RETIRED asset unless explicitly handled
    if (existing.operationalStatus === 'RETIRED' && dto.operationalStatus !== 'ACTIVE') {
      throw AppError.badRequest('Cannot modify an archived/retired asset.');
    }

    // Check duplicate assetTag if changing
    if (dto.assetTag && dto.assetTag !== existing.assetTag) {
      const duplicateTag = await this.repo.findByAssetTag(dto.assetTag);
      if (duplicateTag && duplicateTag.id !== id) {
        throw AppError.conflict(`Asset tag "${dto.assetTag}" is already in use.`);
      }
    }

    // Check duplicate serialNumber if changing
    if (dto.serialNumber && dto.serialNumber !== existing.serialNumber) {
      const duplicateSerial = await this.repo.findBySerialNumber(dto.serialNumber);
      if (duplicateSerial && duplicateSerial.id !== id) {
        throw AppError.conflict(`Serial number "${dto.serialNumber}" is already in use.`);
      }
    }

    // Verify Category if changing
    if (dto.categoryId && dto.categoryId !== existing.categoryId) {
      const category = await this.db.assetCategory.findUnique({ where: { id: dto.categoryId } });
      if (!category) throw AppError.notFound('Asset category not found');
    }

    // Verify Vendor if changing
    if (dto.vendorId !== undefined && dto.vendorId !== null) {
      const vendor = await this.db.vendor.findUnique({ where: { id: dto.vendorId } });
      if (!vendor) throw AppError.notFound('Vendor not found');
    }

    // Verify Department if changing
    if (dto.departmentId !== undefined && dto.departmentId !== null) {
      const dept = await this.db.department.findUnique({ where: { id: dto.departmentId } });
      if (!dept) throw AppError.notFound('Department not found');
    }

    // Location validation
    let resolvedBuildingId = dto.buildingId !== undefined ? dto.buildingId : existing.buildingId;
    const targetRoomId = dto.roomId !== undefined ? dto.roomId : existing.roomId;

    if (targetRoomId) {
      const room = await this.db.room.findUnique({
        where: { id: targetRoomId },
        include: { floor: true },
      });
      if (!room) throw AppError.notFound('Target room not found');
      if (room.operationalStatus === 'RETIRED') {
        throw AppError.badRequest('Cannot assign asset to a RETIRED room');
      }

      const roomBuildingId = room.floor.buildingId;
      if (dto.buildingId && dto.buildingId !== roomBuildingId) {
        throw AppError.conflict(
          `Conflict: Room ${room.roomNumber} belongs to a different building than specified.`,
        );
      }
      resolvedBuildingId = roomBuildingId;
    } else if (dto.buildingId) {
      const building = await this.db.building.findUnique({ where: { id: dto.buildingId } });
      if (!building) throw AppError.notFound('Building not found');
      if (building.operationalStatus === 'RETIRED') {
        throw AppError.badRequest('Cannot assign asset to a RETIRED building');
      }
    }

    const updated = await this.repo.update(id, {
      ...dto,
      buildingId: resolvedBuildingId,
    });

    log.info(`Asset updated: ${updated.id} (${updated.assetTag})`);
    await this.audit.logAssetEvent({
      actorId,
      assetId: updated.id,
      assetTag: updated.assetTag,
      action: 'updateAsset',
      details: {
        changes: dto,
      },
    });

    return updated;
  }

  async archive(id: string, actorId?: string): Promise<Asset> {
    const existing = await this.getById(id);
    const archived = await this.repo.archive(id);

    log.info(`Asset archived: ${id} (${existing.assetTag})`);
    await this.audit.logAssetEvent({
      actorId,
      assetId: existing.id,
      assetTag: existing.assetTag,
      action: 'archiveAsset',
      details: { previousStatus: existing.operationalStatus },
    });

    return archived;
  }

  async getCategories(): Promise<AssetCategory[]> {
    return this.repo.getCategories();
  }

  async getVendors(): Promise<Vendor[]> {
    return this.repo.getVendors();
  }
}
