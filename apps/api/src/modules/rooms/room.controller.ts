import { Request, Response, NextFunction } from 'express';
import { sendSuccess, sendCreated, sendNoContent, sendPaginated } from '../../utils/apiResponse';
import type { RoomService } from './room.service';
import type { CreateRoomDto, UpdateRoomDto, UpdateOccupancyDto, ListRoomsQuery } from './room.dto';
import { actorFromRequest } from '../../services/department-scope.service';

export class RoomController {
  constructor(private readonly service: RoomService) {}

  list = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const actor = req.user ? actorFromRequest(req.user) : undefined;
      const result = await this.service.list(req.query as unknown as ListRoomsQuery, actor);
      sendPaginated(res, result.data, result.meta.pagination);
    } catch (err) { next(err); }
  };

  getById = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const actor = req.user ? actorFromRequest(req.user) : undefined;
      sendSuccess(res, await this.service.getById(req.params['id'] as string, actor));
    } catch (err) { next(err); }
  };

  create = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      sendCreated(res, await this.service.create(req.body as CreateRoomDto));
    } catch (err) { next(err); }
  };

  update = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      sendSuccess(res, await this.service.update(req.params['id'] as string, req.body as UpdateRoomDto));
    } catch (err) { next(err); }
  };

  updateOccupancy = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      sendSuccess(
        res,
        await this.service.updateOccupancy(
          req.params['id'] as string,
          req.body as UpdateOccupancyDto,
          req.user?.sub,
        ),
      );
    } catch (err) { next(err); }
  };

  getOccupancySummary = async (_req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      sendSuccess(res, await this.service.getOccupancySummary());
    } catch (err) { next(err); }
  };

  /**
   * [DEV ONLY] Trigger simulated occupancy events.
   * This endpoint is clearly tagged as development-only simulation.
   */
  simulateOccupancy = async (_req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const result = await this.service.simulateOccupancyEvents();
      sendSuccess(res, result, { warning: '[SIMULATED] DEV ONLY — not connected to real sensors' });
    } catch (err) { next(err); }
  };

  delete = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      await this.service.delete(req.params['id'] as string);
      sendNoContent(res);
    } catch (err) { next(err); }
  };
}
