import { Request, Response, NextFunction } from 'express';
import { sendSuccess, sendCreated, sendNoContent, sendPaginated } from '../../utils/apiResponse';
import type { DepartmentService } from './department.service';
import type { CreateDepartmentDto, UpdateDepartmentDto, ListDepartmentsQuery } from './department.dto';

export class DepartmentController {
  constructor(private readonly service: DepartmentService) {}

  list = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const query = req.query as unknown as ListDepartmentsQuery;
      const result = await this.service.list(query);
      sendPaginated(res, result.data, result.meta.pagination);
    } catch (err) {
      next(err);
    }
  };

  getById = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const dept = await this.service.getById(req.params['id'] as string);
      sendSuccess(res, dept);
    } catch (err) {
      next(err);
    }
  };

  create = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const dept = await this.service.create(req.body as CreateDepartmentDto);
      sendCreated(res, dept);
    } catch (err) {
      next(err);
    }
  };

  update = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const dept = await this.service.update(
        req.params['id'] as string,
        req.body as UpdateDepartmentDto,
      );
      sendSuccess(res, dept);
    } catch (err) {
      next(err);
    }
  };

  delete = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      await this.service.delete(req.params['id'] as string);
      sendNoContent(res);
    } catch (err) {
      next(err);
    }
  };
}
