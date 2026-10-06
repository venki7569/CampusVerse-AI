import assert from 'node:assert';
import { AIService } from './ai.service';
import type { AIProvider } from './ai.provider';
import type { AIRepository } from './ai.repository';
import type { CampusTools, ToolContext, ToolExecutionResult } from './ai.tools';
import { selectTools, formatToolContext, CampusTools as CampusToolsClass } from './ai.tools';
import { AIAuditService } from './ai.audit.service';
import { aiEvents } from './ai.events';
import { GeminiProvider } from './ai.provider';
import { initAuthorizationService } from '../admin/authorization.service';
import { config } from '../../config/env';
import { aiRateLimiter } from '../../middleware/rateLimiter.middleware';
import type { IAIConversation } from '../database/mongodb/schemas/aiConversation.schema';

let passed = 0;
let total = 0;

async function test(name: string, fn: () => Promise<void> | void): Promise<void> {
  total += 1;
  try {
    await fn();
    passed += 1;
    console.log(`  PASS  ${name}`);
  } catch (err) {
    console.error(`  FAIL  ${name}`);
    console.error(err);
  }
}

type StoredConversation = {
  _id: { toString(): string };
  userId: string;
  title: string;
  messages: Array<{ role: 'user' | 'assistant'; content: string; timestamp: Date }>;
  context: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
};

let idCounter = 0;
let store: StoredConversation[] = [];
const auditLog: Array<{ action: string; metadata?: Record<string, unknown> }> = [];
const emitted: Array<{ event: string; payload: unknown }> = [];

function makeId(): { toString(): string } {
  idCounter += 1;
  return { toString: () => `conv${idCounter}`.padStart(24, '0') };
}

function asDoc(item: StoredConversation): IAIConversation {
  return item as unknown as IAIConversation;
}

function buildRepo(): AIRepository {
  return {
    isAvailable: () => true,
    warnUnavailable: () => undefined,
    createConversation: async (userId: string, title = 'New conversation') => {
      const doc: StoredConversation = {
        _id: makeId(),
        userId,
        title,
        messages: [],
        context: {},
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      store.push(doc);
      return asDoc(doc);
    },
    findConversationById: async (id: string, userId: string) => {
      const found = store.find((c) => c._id.toString() === id && c.userId === userId);
      return found ? asDoc(found) : null;
    },
    listConversations: async (userId: string, query: { page: number; limit: number; search?: string }) => {
      let rows = store.filter((c) => c.userId === userId);
      if (query.search) {
        const q = query.search.toLowerCase();
        rows = rows.filter((c) => c.title.toLowerCase().includes(q));
      }
      const skip = (query.page - 1) * query.limit;
      return {
        data: rows.slice(skip, skip + query.limit).map(asDoc),
        total: rows.length,
        page: query.page,
        limit: query.limit,
      };
    },
    appendMessages: async (
      id: string,
      userId: string,
      entries: Array<{ role: 'user' | 'assistant'; content: string }>,
      title?: string,
    ) => {
      const found = store.find((c) => c._id.toString() === id && c.userId === userId);
      if (!found) return null;
      const now = new Date();
      for (const entry of entries) {
        found.messages.push({ ...entry, timestamp: now });
      }
      if (title) found.title = title;
      found.updatedAt = now;
      return asDoc(found);
    },
    deleteConversation: async (id: string, userId: string) => {
      const idx = store.findIndex((c) => c._id.toString() === id && c.userId === userId);
      if (idx === -1) return false;
      store.splice(idx, 1);
      return true;
    },
    updateTitle: async () => null,
  } as unknown as AIRepository;
}

function buildMockProvider(options?: {
  configured?: boolean;
  content?: string;
  shouldFail?: boolean;
}): AIProvider {
  return {
    isConfigured: () => options?.configured ?? true,
    generate: async () => {
      if (options?.shouldFail) {
        throw new Error('Provider failure');
      }
      return {
        content: options?.content ?? 'Based on campus data, Main Building has 2 open maintenance issues.',
        model: 'mock-gemini',
      };
    },
  };
}

function buildMockTools(results?: ToolExecutionResult[]): CampusTools {
  const defaultResults: ToolExecutionResult[] = results ?? [
    {
      tool: 'getCampusOverview',
      data: { kpis: { buildings: 3 } },
      source: { type: 'dashboard', label: 'Live Dashboard', period: 'Current snapshot' },
    },
  ];
  return {
    executeMany: async () => defaultResults,
    execute: async (tool: string) =>
      defaultResults.find((r) => r.tool === tool) ?? defaultResults[0]!,
  } as unknown as CampusTools;
}

function buildAudit(): AIAuditService {
  return {
    logEvent: async (entry: { action: string; metadata?: Record<string, unknown> }) => {
      auditLog.push({ action: entry.action, metadata: entry.metadata });
    },
    logToolUse: async (_actorId: string, _conversationId: string, tool: string, success: boolean) => {
      auditLog.push({ action: 'aiToolUsed', metadata: { tool, success } });
    },
  } as unknown as AIAuditService;
}

function buildAuthDb(permissionsByRole: Record<string, string[]>) {
  return {
    rolePermission: {
      findMany: async ({ where }: { where: { role: { name: string } } }) => {
        const role = where.role.name;
        return (permissionsByRole[role] ?? []).map((code) => {
          const [resource, action] = code.split('.');
          return { permission: { resource, action } };
        });
      },
    },
  } as never;
}

async function runTests(): Promise<void> {
  console.log('\nAI Module Tests\n');

  aiEvents.subscribe((event, payload) => {
    emitted.push({ event, payload });
  });

  await test('selectTools picks maintenance for maintenance questions', () => {
    const tools = selectTools('Which buildings have maintenance issues?');
    assert.ok(tools.includes('getMaintenanceSummary'));
    assert.ok(tools.includes('getBuildings'));
  });

  await test('selectTools picks alerts for notification questions', () => {
    const tools = selectTools('Show today alerts and notifications');
    assert.ok(tools.includes('getAlerts'));
  });

  await test('selectTools defaults to campus overview', () => {
    const tools = selectTools('hello there');
    assert.deepStrictEqual(tools, ['getCampusOverview']);
  });

  await test('selectTools limits to five tools', () => {
    const tools = selectTools(
      'campus summary buildings departments assets maintenance electricity water parking analytics room occupancy alerts',
    );
    assert.ok(tools.length <= 5);
  });

  await test('formatToolContext serializes tool results', () => {
    const json = formatToolContext([
      {
        tool: 'getBuildings',
        data: { count: 2 },
        source: { type: 'buildings', label: 'Building Registry' },
      },
    ]);
    assert.ok(json.includes('Building Registry'));
    assert.ok(json.includes('getBuildings'));
  });

  await test('GeminiProvider reports unconfigured without API key', () => {
    const original = config.gemini.apiKey;
    (config.gemini as { apiKey: string }).apiKey = '';
    const provider = new GeminiProvider();
    assert.strictEqual(provider.isConfigured(), false);
    (config.gemini as { apiKey: string }).apiKey = original;
  });

  await test('AIService creates conversation on first chat message', async () => {
    store = [];
    auditLog.length = 0;
    emitted.length = 0;
    initAuthorizationService(buildAuthDb({ STUDENT: ['ai.use', 'parking.view'] }));

    const service = new AIService(buildRepo(), buildMockProvider(), buildMockTools(), buildAudit());
    const result = await service.chat('user-1', ['STUDENT'], { message: 'Campus overview please' });

    assert.ok(result.conversationId);
    assert.strictEqual(result.message.role, 'assistant');
    assert.ok(result.sources.length > 0);
    assert.strictEqual(store.length, 1);
    assert.ok(auditLog.some((e) => e.action === 'aiConversationCreated'));
    assert.ok(emitted.some((e) => e.event === 'ai.conversation.created'));
  });

  await test('AIService continues existing conversation', async () => {
    store = [];
    initAuthorizationService(buildAuthDb({ FACULTY: ['ai.use', 'analytics.view'] }));
    const service = new AIService(buildRepo(), buildMockProvider(), buildMockTools(), buildAudit());

    const first = await service.chat('user-1', ['FACULTY'], { message: 'First question' });
    const second = await service.chat('user-1', ['FACULTY'], {
      conversationId: first.conversationId,
      message: 'Follow up question',
    });

    assert.strictEqual(first.conversationId, second.conversationId);
    const conv = store[0]!;
    assert.strictEqual(conv.messages.length, 4);
  });

  await test('AIService enforces conversation ownership', async () => {
    store = [];
    initAuthorizationService(buildAuthDb({ STUDENT: ['ai.use'] }));
    const service = new AIService(buildRepo(), buildMockProvider(), buildMockTools(), buildAudit());

    const created = await service.chat('user-a', ['STUDENT'], { message: 'Private chat' });
    await assert.rejects(
      () => service.getConversation('user-b', created.conversationId),
      (err: Error) => err.message.includes('Conversation'),
    );
  });

  await test('AIService rejects chat for unknown conversation id', async () => {
    store = [];
    initAuthorizationService(buildAuthDb({ STUDENT: ['ai.use'] }));
    const service = new AIService(buildRepo(), buildMockProvider(), buildMockTools(), buildAudit());

    await assert.rejects(
      () =>
        service.chat('user-1', ['STUDENT'], {
          conversationId: '000000000000000000000099',
          message: 'Hello',
        }),
      (err: Error) => err.message.includes('Conversation'),
    );
  });

  await test('AIService lists and deletes conversations for owner only', async () => {
    store = [];
    initAuthorizationService(buildAuthDb({ STUDENT: ['ai.use'] }));
    const service = new AIService(buildRepo(), buildMockProvider(), buildMockTools(), buildAudit());

    await service.chat('owner', ['STUDENT'], { message: 'My conversation' });
    const list = await service.listConversations('owner', { page: 1, limit: 10 });
    assert.strictEqual(list.data.length, 1);

    const id = list.data[0]!.id;
    await service.deleteConversation('owner', id);
    assert.strictEqual(store.length, 0);
    assert.ok(auditLog.some((e) => e.action === 'aiConversationDeleted'));
  });

  await test('AIService handles missing Gemini configuration gracefully', async () => {
    store = [];
    auditLog.length = 0;
    initAuthorizationService(buildAuthDb({ STUDENT: ['ai.use'] }));
    const service = new AIService(
      buildRepo(),
      buildMockProvider({ configured: false }),
      buildMockTools(),
      buildAudit(),
    );

    const result = await service.chat('user-1', ['STUDENT'], { message: 'What is the campus status?' });
    assert.strictEqual(result.configured, false);
    assert.ok(result.message.content.includes('not configured'));
  });

  await test('AIService propagates provider errors and logs failure', async () => {
    store = [];
    auditLog.length = 0;
    emitted.length = 0;
    initAuthorizationService(buildAuthDb({ STUDENT: ['ai.use'] }));
    const service = new AIService(
      buildRepo(),
      buildMockProvider({ shouldFail: true }),
      buildMockTools(),
      buildAudit(),
    );

    await assert.rejects(() => service.chat('user-1', ['STUDENT'], { message: 'Trigger error' }));
    assert.ok(auditLog.some((e) => e.action === 'aiQuery' && e.metadata?.['success'] === false));
    assert.ok(emitted.some((e) => e.event === 'ai.error'));
  });

  await test('AIService records tool usage audit and events', async () => {
    store = [];
    auditLog.length = 0;
    emitted.length = 0;
    initAuthorizationService(buildAuthDb({ CAMPUS_ADMIN: ['ai.use', 'analytics.view'] }));
    const service = new AIService(
      buildRepo(),
      buildMockProvider(),
      buildMockTools([
        {
          tool: 'getMaintenanceSummary',
          data: { open: 2 },
          source: { type: 'maintenance', label: 'Maintenance Records' },
        },
      ]),
      buildAudit(),
    );

    await service.chat('admin-1', ['CAMPUS_ADMIN'], { message: 'Any maintenance issues today?' });
    assert.ok(auditLog.some((e) => e.action === 'aiToolUsed'));
    assert.ok(emitted.some((e) => e.event === 'ai.tool.used'));
    assert.ok(emitted.some((e) => e.event === 'ai.response.completed'));
    assert.ok(emitted.some((e) => e.event === 'ai.message.created'));
  });

  await test('AIService returns source references from tools', async () => {
    store = [];
    initAuthorizationService(buildAuthDb({ FACULTY: ['ai.use', 'analytics.view'] }));
    const service = new AIService(
      buildRepo(),
      buildMockProvider({ content: 'Electricity consumption is 1200 kWh this month.' }),
      buildMockTools([
        {
          tool: 'getElectricitySummary',
          data: { monthly: 1200 },
          source: { type: 'electricity', label: 'Electricity Analytics', period: 'Last 30 days' },
        },
      ]),
      buildAudit(),
    );

    const result = await service.chat('faculty-1', ['FACULTY'], {
      message: 'How is electricity consumption this month?',
    });
    assert.ok(result.sources.some((s) => s.label === 'Electricity Analytics'));
  });

  await test('CampusTools denies parking without parking.view permission', async () => {
    const parking = {
      getAvailability: async () => {
        throw new Error('Should not be called');
      },
    };
    const tools = new CampusToolsClass({} as never, {} as never, {} as never, parking as never, {} as never);
    const ctx: ToolContext = {
      userId: 'u1',
      roles: ['STUDENT'],
      permissions: new Set(['ai.use']),
    };
    const result = await tools.execute('getParkingAvailability', ctx);
    assert.strictEqual(result.denied, true);
    assert.ok((result.data as { message: string }).message.includes('permission'));
  });

  await test('CampusTools allows parking with parking.view permission', async () => {
    const parking = {
      getAvailability: async () => ({ total: 50, available: 12, occupied: 38 }),
    };
    const tools = new CampusToolsClass({} as never, {} as never, {} as never, parking as never, {} as never);
    const ctx: ToolContext = {
      userId: 'u1',
      roles: ['STUDENT'],
      permissions: new Set(['ai.use', 'parking.view']),
    };
    const result = await tools.execute('getParkingAvailability', ctx);
    assert.strictEqual(result.denied, undefined);
    assert.strictEqual((result.data as { available: number }).available, 12);
  });

  await test('CampusTools denies analytics overview without analytics.view', async () => {
    const analytics = {
      getOverview: async () => {
        throw new Error('Should not be called');
      },
    };
    const tools = new CampusToolsClass({} as never, {} as never, analytics as never, {} as never, {} as never);
    const ctx: ToolContext = {
      userId: 'u1',
      roles: ['STUDENT'],
      permissions: new Set(['ai.use', 'parking.view']),
    };
    const result = await tools.execute('getAnalyticsOverview', ctx);
    assert.strictEqual(result.denied, true);
  });

  await test('AI rate limiter is configured with stricter limits', () => {
    assert.ok(config.ai.chatRateLimitMax <= config.rateLimit.max);
    assert.ok(typeof aiRateLimiter === 'function');
  });

  await test('AIService truncates history based on config', async () => {
    store = [];
    initAuthorizationService(buildAuthDb({ STUDENT: ['ai.use'] }));
    const providerCalls: number[] = [];
    const provider: AIProvider = {
      isConfigured: () => true,
      generate: async (input) => {
        providerCalls.push(input.messages.length);
        return { content: 'ok', model: 'mock' };
      },
    };
    const service = new AIService(buildRepo(), provider, buildMockTools(), buildAudit());
    const first = await service.chat('user-1', ['STUDENT'], { message: 'Start' });

    for (let i = 0; i < 10; i += 1) {
      await service.chat('user-1', ['STUDENT'], {
        conversationId: first.conversationId,
        message: `Message ${i}`,
      });
    }
    assert.ok(providerCalls.length > 0);
    const lastCallCount = providerCalls[providerCalls.length - 1]!;
    assert.ok(lastCallCount <= config.ai.maxHistoryMessages + 1);
  });

  console.log(`\nAI: ${passed}/${total} passed\n`);
  if (passed !== total) process.exit(1);
}

runTests();
