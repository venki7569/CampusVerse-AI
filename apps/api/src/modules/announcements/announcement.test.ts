// @ts-nocheck
import assert from 'node:assert';
import {
  AnnouncementService,
} from './announcement.service';
import { AnnouncementAuditService } from './announcement.audit.service';
import { announcementEvents } from './announcement.events';
import {
  canTransitionStatus,
  isAnnouncementVisibleToUser,
  matchesAudience,
} from './announcement.visibility';
import type { AnnouncementRepository, AnnouncementWithRelations } from './announcement.repository';
import type { CreateAnnouncementDto } from './announcement.dto';
import type { RoleName } from '../../types';

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

type StoredAnnouncement = AnnouncementWithRelations & {
  notificationsSentAt: Date | null;
};

const notifications: Array<{ userId: string; title: string; type: string }> = [];
const auditLog: string[] = [];
const emitted: string[] = [];
const reads = new Set<string>();

announcementEvents.subscribe((event) => emitted.push(event));

function readKey(userId: string, announcementId: string) {
  return `${userId}:${announcementId}`;
}

function buildRepo(): AnnouncementRepository {
  let store: StoredAnnouncement[] = [];

  const author = {
    id: 'author-1',
    firstName: 'Campus',
    lastName: 'Admin',
    email: 'admin@test.local',
  };

  const makeRow = (partial: Partial<StoredAnnouncement>): StoredAnnouncement => ({
    id: partial.id ?? `ann-${store.length + 1}`,
    title: partial.title ?? 'Test',
    content: partial.content ?? 'Body',
    authorId: partial.authorId ?? 'author-1',
    category: partial.category ?? 'GENERAL',
    priority: partial.priority ?? 'NORMAL',
    status: partial.status ?? 'DRAFT',
    audienceType: partial.audienceType ?? 'ALL',
    targetRole: partial.targetRole ?? null,
    targetDepartmentId: partial.targetDepartmentId ?? null,
    targetBuildingId: partial.targetBuildingId ?? null,
    targetUserId: partial.targetUserId ?? null,
    scheduledAt: partial.scheduledAt ?? null,
    publishedAt: partial.publishedAt ?? null,
    expiresAt: partial.expiresAt ?? null,
    notificationsSentAt: partial.notificationsSentAt ?? null,
    createdAt: partial.createdAt ?? new Date(),
    updatedAt: partial.updatedAt ?? new Date(),
    author,
    targetDepartment: null,
    targetBuilding: null,
  });

  return {
    create: async (data) => {
      const row = makeRow({
        title: (data.title as string) ?? 'New',
        content: (data.content as string) ?? '',
        category: data.category as StoredAnnouncement['category'],
        priority: data.priority as StoredAnnouncement['priority'],
        status: data.status as StoredAnnouncement['status'],
        audienceType: data.audienceType as StoredAnnouncement['audienceType'],
        targetRole: data.targetRole as StoredAnnouncement['targetRole'],
        targetDepartmentId: data.targetDepartmentId as string | null,
        targetBuildingId: data.targetBuildingId as string | null,
        targetUserId: data.targetUserId as string | null,
        scheduledAt: data.scheduledAt as Date | null,
        expiresAt: data.expiresAt as Date | null,
      });
      store.push(row);
      return row;
    },
    update: async (id, data) => {
      const idx = store.findIndex((s) => s.id === id);
      if (idx === -1) throw new Error('not found');
      store[idx] = {
        ...store[idx]!,
        ...(data as Partial<StoredAnnouncement>),
        updatedAt: new Date(),
      };
      return store[idx]!;
    },
    findById: async (id) => store.find((s) => s.id === id) ?? null,
    delete: async (id) => {
      store = store.filter((s) => s.id !== id);
    },
    findMany: async (query, where) => {
      let rows = [...store];
      const w = where as Record<string, unknown>;
      if (w['status']) {
        rows = rows.filter((r) => r.status === w['status']);
      } else if (w['AND']) {
        rows = rows.filter(
          (r) =>
            (r.status === 'PUBLISHED' ||
              (r.status === 'SCHEDULED' && r.scheduledAt && r.scheduledAt <= new Date())) &&
            (!r.expiresAt || r.expiresAt > new Date()),
        );
      }
      if (query.search) {
        const q = query.search.toLowerCase();
        rows = rows.filter((r) => r.title.toLowerCase().includes(q));
      }
      const skip = (query.page - 1) * query.limit;
      return { data: rows.slice(skip, skip + query.limit), total: rows.length, page: query.page, limit: query.limit };
    },
    promoteDueScheduled: async (now = new Date()) => {
      const due = store.filter((s) => s.status === 'SCHEDULED' && s.scheduledAt && s.scheduledAt <= now);
      for (const item of due) {
        item.status = 'PUBLISHED';
        item.publishedAt = now;
      }
      return due;
    },
    markExpired: async (now = new Date()) => {
      let count = 0;
      for (const item of store) {
        if (item.status === 'PUBLISHED' && item.expiresAt && item.expiresAt <= now) {
          item.status = 'EXPIRED';
          count += 1;
        }
      }
      return count;
    },
    getReadIds: async (userId, ids) => {
      const set = new Set<string>();
      for (const id of ids) {
        if (reads.has(readKey(userId, id))) set.add(id);
      }
      return set;
    },
    markRead: async (announcementId, userId) => {
      reads.add(readKey(userId, announcementId));
    },
    countUnreadForUser: async (userId, visibleIds) => {
      return visibleIds.filter((id) => !reads.has(readKey(userId, id))).length;
    },
    resolveAudienceUserIds: async (announcement) => {
      if (announcement.audienceType === 'ALL') return ['user-a', 'user-b', 'user-c'];
      if (announcement.audienceType === 'ROLE' && announcement.targetRole === 'STUDENT') return ['user-b'];
      if (announcement.audienceType === 'DEPARTMENT' && announcement.targetDepartmentId === 'dept-cse') {
        return ['user-a'];
      }
      return [];
    },
    getUserBuildingIds: async () => ['building-1'],
    findDepartmentById: async (id) => (id === 'dept-cse' ? { id, code: 'CSE', name: 'CSE' } : null),
    findBuildingById: async (id) => (id === 'building-1' ? { id, code: 'MAIN', name: 'Main' } : null),
    findUserById: async (id) => {
      if (id === 'dept-admin') return { id, isActive: true, departmentId: 'dept-cse' };
      if (id === 'user-a') return { id, isActive: true, departmentId: 'dept-cse' };
      return { id, isActive: true, departmentId: null };
    },
    __reset: () => {
      store = [];
      reads.clear();
    },
    __seed: (rows: StoredAnnouncement[]) => {
      store = rows;
    },
  } as unknown as AnnouncementRepository & { __reset: () => void; __seed: (rows: StoredAnnouncement[]) => void };
}

const repo = buildRepo() as AnnouncementRepository & { __reset: () => void; __seed: (rows: StoredAnnouncement[]) => void };

class TestAudit extends AnnouncementAuditService {
  override async logEvent(entry: { action: string }) {
    auditLog.push(entry.action);
  }
}

function dto(partial: Partial<CreateAnnouncementDto> & Pick<CreateAnnouncementDto, 'title' | 'content'>): CreateAnnouncementDto {
  return {
    category: 'GENERAL',
    priority: 'NORMAL',
    audienceType: 'ALL',
    ...partial,
  } as CreateAnnouncementDto;
}

function campusAdmin() {
  return {
    userId: 'author-1',
    roles: ['CAMPUS_ADMIN'] as RoleName[],
    departmentId: null,
    permissions: new Set([
      'announcement.view',
      'announcement.create',
      'announcement.update',
      'announcement.publish',
      'announcement.delete',
      'announcement.manage',
    ]),
  };
}

function deptAdmin() {
  return {
    userId: 'dept-admin',
    roles: ['DEPARTMENT_ADMIN'] as RoleName[],
    departmentId: 'dept-cse',
    permissions: new Set(['announcement.view', 'announcement.create', 'announcement.update', 'announcement.publish']),
  };
}

function student() {
  return {
    userId: 'user-b',
    roles: ['STUDENT'] as RoleName[],
    departmentId: null,
    permissions: new Set(['announcement.view']),
  };
}

async function runTests() {
  console.log('\nANNOUNCEMENT MODULE TESTS\n');
  const notifyFn = async (input: { userId: string; title: string; type: string }) => {
    notifications.push(input);
    return input;
  };
  const service = new AnnouncementService(repo, new TestAudit(), notifyFn);

  await test('visibility: draft hidden from users', () => {
    assert.strictEqual(
      isAnnouncementVisibleToUser(
        { status: 'DRAFT', audienceType: 'ALL', targetRole: null, targetDepartmentId: null, targetBuildingId: null, targetUserId: null, scheduledAt: null, publishedAt: null, expiresAt: null },
        { id: 'u1', roles: ['STUDENT'], departmentId: null },
      ),
      false,
    );
  });

  await test('visibility: scheduled before time hidden', () => {
    const future = new Date(Date.now() + 86400000);
    assert.strictEqual(
      isAnnouncementVisibleToUser(
        { status: 'SCHEDULED', audienceType: 'ALL', targetRole: null, targetDepartmentId: null, targetBuildingId: null, targetUserId: null, scheduledAt: future, publishedAt: null, expiresAt: null },
        { id: 'u1', roles: ['STUDENT'], departmentId: null },
      ),
      false,
    );
  });

  await test('visibility: role targeting enforced', () => {
    assert.strictEqual(
      matchesAudience(
        { status: 'PUBLISHED', audienceType: 'ROLE', targetRole: 'FACULTY', targetDepartmentId: null, targetBuildingId: null, targetUserId: null, scheduledAt: null, publishedAt: new Date(), expiresAt: null },
        { id: 'u1', roles: ['STUDENT'], departmentId: null },
      ),
      false,
    );
    assert.strictEqual(
      matchesAudience(
        { status: 'PUBLISHED', audienceType: 'ROLE', targetRole: 'FACULTY', targetDepartmentId: null, targetBuildingId: null, targetUserId: null, scheduledAt: null, publishedAt: new Date(), expiresAt: null },
        { id: 'u2', roles: ['FACULTY'], departmentId: null },
      ),
      true,
    );
  });

  await test('lifecycle transitions reject invalid paths', () => {
    assert.strictEqual(canTransitionStatus('EXPIRED', 'PUBLISHED'), false);
    assert.strictEqual(canTransitionStatus('CANCELLED', 'PUBLISHED'), false);
    assert.strictEqual(canTransitionStatus('DRAFT', 'PUBLISHED'), true);
  });

  await test('create announcement draft', async () => {
    repo.__reset();
    auditLog.length = 0;
    emitted.length = 0;
    const created = await service.create(campusAdmin(), {
      title: 'Welcome',
      content: 'Semester begins Monday',
      category: 'GENERAL',
      priority: 'NORMAL',
      audienceType: 'ALL',
    });
    assert.strictEqual(created.status, 'DRAFT');
    assert.ok(auditLog.includes('announcementCreated'));
    assert.ok(emitted.includes('announcement.created'));
  });

  await test('department admin cannot target other departments', async () => {
    repo.__reset();
    await assert.rejects(() =>
      service.create(deptAdmin(), {
        title: 'Other dept',
        content: 'Not allowed',
        category: 'GENERAL',
        priority: 'NORMAL',
        audienceType: 'DEPARTMENT',
        targetDepartmentId: 'dept-ee',
      }),
    );
  });

  await test('publish sends notifications once', async () => {
    repo.__reset();
    notifications.length = 0;
    const draft = await service.create(campusAdmin(), {
      title: 'Exam schedule',
      content: 'Final exams next week',
      category: 'EXAMINATION',
      priority: 'HIGH',
      audienceType: 'ALL',
    });
    await service.publish(campusAdmin(), draft.id);
    assert.ok(notifications.length >= 1);
    const firstCount = notifications.length;
    await assert.rejects(() => service.publish(campusAdmin(), draft.id));
    assert.strictEqual(notifications.length, firstCount);
    const row = await repo.findById(draft.id);
    assert.ok(row?.notificationsSentAt);
  });

  await test('scheduled announcement not visible before time', async () => {
    repo.__reset();
    const future = new Date(Date.now() + 3600000);
    const created = await service.create(campusAdmin(), {
      title: 'Future notice',
      content: 'Later',
      category: 'GENERAL',
      priority: 'NORMAL',
      audienceType: 'ALL',
      scheduledAt: future,
    });
    assert.strictEqual(created.status, 'SCHEDULED');
    const feed = await service.list(student(), { page: 1, limit: 10 });
    assert.strictEqual(feed.data.length, 0);
  });

  await test('published announcement visible in feed', async () => {
    repo.__reset();
    const draft = await service.create(campusAdmin(), {
      title: 'Open now',
      content: 'Available',
      category: 'GENERAL',
      priority: 'NORMAL',
      audienceType: 'ALL',
    });
    await service.publish(campusAdmin(), draft.id);
    const feed = await service.list(student(), { page: 1, limit: 10 });
    assert.ok(feed.data.some((a) => a.id === draft.id));
  });

  await test('mark read and unread count', async () => {
    repo.__reset();
    const draft = await service.create(campusAdmin(), {
      title: 'Read me',
      content: 'Content',
      category: 'GENERAL',
      priority: 'NORMAL',
      audienceType: 'ALL',
    });
    await service.publish(campusAdmin(), draft.id);
    const before = await service.getUnreadCount(student());
    assert.ok(before.unreadCount >= 1);
    await service.markRead(student(), draft.id);
    const after = await service.getUnreadCount(student());
    assert.ok(after.unreadCount < before.unreadCount);
    assert.ok(auditLog.includes('announcementRead'));
    assert.ok(emitted.includes('announcement.read'));
  });

  await test('archive invalid from published allowed', async () => {
    repo.__reset();
    const draft = await service.create(campusAdmin(), {
      title: 'Archive me',
      content: 'Done',
      category: 'GENERAL',
      priority: 'NORMAL',
      audienceType: 'ALL',
    });
    await service.publish(campusAdmin(), draft.id);
    const archived = await service.archive(campusAdmin(), draft.id);
    assert.strictEqual(archived.status, 'ARCHIVED');
  });

  await test('cancel scheduled announcement', async () => {
    repo.__reset();
    const future = new Date(Date.now() + 3600000);
    const draft = await service.create(campusAdmin(), {
      title: 'Cancel me',
      content: 'No longer needed',
      category: 'GENERAL',
      priority: 'NORMAL',
      audienceType: 'ALL',
      scheduledAt: future,
    });
    const cancelled = await service.cancel(campusAdmin(), draft.id);
    assert.strictEqual(cancelled.status, 'CANCELLED');
  });

  await test('role-targeted notifications respect audience', async () => {
    repo.__reset();
    notifications.length = 0;
    const draft = await service.create(campusAdmin(), {
      title: 'Students only',
      content: 'Hello students',
      category: 'ACADEMIC',
      priority: 'NORMAL',
      audienceType: 'ROLE',
      targetRole: 'STUDENT',
    });
    await service.publish(campusAdmin(), draft.id);
    assert.ok(notifications.every((n) => n.userId === 'user-b'));
  });

  await test('AI listForAI returns only visible announcements', async () => {
    repo.__reset();
    const draft = await service.create(campusAdmin(), {
      title: 'Dept only',
      content: 'CSE',
      category: 'ACADEMIC',
      priority: 'NORMAL',
      audienceType: 'DEPARTMENT',
      targetDepartmentId: 'dept-cse',
    });
    await service.publish(campusAdmin(), draft.id);
    const visible = await service.listForAI('user-a', ['FACULTY'], 'dept-cse');
    const hidden = await service.listForAI('user-b', ['STUDENT'], null);
    assert.ok(visible.length >= 1);
    assert.strictEqual(hidden.length, 0);
  });

  console.log(`\nANNOUNCEMENTS: ${passed}/${total} passed\n`);
  if (passed !== total) process.exit(1);
}

runTests();
