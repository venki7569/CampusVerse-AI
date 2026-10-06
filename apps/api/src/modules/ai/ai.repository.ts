import mongoose from 'mongoose';
import { AIConversation, type IAIConversation } from '../database/mongodb/schemas/aiConversation.schema';
import { createLogger } from '../../utils/logger';
import type { ListConversationsQuery } from './ai.dto';

const log = createLogger('AIRepository');

function isReady(): boolean {
  return mongoose.connection.readyState === 1;
}

export class AIRepository {
  async createConversation(userId: string, title = 'New conversation'): Promise<IAIConversation | null> {
    if (!isReady()) return null;
    return AIConversation.create({ userId, title, messages: [], context: {} });
  }

  async findConversationById(id: string, userId: string): Promise<IAIConversation | null> {
    if (!isReady()) return null;
    return AIConversation.findOne({ _id: id, userId });
  }

  async listConversations(userId: string, query: ListConversationsQuery) {
    if (!isReady()) {
      return { data: [] as IAIConversation[], total: 0, page: query.page, limit: query.limit };
    }
    const skip = (query.page - 1) * query.limit;
    const filter: Record<string, unknown> = { userId };
    if (query.search) {
      filter['title'] = { $regex: query.search, $options: 'i' };
    }
    const [data, total] = await Promise.all([
      AIConversation.find(filter)
        .sort({ updatedAt: -1 })
        .skip(skip)
        .limit(query.limit)
        .exec(),
      AIConversation.countDocuments(filter),
    ]);
    return { data, total, page: query.page, limit: query.limit };
  }

  async appendMessages(
    id: string,
    userId: string,
    entries: Array<{ role: 'user' | 'assistant'; content: string }>,
    title?: string,
  ): Promise<IAIConversation | null> {
    if (!isReady()) return null;
    const update: Record<string, unknown> = {
      $push: {
        messages: {
          $each: entries.map((e) => ({ ...e, timestamp: new Date() })),
        },
      },
    };
    if (title) update['$set'] = { title };
    return AIConversation.findOneAndUpdate({ _id: id, userId }, update, { new: true });
  }

  async deleteConversation(id: string, userId: string): Promise<boolean> {
    if (!isReady()) return false;
    const result = await AIConversation.deleteOne({ _id: id, userId });
    return result.deletedCount > 0;
  }

  async updateTitle(id: string, userId: string, title: string): Promise<IAIConversation | null> {
    if (!isReady()) return null;
    return AIConversation.findOneAndUpdate({ _id: id, userId }, { title }, { new: true });
  }

  isAvailable(): boolean {
    return isReady();
  }

  warnUnavailable(action: string): void {
    log.warn(`MongoDB unavailable; AI conversation ${action} skipped`);
  }
}
