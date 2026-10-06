import { createLogger } from '../../utils/logger';

const log = createLogger('AIEvents');

export type AIEventName =
  | 'ai.conversation.created'
  | 'ai.message.created'
  | 'ai.tool.used'
  | 'ai.response.completed'
  | 'ai.error';

export interface AIEventPayload {
  timestamp: string;
  userId?: string;
  conversationId?: string;
  tool?: string;
  actorId?: string;
  metadata?: Record<string, unknown>;
}

type AIEventHandler = (event: AIEventName, payload: AIEventPayload) => void;

export class AIEventsService {
  private handlers: AIEventHandler[] = [];

  subscribe(handler: AIEventHandler): () => void {
    this.handlers.push(handler);
    return () => {
      this.handlers = this.handlers.filter((h) => h !== handler);
    };
  }

  emit(event: AIEventName, payload: AIEventPayload): void {
    log.info(`[Event: ${event}] conversation=${payload.conversationId ?? '-'}`);
    for (const handler of this.handlers) {
      try {
        handler(event, payload);
      } catch (err) {
        log.warn(`Error in AI event handler for ${event}`, { err });
      }
    }
  }
}

export const aiEvents = new AIEventsService();
