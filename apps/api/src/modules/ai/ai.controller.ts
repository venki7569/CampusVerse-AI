import { Request, Response, NextFunction } from 'express';
import { sendSuccess, sendCreated, sendNoContent, sendPaginated } from '../../utils/apiResponse';
import type { AIService } from './ai.service';
import type { ChatRequestDto, ListConversationsQuery } from './ai.dto';

export class AIController {
  constructor(private readonly service: AIService) {}

  chat = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const result = await this.service.chat(
        req.user!.sub,
        req.user!.roles ?? [],
        req.body as ChatRequestDto,
      );
      sendCreated(res, result);
    } catch (err) {
      next(err);
    }
  };

  listConversations = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const result = await this.service.listConversations(
        req.user!.sub,
        req.query as unknown as ListConversationsQuery,
      );
      sendPaginated(res, result.data, result.meta.pagination);
    } catch (err) {
      next(err);
    }
  };

  getConversation = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      sendSuccess(res, await this.service.getConversation(req.user!.sub, req.params['id'] as string));
    } catch (err) {
      next(err);
    }
  };

  deleteConversation = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      await this.service.deleteConversation(req.user!.sub, req.params['id'] as string);
      sendNoContent(res);
    } catch (err) {
      next(err);
    }
  };

  getStatus = async (_req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      sendSuccess(res, { configured: this.service.isConfigured() });
    } catch (err) {
      next(err);
    }
  };
}
