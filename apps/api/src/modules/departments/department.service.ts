import { AppError } from '../../utils/AppError';
import { buildPaginationMeta } from '../../utils/pagination';
import { createLogger } from '../../utils/logger';
import type { DepartmentRepository } from './department.repository';
import type { CreateDepartmentDto, UpdateDepartmentDto } from './department.dto';
import type { PaginationQuery } from '../../types';

const log = createLogger('DepartmentService');

export class DepartmentService {
  constructor(private readonly repo: DepartmentRepository) {}

  async list(query: PaginationQuery) {
    const result = await this.repo.findAll(query);
    return {
      data: result.data,
      meta: {
        pagination: buildPaginationMeta(result.total, result.page, result.limit),
      },
    };
  }

  async getById(id: string) {
    const dept = await this.repo.findById(id);
    if (!dept) throw AppError.notFound('Department');
    return dept;
  }

  async create(dto: CreateDepartmentDto) {
    const existing = await this.repo.findByCode(dto.code);
    if (existing) {
      throw AppError.conflict(`Department with code '${dto.code}' already exists`);
    }
    const department = await this.repo.create(dto);
    log.info(`Department created: ${department.id} (${department.code})`);
    return department;
  }

  async update(id: string, dto: UpdateDepartmentDto) {
    await this.getById(id);
    const updated = await this.repo.update(id, dto);
    log.info(`Department updated: ${id}`);
    return updated;
  }

  async delete(id: string) {
    const dept = await this.getById(id);
    if ('_count' in dept) {
      if (dept._count.rooms > 0) {
        throw AppError.conflict(
          'Cannot delete department with associated rooms. Please reassign or remove room assignments first.',
        );
      }
      if (dept._count.assets > 0) {
        throw AppError.conflict(
          'Cannot delete department with associated assets. Please reassign assets first.',
        );
      }
    }
    const deleted = await this.repo.delete(id);
    log.info(`Department deleted: ${id}`);
    return deleted;
  }
}
