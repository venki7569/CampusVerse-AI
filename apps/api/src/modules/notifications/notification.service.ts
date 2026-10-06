import { config } from '../../config/env';
import { cacheService } from '../../services/cache.service';
import { AppError } from '../../utils/AppError';
import { buildPaginationMeta } from '../../utils/pagination';
import { createLogger } from '../../utils/logger';
import type { INotification } from '../database/mongodb/schemas/notification.schema';
import {
  NotificationRepository,
  type CreateNotificationInput,
} from './notification.repository';
import { notificationEvents } from './notification.events';
import type { ListNotificationsQuery, NotificationDto } from './notification.dto';

const log = createLogger('NotificationService');

export function toNotificationDto(doc: INotification): NotificationDto {
  const metadata = (doc.metadata ?? {}) as Record<string, unknown>;
  const severityFromMeta =
    typeof metadata['severity'] === 'string' ? (metadata['severity'] as string) : null;

  return {
    id: String(doc._id),
    userId: doc.userId,
    type: doc.type,
    title: doc.title,
    message: doc.message,
    isRead: Boolean(doc.isRead),
    severity: doc.severity ?? severityFromMeta,
    link: doc.link ?? null,
    metadata,
    createdAt: doc.createdAt?.toISOString?.() ?? new Date().toISOString(),
  };
}

export class NotificationService {
  constructor(private readonly repo: NotificationRepository) {}

  /**
   * Shared create path for operational producers.
   * Emits notification.created after a successful write.
   */
  async createNotification(input: CreateNotificationInput): Promise<NotificationDto | null> {
    const created = await this.repo.create(input);
    if (!created) return null;

    const dto = toNotificationDto(created);
    notificationEvents.emit('notification.created', {
      timestamp: new Date().toISOString(),
      userId: dto.userId,
      notificationId: dto.id,
      metadata: { type: dto.type, severity: dto.severity },
    });
    log.info(`Notification created for user ${dto.userId}: ${dto.type}`);
    return dto;
  }

  async list(userId: string, query: ListNotificationsQuery) {
    const result = await this.repo.findForUser(userId, query);
    return {
      data: result.data.map(toNotificationDto),
      meta: {
        pagination: buildPaginationMeta(result.total, result.page, result.limit),
      },
    };
  }

  async getById(userId: string, id: string): Promise<NotificationDto> {
    const doc = await this.repo.findByIdForUser(userId, id);
    if (!doc) {
      throw AppError.notFound('Notification');
    }
    return toNotificationDto(doc);
  }

  async markRead(userId: string, id: string): Promise<NotificationDto> {
    const updated = await this.repo.markRead(userId, id);
    if (!updated) {
      throw AppError.notFound('Notification');
    }
    const dto = toNotificationDto(updated);
    const unreadCount = await this.repo.countUnread(userId);
    notificationEvents.emit('notification.read', {
      timestamp: new Date().toISOString(),
      userId,
      notificationId: dto.id,
      unreadCount,
    });
    return dto;
  }

  async markAllRead(userId: string): Promise<{ modifiedCount: number; unreadCount: number }> {
    const modifiedCount = await this.repo.markAllRead(userId);
    const unreadCount = await this.repo.countUnread(userId);
    notificationEvents.emit('notification.readAll', {
      timestamp: new Date().toISOString(),
      userId,
      unreadCount,
      metadata: { modifiedCount },
    });
    return { modifiedCount, unreadCount };
  }

  async delete(userId: string, id: string): Promise<void> {
    const deleted = await this.repo.deleteForUser(userId, id);
    if (!deleted) {
      throw AppError.notFound('Notification');
    }
    const unreadCount = await this.repo.countUnread(userId);
    notificationEvents.emit('notification.deleted', {
      timestamp: new Date().toISOString(),
      userId,
      notificationId: String(deleted._id),
      unreadCount,
    });
  }

  async getUnreadCount(userId: string): Promise<{ unreadCount: number }> {
    return cacheService.getOrSet(
      `notifications:unread:${userId}`,
      async () => {
        const unreadCount = await this.repo.countUnread(userId);
        return { unreadCount };
      },
      { ttlSeconds: config.cache.unreadCountTtlSeconds, prefix: 'cv' },
    );
  }
}

/** Singleton helpers for existing audit producers (no Express DI required). */
const sharedRepo = new NotificationRepository();
const sharedService = new NotificationService(sharedRepo);

export async function publishNotification(
  input: CreateNotificationInput,
): Promise<NotificationDto | null> {
  return sharedService.createNotification(input);
}
