import { config } from '../../config/env';
import { AppError } from '../../utils/AppError';
import { buildPaginationMeta } from '../../utils/pagination';
import { getAuthorizationService } from '../admin/authorization.service';
import type { RoleName } from '../../types';
import type { AIRepository } from './ai.repository';
import type { AIProvider } from './ai.provider';
import type { CampusTools } from './ai.tools';
import type { AIAuditService } from './ai.audit.service';
import { aiEvents } from './ai.events';
import {
  CampusTools as ToolsClass,
  formatToolContext,
  selectTools,
  type ToolContext,
} from './ai.tools';
import type {
  ChatRequestDto,
  ChatResponseDto,
  ConversationDetailDto,
  ConversationSummaryDto,
  ListConversationsQuery,
} from './ai.dto';
import { CAMPUS_AI_SYSTEM_INSTRUCTION as SYSTEM_PROMPT } from './ai.dto';

export class AIService {
  constructor(
    private readonly repo: AIRepository,
    private readonly provider: AIProvider,
    private readonly tools: CampusTools,
    private readonly audit: AIAuditService,
  ) {}

  isConfigured(): boolean {
    return this.provider.isConfigured();
  }

  private toMessageDto(msg: { role: 'user' | 'assistant'; content: string; timestamp: Date }) {
    return {
      role: msg.role,
      content: msg.content,
      createdAt: msg.timestamp.toISOString(),
    };
  }

  private deriveTitle(message: string): string {
    const trimmed = message.trim().replace(/\s+/g, ' ');
    return trimmed.length > 60 ? `${trimmed.slice(0, 57)}...` : trimmed;
  }

  private recentHistory(
    messages: Array<{ role: 'user' | 'assistant'; content: string; timestamp: Date }>,
  ) {
    const max = config.ai.maxHistoryMessages;
    return messages.slice(-max).map((m) => ({ role: m.role, content: m.content }));
  }

  private async buildToolContext(userId: string, roles: RoleName[], message: string) {
    const permissions = await getAuthorizationService().getPermissionCodes(roles);
    const ctx: ToolContext = { userId, roles, permissions };
    const toolNames = selectTools(message);
    const results = await this.tools.executeMany(toolNames, ctx);
    return { results, toolNames };
  }

  async chat(
    userId: string,
    roles: RoleName[],
    dto: ChatRequestDto,
  ): Promise<ChatResponseDto> {
    if (!this.repo.isAvailable()) {
      throw new AppError('AI conversation storage is unavailable', 503, 'SERVICE_UNAVAILABLE');
    }

    let conversation = dto.conversationId
      ? await this.repo.findConversationById(dto.conversationId, userId)
      : null;

    if (dto.conversationId && !conversation) {
      throw AppError.notFound('Conversation');
    }

    const isNew = !conversation;
    if (!conversation) {
      conversation = await this.repo.createConversation(userId, this.deriveTitle(dto.message));
      if (!conversation) {
        throw new AppError('Failed to create conversation', 500, 'INTERNAL_SERVER_ERROR');
      }
      await this.audit.logEvent({
        actorId: userId,
        action: 'aiConversationCreated',
        conversationId: String(conversation._id),
      });
      aiEvents.emit('ai.conversation.created', {
        timestamp: new Date().toISOString(),
        userId,
        conversationId: String(conversation._id),
      });
    }

    const conversationId = String(conversation._id);
    const { results: toolResults, toolNames } = await this.buildToolContext(userId, roles, dto.message);

    for (const tool of toolNames) {
      await this.audit.logToolUse(userId, conversationId, tool, true);
      aiEvents.emit('ai.tool.used', {
        timestamp: new Date().toISOString(),
        userId,
        conversationId,
        tool,
      });
    }

    const sources = toolResults.map((r) => r.source);
    const contextData = formatToolContext(toolResults);
    const history = this.recentHistory(conversation.messages);

    let assistantContent: string;

    if (!this.provider.isConfigured()) {
      assistantContent =
        'CampusVerse AI is not configured in this environment. Please ask an administrator to set GEMINI_API_KEY. ' +
        'I retrieved the following live campus context that would be used once AI is enabled:\n\n' +
        contextData.slice(0, 2000);
    } else {
      const started = Date.now();
      try {
        const generated = await this.provider.generate({
          systemInstruction: SYSTEM_PROMPT,
          messages: [...history, { role: 'user', content: dto.message }],
          contextData,
        });
        assistantContent = generated.content;
        await this.audit.logEvent({
          actorId: userId,
          action: 'aiQuery',
          conversationId,
          metadata: {
            tools: toolNames,
            latencyMs: Date.now() - started,
            model: generated.model,
            success: true,
          },
        });
        aiEvents.emit('ai.response.completed', {
          timestamp: new Date().toISOString(),
          userId,
          conversationId,
          metadata: { latencyMs: Date.now() - started },
        });
      } catch (err) {
        await this.audit.logEvent({
          actorId: userId,
          action: 'aiQuery',
          conversationId,
          metadata: {
            tools: toolNames,
            success: false,
            error: err instanceof Error ? err.message : 'unknown',
          },
        });
        aiEvents.emit('ai.error', {
          timestamp: new Date().toISOString(),
          userId,
          conversationId,
        });
        throw err;
      }
    }

    const title =
      conversation.title === 'New conversation' || isNew
        ? this.deriveTitle(dto.message)
        : undefined;

    const updated = await this.repo.appendMessages(
      conversationId,
      userId,
      [
        { role: 'user', content: dto.message },
        { role: 'assistant', content: assistantContent },
      ],
      title,
    );

    if (!updated) {
      throw AppError.notFound('Conversation');
    }

    const assistantMessage = updated.messages[updated.messages.length - 1]!;

    aiEvents.emit('ai.message.created', {
      timestamp: new Date().toISOString(),
      userId,
      conversationId,
    });

    return {
      conversationId,
      message: this.toMessageDto(assistantMessage),
      sources,
      configured: this.provider.isConfigured(),
    };
  }

  async listConversations(userId: string, query: ListConversationsQuery) {
    const result = await this.repo.listConversations(userId, query);
    const data: ConversationSummaryDto[] = result.data.map((c) => ({
      id: String(c._id),
      title: c.title ?? 'New conversation',
      messageCount: c.messages.length,
      createdAt: c.createdAt.toISOString(),
      updatedAt: c.updatedAt.toISOString(),
    }));
    return {
      data,
      meta: { pagination: buildPaginationMeta(result.total, result.page, result.limit) },
    };
  }

  async getConversation(userId: string, id: string): Promise<ConversationDetailDto> {
    const conversation = await this.repo.findConversationById(id, userId);
    if (!conversation) throw AppError.notFound('Conversation');
    return {
      id: String(conversation._id),
      title: conversation.title ?? 'New conversation',
      messages: conversation.messages.map((m) => this.toMessageDto(m)),
      createdAt: conversation.createdAt.toISOString(),
      updatedAt: conversation.updatedAt.toISOString(),
    };
  }

  async deleteConversation(userId: string, id: string): Promise<void> {
    const existing = await this.repo.findConversationById(id, userId);
    if (!existing) throw AppError.notFound('Conversation');
    const deleted = await this.repo.deleteConversation(id, userId);
    if (!deleted) throw AppError.internal('Failed to delete conversation');
    await this.audit.logEvent({
      actorId: userId,
      action: 'aiConversationDeleted',
      conversationId: id,
    });
  }
}

export { ToolsClass };
