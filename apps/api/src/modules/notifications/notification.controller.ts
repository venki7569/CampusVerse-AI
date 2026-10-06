import { Request, Response, NextFunction } from 'express';
import { sendSuccess, sendPaginated, sendNoContent } from '../../utils/apiResponse';
import { AppError } from '../../utils/AppError';
import type { NotificationService } from './notification.service';
import type { ListNotificationsQuery } from './notification.dto';

export class NotificationController {
  constructor(private readonly service: NotificationService) {}

  private requireUserId(req: Request): string {
    const userId = req.user?.sub;
    if (!userId) {
      throw AppError.unauthorized('Authentication required');
    }
    return userId;
  }

  list = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = this.requireUserId(req);
      const result = await this.service.list(userId, req.query as unknown as ListNotificationsQuery);
      sendPaginated(res, result.data, result.meta.pagination);
    } catch (err) {
      next(err);
    }
  };

  getUnreadCount = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = this.requireUserId(req);
      sendSuccess(res, await this.service.getUnreadCount(userId));
    } catch (err) {
      next(err);
    }
  };

  getById = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = this.requireUserId(req);
      sendSuccess(res, await this.service.getById(userId, req.params['id'] as string));
    } catch (err) {
      next(err);
    }
  };

  markRead = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = this.requireUserId(req);
      sendSuccess(res, await this.service.markRead(userId, req.params['id'] as string));
    } catch (err) {
      next(err);
    }
  };

  markAllRead = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = this.requireUserId(req);
      sendSuccess(res, await this.service.markAllRead(userId));
    } catch (err) {
      next(err);
    }
  };

  delete = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = this.requireUserId(req);
      await this.service.delete(userId, req.params['id'] as string);
      sendNoContent(res);
    } catch (err) {
      next(err);
    }
  };
}
