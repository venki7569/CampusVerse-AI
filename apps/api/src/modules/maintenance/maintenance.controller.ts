import { Request, Response, NextFunction } from 'express';
import { sendSuccess, sendCreated, sendPaginated } from '../../utils/apiResponse';
import type { MaintenanceService } from './maintenance.service';
import type {
  CreateMaintenanceRequestDto,
  UpdateMaintenanceRequestDto,
  ListMaintenanceRequestsQuery,
  AssignMaintenanceRequestDto,
  ResolveMaintenanceRequestDto,
  CloseMaintenanceRequestDto,
  CancelOrRejectMaintenanceRequestDto,
  CreateMaintenanceCommentDto,
} from './maintenance.dto';
import { actorFromRequest } from '../../services/department-scope.service';

export class MaintenanceController {
  constructor(private readonly service: MaintenanceService) {}

  list = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const actor = req.user ? actorFromRequest(req.user) : undefined;
      const result = await this.service.list(req.query as unknown as ListMaintenanceRequestsQuery, actor);
      sendPaginated(res, result.data, result.meta.pagination);
    } catch (err) {
      next(err);
    }
  };

  getById = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const actor = req.user ? actorFromRequest(req.user) : undefined;
      const request = await this.service.getById(req.params['id'] as string, actor);
      sendSuccess(res, request);
    } catch (err) {
      next(err);
    }
  };

  create = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const reporterId = req.user!.sub;
      const request = await this.service.create(req.body as CreateMaintenanceRequestDto, reporterId);
      sendCreated(res, request);
    } catch (err) {
      next(err);
    }
  };

  update = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const actorId = req.user!.sub;
      const request = await this.service.update(
        req.params['id'] as string,
        req.body as UpdateMaintenanceRequestDto,
        actorId,
      );
      sendSuccess(res, request);
    } catch (err) {
      next(err);
    }
  };

  assign = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const actorId = req.user!.sub;
      const result = await this.service.assign(
        req.params['id'] as string,
        req.body as AssignMaintenanceRequestDto,
        actorId,
      );
      sendSuccess(res, result);
    } catch (err) {
      next(err);
    }
  };

  start = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const actorId = req.user!.sub;
      const result = await this.service.startWork(req.params['id'] as string, actorId);
      sendSuccess(res, result);
    } catch (err) {
      next(err);
    }
  };

  resolve = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const actorId = req.user!.sub;
      const result = await this.service.resolve(
        req.params['id'] as string,
        req.body as ResolveMaintenanceRequestDto,
        actorId,
      );
      sendSuccess(res, result);
    } catch (err) {
      next(err);
    }
  };

  close = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const actorId = req.user!.sub;
      const result = await this.service.close(
        req.params['id'] as string,
        req.body as CloseMaintenanceRequestDto,
        actorId,
      );
      sendSuccess(res, result);
    } catch (err) {
      next(err);
    }
  };

  cancel = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const actorId = req.user!.sub;
      const result = await this.service.cancel(
        req.params['id'] as string,
        req.body as CancelOrRejectMaintenanceRequestDto,
        actorId,
      );
      sendSuccess(res, result);
    } catch (err) {
      next(err);
    }
  };

  reject = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const actorId = req.user!.sub;
      const result = await this.service.reject(
        req.params['id'] as string,
        req.body as CancelOrRejectMaintenanceRequestDto,
        actorId,
      );
      sendSuccess(res, result);
    } catch (err) {
      next(err);
    }
  };

  addComment = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const authorId = req.user!.sub;
      const comment = await this.service.addComment(
        req.params['id'] as string,
        req.body as CreateMaintenanceCommentDto,
        authorId,
      );
      sendCreated(res, comment);
    } catch (err) {
      next(err);
    }
  };

  getComments = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const comments = await this.service.getComments(req.params['id'] as string);
      sendSuccess(res, comments);
    } catch (err) {
      next(err);
    }
  };

  getMetrics = async (_req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const metrics = await this.service.getMetrics();
      sendSuccess(res, metrics);
    } catch (err) {
      next(err);
    }
  };

  getTechnicians = async (_req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const technicians = await this.service.getTechnicians();
      sendSuccess(res, technicians);
    } catch (err) {
      next(err);
    }
  };
}
