import { Request, Response, NextFunction } from 'express';
import { sendSuccess } from '../../utils/apiResponse';
import { getAuthorizationService } from '../admin/authorization.service';
import type { DashboardService } from './dashboard.service';
import type { DashboardOverviewQuery } from './dashboard.dto';
import type { AnnouncementService } from '../announcements/announcement.service';
import type { RoleName } from '../../types';

export class DashboardController {
  constructor(
    private readonly service: DashboardService,
    private readonly announcements?: AnnouncementService,
  ) {}

  getOverview = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const overview = await this.service.getOverview(req.query as unknown as DashboardOverviewQuery);

      if (req.user && this.announcements) {
        const roles = (req.user.roles ?? []) as RoleName[];
        const permissions = await getAuthorizationService().getPermissionCodes(roles);
        if (permissions.has('announcement.view') || roles.includes('SUPER_ADMIN')) {
          const actor = await this.announcements.resolveActor(req.user.sub, roles, permissions);
          const feed = await this.announcements.getFeedSummary(actor);
          overview.announcements = {
            unreadCount: feed.unreadCount,
            urgentCount: feed.urgentCount,
            latest: feed.latest.map((a) => ({
              id: a.id,
              title: a.title,
              category: a.category,
              priority: a.priority,
              publishedAt: a.publishedAt,
              isRead: a.isRead,
            })),
          };
        }
      }

      sendSuccess(res, overview);
    } catch (err) {
      next(err);
    }
  };
}
