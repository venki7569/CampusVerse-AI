import { Request, Response, NextFunction } from 'express';
import { sendSuccess, sendCreated, sendPaginated } from '../../utils/apiResponse';
import type { BuildingService } from './building.service';
import type { CreateBuildingDto, UpdateBuildingDto } from './building.dto';
import type { PaginationQuery } from '../../types';

export class BuildingController {
  constructor(private readonly service: BuildingService) {}

  list = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const result = await this.service.list(req.query as unknown as PaginationQuery);
      sendPaginated(res, result.data, result.meta.pagination);
    } catch (err) {
      next(err);
    }
  };

  getById = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const bld = await this.service.getById(req.params['id'] as string);
      sendSuccess(res, bld);
    } catch (err) {
      next(err);
    }
  };

  create = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const bld = await this.service.create(req.body as CreateBuildingDto);
      sendCreated(res, bld);
    } catch (err) {
      next(err);
    }
  };

  update = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const bld = await this.service.update(
        req.params['id'] as string,
        req.body as UpdateBuildingDto,
      );
      sendSuccess(res, bld);
    } catch (err) {
      next(err);
    }
  };

  /** Archives (soft-deletes) the building by setting operationalStatus = RETIRED */
  delete = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const archived = await this.service.delete(req.params['id'] as string);
      sendSuccess(res, archived);
    } catch (err) {
      next(err);
    }
  };
}
