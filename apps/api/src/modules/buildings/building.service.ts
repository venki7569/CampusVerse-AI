import { AppError } from '../../utils/AppError';
import { buildPaginationMeta } from '../../utils/pagination';
import { createLogger } from '../../utils/logger';
import type { BuildingRepository } from './building.repository';
import type { CreateBuildingDto, UpdateBuildingDto } from './building.dto';
import type { PaginatedResult, PaginationQuery } from '../../types';
import type { Building } from '@prisma/client';

const log = createLogger('BuildingService');

export class BuildingService {
  constructor(private readonly repo: BuildingRepository) {}

  async list(query: PaginationQuery): Promise<PaginatedResult<Building>> {
    const result = await this.repo.findAll(query);
    return {
      data: result.data,
      meta: {
        pagination: buildPaginationMeta(result.total, result.page, result.limit),
      },
    };
  }

  async getById(id: string): Promise<Building> {
    const bld = await this.repo.findById(id);
    if (!bld) throw AppError.notFound('Building');
    return bld;
  }

  async create(dto: CreateBuildingDto): Promise<Building> {
    const existing = await this.repo.findByCode(dto.code);
    if (existing) {
      throw AppError.conflict('Building code ' + dto.code + ' already exists');
    }
    const building = await this.repo.create(dto);
    log.info('Building created: ' + building.id + ' (' + building.code + ')');
    return building;
  }

  async update(id: string, dto: UpdateBuildingDto): Promise<Building> {
    await this.getById(id);
    const updated = await this.repo.update(id, dto);
    log.info('Building updated: ' + id);
    return updated;
  }

  async delete(id: string): Promise<Building> {
    await this.getById(id);
    const archived = await this.repo.archive(id);
    log.info('Building archived: ' + id);
    return archived;
  }
}
