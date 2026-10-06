import mongoose from 'mongoose';
import { Notification, type INotification } from '../database/mongodb/schemas/notification.schema';
import { createLogger } from '../../utils/logger';
import type { ListNotificationsQuery } from './notification.dto';

const log = createLogger('NotificationRepository');

export type CreateNotificationInput = {
  userId: string;
  type: string;
  title: string;
  message: string;
  severity?: string;
  link?: string;
  metadata?: Record<string, unknown>;
  isRead?: boolean;
};

function isMongoReady(): boolean {
  return mongoose.connection.readyState === 1;
}

export class NotificationRepository {
  async create(input: CreateNotificationInput): Promise<INotification | null> {
    if (!isMongoReady()) {
      log.warn('MongoDB unavailable; notification not persisted', { userId: input.userId, type: input.type });
      return null;
    }

    return Notification.create({
      userId: input.userId,
      type: input.type,
      title: input.title,
      message: input.message,
      severity: input.severity,
      link: input.link,
      metadata: input.metadata ?? {},
      isRead: input.isRead ?? false,
      createdAt: new Date(),
    });
  }

  async findForUser(userId: string, query: ListNotificationsQuery) {
    if (!isMongoReady()) {
      return { data: [] as INotification[], total: 0, page: query.page, limit: query.limit };
    }

    const { page, limit, sortBy, sortOrder, search, unreadOnly, type, severity } = query;
    const skip = (page - 1) * limit;

    const filter: Record<string, unknown> = { userId };

    if (unreadOnly === true) {
      filter['isRead'] = false;
    }

    if (type) {
      filter['type'] = type;
    }

    if (severity) {
      // Support both top-level severity and legacy metadata.severity
      filter['$or'] = [{ severity }, { 'metadata.severity': severity }];
    }

    if (search) {
      const searchFilter = {
        $or: [
          { title: { $regex: search, $options: 'i' } },
          { message: { $regex: search, $options: 'i' } },
          { type: { $regex: search, $options: 'i' } },
        ],
      };
      const existingAnd = Array.isArray(filter['$and'])
        ? (filter['$and'] as Record<string, unknown>[])
        : [];
      filter['$and'] = [...existingAnd, searchFilter];
    }

    const allowedSort = new Set(['createdAt', 'isRead', 'type', 'severity', 'title']);
    const sortField = sortBy && allowedSort.has(sortBy) ? sortBy : 'createdAt';
    const sortDir = sortOrder === 'asc' ? 1 : -1;

    const [data, total] = await Promise.all([
      Notification.find(filter)
        .sort({ [sortField]: sortDir })
        .skip(skip)
        .limit(limit)
        .exec(),
      Notification.countDocuments(filter),
    ]);

    return { data, total, page, limit };
  }

  async findByIdForUser(userId: string, id: string): Promise<INotification | null> {
    if (!isMongoReady() || !mongoose.isValidObjectId(id)) {
      return null;
    }
    return Notification.findOne({ _id: id, userId }).exec();
  }

  async markRead(userId: string, id: string): Promise<INotification | null> {
    if (!isMongoReady() || !mongoose.isValidObjectId(id)) {
      return null;
    }
    return Notification.findOneAndUpdate(
      { _id: id, userId },
      { $set: { isRead: true } },
      { new: true },
    ).exec();
  }

  async markAllRead(userId: string): Promise<number> {
    if (!isMongoReady()) {
      return 0;
    }
    const result = await Notification.updateMany(
      { userId, isRead: false },
      { $set: { isRead: true } },
    ).exec();
    return result.modifiedCount;
  }

  async deleteForUser(userId: string, id: string): Promise<INotification | null> {
    if (!isMongoReady() || !mongoose.isValidObjectId(id)) {
      return null;
    }
    return Notification.findOneAndDelete({ _id: id, userId }).exec();
  }

  async countUnread(userId: string): Promise<number> {
    if (!isMongoReady()) {
      return 0;
    }
    return Notification.countDocuments({ userId, isRead: false });
  }
}
