import { AppError } from '../../utils/AppError';
import { buildPaginationMeta } from '../../utils/pagination';
import { createLogger } from '../../utils/logger';
import type { FloorRepository, ListFloorsRepoQuery } from './floor.repository';
import type { CreateFloorDto, UpdateFloorDto } from './floor.dto';
import type { PrismaClient, Floor } from '@prisma/client';

const log = createLogger('FloorService');

export class FloorService {
  constructor(
    private readonly repo: FloorRepository,
    private readonly db?: PrismaClient,
  ) {}

  async list(query: ListFloorsRepoQuery) {
    const result = await this.repo.findAll(query);
    return {
      data: result.data,
      meta: { pagination: buildPaginationMeta(result.total, result.page, result.limit) },
    };
  }

  async getById(id: string) {
    const floor = await this.repo.findById(id);
    if (!floor) throw AppError.notFound('Floor');
    return floor;
  }

  async create(dto: CreateFloorDto) {
    if (this.db) {
      const building = await this.db.building.findUnique({ where: { id: dto.buildingId } });
      if (!building) {
        throw AppError.notFound('Building');
      }
      if (building.operationalStatus === 'RETIRED') {
        throw AppError.badRequest('Cannot add floors to a retired building');
      }
    }
    const existing = await this.repo.findByLevelAndBuilding(dto.level, dto.buildingId);
    if (existing) {
      throw AppError.conflict(`Floor level '${dto.level}' already exists in this building`);
    }
    const floor = await this.repo.create(dto);
    log.info(`Floor created: ${floor.id} level=${floor.level}`);
    return floor;
  }

  async update(id: string, dto: UpdateFloorDto) {
    const existing = await this.getById(id);
    if (dto.level && dto.level !== existing.level) {
      const duplicate = await this.repo.findByLevelAndBuilding(dto.level, existing.buildingId);
      if (duplicate) {
        throw AppError.conflict(`Floor level '${dto.level}' already exists in this building`);
      }
    }
    const updated = await this.repo.update(id, dto);
    log.info(`Floor updated: ${id}`);
    return updated;
  }

  async delete(id: string): Promise<Floor> {
    const floor = await this.getById(id);
    if ('rooms' in floor && Array.isArray(floor.rooms) && floor.rooms.length > 0) {
      throw AppError.conflict('Cannot delete floor containing rooms. Please remove or reassign rooms first.');
    }
    const deleted = await this.repo.delete(id);
    log.info(`Floor deleted: ${id}`);
    return deleted;
  }
}
