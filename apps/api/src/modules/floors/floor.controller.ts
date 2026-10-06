import { Request, Response, NextFunction } from 'express';
import { sendSuccess, sendCreated, sendNoContent, sendPaginated } from '../../utils/apiResponse';
import type { FloorService } from './floor.service';
import type { CreateFloorDto, UpdateFloorDto, ListFloorsQuery } from './floor.dto';

export class FloorController {
  constructor(private readonly service: FloorService) {}

  list = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const result = await this.service.list(req.query as unknown as ListFloorsQuery);
      sendPaginated(res, result.data, result.meta.pagination);
    } catch (err) { next(err); }
  };

  getById = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      sendSuccess(res, await this.service.getById(req.params['id'] as string));
    } catch (err) { next(err); }
  };

  create = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      sendCreated(res, await this.service.create(req.body as CreateFloorDto));
    } catch (err) { next(err); }
  };

  update = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      sendSuccess(res, await this.service.update(req.params['id'] as string, req.body as UpdateFloorDto));
    } catch (err) { next(err); }
  };

  delete = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      await this.service.delete(req.params['id'] as string);
      sendNoContent(res);
    } catch (err) { next(err); }
  };
}
