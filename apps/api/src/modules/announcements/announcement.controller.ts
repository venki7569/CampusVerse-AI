import { Request, Response, NextFunction } from 'express';
import { sendSuccess, sendCreated, sendNoContent, sendPaginated } from '../../utils/apiResponse';
import { getAuthorizationService } from '../admin/authorization.service';
import type { AnnouncementService } from './announcement.service';
import type {
  CreateAnnouncementDto,
  ListAnnouncementsQuery,
  ScheduleAnnouncementDto,
  UpdateAnnouncementDto,
} from './announcement.dto';
import type { RoleName } from '../../types';

export class AnnouncementController {
  constructor(private readonly service: AnnouncementService) {}

  private async actor(req: Request) {
    const roles = (req.user!.roles ?? []) as RoleName[];
    const permissions = await getAuthorizationService().getPermissionCodes(roles);
    return this.service.resolveActor(req.user!.sub, roles, permissions);
  }

  list = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const result = await this.service.list(
        await this.actor(req),
        req.query as unknown as ListAnnouncementsQuery,
      );
      sendPaginated(res, result.data, result.meta.pagination);
    } catch (err) {
      next(err);
    }
  };

  unreadCount = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      sendSuccess(res, await this.service.getUnreadCount(await this.actor(req)));
    } catch (err) {
      next(err);
    }
  };

  feedSummary = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      sendSuccess(res, await this.service.getFeedSummary(await this.actor(req)));
    } catch (err) {
      next(err);
    }
  };

  getById = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      sendSuccess(res, await this.service.getById(await this.actor(req), req.params['id'] as string));
    } catch (err) {
      next(err);
    }
  };

  create = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      sendCreated(res, await this.service.create(await this.actor(req), req.body as CreateAnnouncementDto));
    } catch (err) {
      next(err);
    }
  };

  update = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      sendSuccess(
        res,
        await this.service.update(
          await this.actor(req),
          req.params['id'] as string,
          req.body as UpdateAnnouncementDto,
        ),
      );
    } catch (err) {
      next(err);
    }
  };

  delete = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      await this.service.delete(await this.actor(req), req.params['id'] as string);
      sendNoContent(res);
    } catch (err) {
      next(err);
    }
  };

  publish = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      sendSuccess(res, await this.service.publish(await this.actor(req), req.params['id'] as string));
    } catch (err) {
      next(err);
    }
  };

  schedule = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      sendSuccess(
        res,
        await this.service.schedule(
          await this.actor(req),
          req.params['id'] as string,
          req.body as ScheduleAnnouncementDto,
        ),
      );
    } catch (err) {
      next(err);
    }
  };

  cancel = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      sendSuccess(res, await this.service.cancel(await this.actor(req), req.params['id'] as string));
    } catch (err) {
      next(err);
    }
  };

  archive = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      sendSuccess(res, await this.service.archive(await this.actor(req), req.params['id'] as string));
    } catch (err) {
      next(err);
    }
  };

  markRead = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      sendSuccess(res, await this.service.markRead(await this.actor(req), req.params['id'] as string));
    } catch (err) {
      next(err);
    }
  };
}
