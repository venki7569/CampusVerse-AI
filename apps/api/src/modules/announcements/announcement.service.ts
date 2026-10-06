import {
  AnnouncementStatus,
  type Announcement,
  type AnnouncementAudienceType,
  type RoleName,
} from '@prisma/client';
import { AppError } from '../../utils/AppError';
import { buildPaginationMeta } from '../../utils/pagination';
import { createLogger } from '../../utils/logger';
import { publishNotification } from '../notifications/notification.service';
import type { CreateNotificationInput } from '../notifications/notification.repository';
import type { AnnouncementRepository, AnnouncementWithRelations } from './announcement.repository';
import type { AnnouncementAuditService } from './announcement.audit.service';
import { announcementEvents } from './announcement.events';
import {
  canTransitionStatus,
  isAnnouncementVisibleToUser,
  priorityToNotificationSeverity,
  type AnnouncementViewer,
} from './announcement.visibility';
import type {
  AnnouncementDto,
  AnnouncementFeedSummary,
  CreateAnnouncementDto,
  ListAnnouncementsQuery,
  ScheduleAnnouncementDto,
  UpdateAnnouncementDto,
} from './announcement.dto';

const log = createLogger('AnnouncementService');

type ActorContext = {
  userId: string;
  roles: RoleName[];
  departmentId: string | null;
  permissions: Set<string>;
};

export class AnnouncementService {
  constructor(
    private readonly repo: AnnouncementRepository,
    private readonly audit: AnnouncementAuditService,
    private readonly notifyFn: (input: CreateNotificationInput) => Promise<unknown> = publishNotification,
  ) {}

  private toDto(row: AnnouncementWithRelations, isRead?: boolean): AnnouncementDto {
    return {
      id: row.id,
      title: row.title,
      content: row.content,
      category: row.category,
      priority: row.priority,
      status: row.status,
      audienceType: row.audienceType,
      targetRole: row.targetRole,
      targetDepartmentId: row.targetDepartmentId,
      targetBuildingId: row.targetBuildingId,
      targetUserId: row.targetUserId,
      scheduledAt: row.scheduledAt?.toISOString() ?? null,
      publishedAt: row.publishedAt?.toISOString() ?? null,
      expiresAt: row.expiresAt?.toISOString() ?? null,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
      author: row.author,
      targetDepartment: row.targetDepartment,
      targetBuilding: row.targetBuilding,
      isRead,
    };
  }

  private canManageAll(actor: ActorContext): boolean {
    if (actor.roles.includes('SUPER_ADMIN') || actor.roles.includes('CAMPUS_ADMIN')) return true;
    return actor.permissions.has('announcement.manage');
  }

  private canCreate(actor: ActorContext): boolean {
    return (
      this.canManageAll(actor) ||
      actor.permissions.has('announcement.create') ||
      actor.permissions.has('announcement.update')
    );
  }

  private async buildViewer(userId: string, roles: RoleName[], departmentId: string | null): Promise<AnnouncementViewer> {
    const buildingIds = await this.repo.getUserBuildingIds(userId);
    return { id: userId, roles, departmentId, buildingIds };
  }

  private assertEditableStatus(status: AnnouncementStatus): void {
    if (!['DRAFT', 'SCHEDULED'].includes(status)) {
      throw AppError.badRequest('Only draft or scheduled announcements can be edited');
    }
  }

  private async validateTargeting(
    actor: ActorContext,
    input: {
      audienceType: AnnouncementAudienceType;
      targetRole?: RoleName | null;
      targetDepartmentId?: string | null;
      targetBuildingId?: string | null;
      targetUserId?: string | null;
    },
  ): Promise<void> {
    const isDeptAdminOnly =
      actor.roles.includes('DEPARTMENT_ADMIN') &&
      !this.canManageAll(actor);

    if (isDeptAdminOnly) {
      if (!actor.departmentId) {
        throw AppError.forbidden('Department admin must belong to a department');
      }
      if (input.audienceType === 'ALL' || input.audienceType === 'BUILDING') {
        throw AppError.forbidden('Department admins can only target their department, a role, or specific users');
      }
      if (input.audienceType === 'DEPARTMENT' && input.targetDepartmentId !== actor.departmentId) {
        throw AppError.forbidden('Department admins can only target their own department');
      }
    }

    if (input.audienceType === 'DEPARTMENT' && input.targetDepartmentId) {
      const dept = await this.repo.findDepartmentById(input.targetDepartmentId);
      if (!dept) throw AppError.badRequest('Invalid target department');
    }
    if (input.audienceType === 'BUILDING' && input.targetBuildingId) {
      const building = await this.repo.findBuildingById(input.targetBuildingId);
      if (!building) throw AppError.badRequest('Invalid target building');
    }
    if (input.audienceType === 'USER' && input.targetUserId) {
      const user = await this.repo.findUserById(input.targetUserId);
      if (!user || !user.isActive) throw AppError.badRequest('Invalid target user');
    }
  }

  private normalizeTargetFields(audienceType: AnnouncementAudienceType) {
    return {
      targetRole: audienceType === 'ROLE' ? undefined : null,
      targetDepartmentId: audienceType === 'DEPARTMENT' ? undefined : null,
      targetBuildingId: audienceType === 'BUILDING' ? undefined : null,
      targetUserId: audienceType === 'USER' ? undefined : null,
    };
  }

  async syncLifecycle(): Promise<void> {
    const promoted = await this.repo.promoteDueScheduled();
    for (const item of promoted) {
      if (!item.notificationsSentAt) {
        await this.sendNotifications(item);
      }
    }
    await this.repo.markExpired();
  }

  async create(actor: ActorContext, dto: CreateAnnouncementDto): Promise<AnnouncementDto> {
    if (!this.canCreate(actor)) throw AppError.forbidden('Insufficient permissions to create announcements');

    await this.validateTargeting(actor, dto);

    const created = await this.repo.create({
      title: dto.title,
      content: dto.content,
      category: dto.category,
      priority: dto.priority,
      audienceType: dto.audienceType,
      authorId: actor.userId,
      targetRole: dto.audienceType === 'ROLE' ? dto.targetRole ?? null : null,
      targetDepartmentId: dto.audienceType === 'DEPARTMENT' ? dto.targetDepartmentId ?? null : null,
      targetBuildingId: dto.audienceType === 'BUILDING' ? dto.targetBuildingId ?? null : null,
      targetUserId: dto.audienceType === 'USER' ? dto.targetUserId ?? null : null,
      scheduledAt: dto.scheduledAt ?? null,
      expiresAt: dto.expiresAt ?? null,
      status: dto.scheduledAt ? 'SCHEDULED' : 'DRAFT',
    });

    await this.audit.logEvent({
      actorId: actor.userId,
      action: 'announcementCreated',
      announcementId: created.id,
      metadata: { status: created.status, audienceType: created.audienceType },
    });
    announcementEvents.emit('announcement.created', {
      timestamp: new Date().toISOString(),
      announcementId: created.id,
      actorId: actor.userId,
    });

    if (created.status === 'SCHEDULED') {
      await this.audit.logEvent({
        actorId: actor.userId,
        action: 'announcementScheduled',
        announcementId: created.id,
        metadata: { scheduledAt: created.scheduledAt?.toISOString() },
      });
      announcementEvents.emit('announcement.scheduled', {
        timestamp: new Date().toISOString(),
        announcementId: created.id,
        actorId: actor.userId,
      });
    }

    return this.toDto(created, false);
  }

  async update(actor: ActorContext, id: string, dto: UpdateAnnouncementDto): Promise<AnnouncementDto> {
    if (!this.canCreate(actor)) throw AppError.forbidden('Insufficient permissions to update announcements');

    const existing = await this.repo.findById(id);
    if (!existing) throw AppError.notFound('Announcement');
    this.assertEditableStatus(existing.status);

    const audienceType = dto.audienceType ?? existing.audienceType;
    await this.validateTargeting(actor, {
      audienceType,
      targetRole: dto.targetRole === undefined ? existing.targetRole : dto.targetRole,
      targetDepartmentId:
        dto.targetDepartmentId === undefined ? existing.targetDepartmentId : dto.targetDepartmentId,
      targetBuildingId:
        dto.targetBuildingId === undefined ? existing.targetBuildingId : dto.targetBuildingId,
      targetUserId: dto.targetUserId === undefined ? existing.targetUserId : dto.targetUserId,
    });

    const cleared = this.normalizeTargetFields(audienceType);
    const updated = await this.repo.update(id, {
      title: dto.title,
      content: dto.content,
      category: dto.category,
      priority: dto.priority,
      audienceType,
      targetRole: dto.targetRole !== undefined ? dto.targetRole : audienceType === 'ROLE' ? existing.targetRole : cleared.targetRole,
      targetDepartmentId:
        dto.targetDepartmentId !== undefined
          ? dto.targetDepartmentId
          : audienceType === 'DEPARTMENT'
            ? existing.targetDepartmentId
            : cleared.targetDepartmentId,
      targetBuildingId:
        dto.targetBuildingId !== undefined
          ? dto.targetBuildingId
          : audienceType === 'BUILDING'
            ? existing.targetBuildingId
            : cleared.targetBuildingId,
      targetUserId:
        dto.targetUserId !== undefined
          ? dto.targetUserId
          : audienceType === 'USER'
            ? existing.targetUserId
            : cleared.targetUserId,
      scheduledAt: dto.scheduledAt !== undefined ? dto.scheduledAt : undefined,
      expiresAt: dto.expiresAt !== undefined ? dto.expiresAt : undefined,
    });

    await this.audit.logEvent({
      actorId: actor.userId,
      action: 'announcementUpdated',
      announcementId: id,
    });
    announcementEvents.emit('announcement.updated', {
      timestamp: new Date().toISOString(),
      announcementId: id,
      actorId: actor.userId,
    });

    return this.toDto(updated);
  }

  async delete(actor: ActorContext, id: string): Promise<void> {
    if (!this.canManageAll(actor) && !actor.permissions.has('announcement.delete')) {
      throw AppError.forbidden('Insufficient permissions to delete announcements');
    }
    const existing = await this.repo.findById(id);
    if (!existing) throw AppError.notFound('Announcement');
    await this.repo.delete(id);
    await this.audit.logEvent({
      actorId: actor.userId,
      action: 'announcementArchived',
      announcementId: id,
      metadata: { deleted: true },
    });
  }

  async schedule(actor: ActorContext, id: string, dto: ScheduleAnnouncementDto): Promise<AnnouncementDto> {
    if (!actor.permissions.has('announcement.publish') && !this.canManageAll(actor)) {
      throw AppError.forbidden('Insufficient permissions to schedule announcements');
    }
    const existing = await this.repo.findById(id);
    if (!existing) throw AppError.notFound('Announcement');
    if (!canTransitionStatus(existing.status, 'SCHEDULED')) {
      throw AppError.badRequest(`Cannot schedule announcement from status ${existing.status}`);
    }

    await this.validateTargeting(actor, existing);

    const updated = await this.repo.update(id, {
      status: 'SCHEDULED',
      scheduledAt: dto.scheduledAt,
      expiresAt: dto.expiresAt ?? existing.expiresAt,
    });

    await this.audit.logEvent({
      actorId: actor.userId,
      action: 'announcementScheduled',
      announcementId: id,
      metadata: { scheduledAt: dto.scheduledAt.toISOString() },
    });
    announcementEvents.emit('announcement.scheduled', {
      timestamp: new Date().toISOString(),
      announcementId: id,
      actorId: actor.userId,
    });

    return this.toDto(updated);
  }

  async publish(actor: ActorContext, id: string): Promise<AnnouncementDto> {
    if (!actor.permissions.has('announcement.publish') && !this.canManageAll(actor)) {
      throw AppError.forbidden('Insufficient permissions to publish announcements');
    }
    const existing = await this.repo.findById(id);
    if (!existing) throw AppError.notFound('Announcement');
    if (!canTransitionStatus(existing.status, 'PUBLISHED')) {
      throw AppError.badRequest(`Cannot publish announcement from status ${existing.status}`);
    }

    await this.validateTargeting(actor, existing);

    const now = new Date();
    const updated = await this.repo.update(id, {
      status: 'PUBLISHED',
      publishedAt: now,
      scheduledAt: existing.scheduledAt ?? now,
    });

    await this.sendNotifications(updated);
    await this.audit.logEvent({
      actorId: actor.userId,
      action: 'announcementPublished',
      announcementId: id,
      metadata: { priority: updated.priority, audienceType: updated.audienceType },
    });
    announcementEvents.emit('announcement.published', {
      timestamp: now.toISOString(),
      announcementId: id,
      actorId: actor.userId,
    });

    return this.toDto(updated);
  }

  async cancel(actor: ActorContext, id: string): Promise<AnnouncementDto> {
    if (!this.canCreate(actor)) throw AppError.forbidden('Insufficient permissions to cancel announcements');
    const existing = await this.repo.findById(id);
    if (!existing) throw AppError.notFound('Announcement');
    if (!canTransitionStatus(existing.status, 'CANCELLED')) {
      throw AppError.badRequest(`Cannot cancel announcement from status ${existing.status}`);
    }

    const updated = await this.repo.update(id, { status: 'CANCELLED' });
    await this.audit.logEvent({
      actorId: actor.userId,
      action: 'announcementCancelled',
      announcementId: id,
    });
    announcementEvents.emit('announcement.cancelled', {
      timestamp: new Date().toISOString(),
      announcementId: id,
      actorId: actor.userId,
    });
    return this.toDto(updated);
  }

  async archive(actor: ActorContext, id: string): Promise<AnnouncementDto> {
    if (!this.canCreate(actor)) throw AppError.forbidden('Insufficient permissions to archive announcements');
    const existing = await this.repo.findById(id);
    if (!existing) throw AppError.notFound('Announcement');
    if (!canTransitionStatus(existing.status, 'ARCHIVED')) {
      throw AppError.badRequest(`Cannot archive announcement from status ${existing.status}`);
    }

    const updated = await this.repo.update(id, { status: 'ARCHIVED' });
    await this.audit.logEvent({
      actorId: actor.userId,
      action: 'announcementArchived',
      announcementId: id,
    });
    announcementEvents.emit('announcement.archived', {
      timestamp: new Date().toISOString(),
      announcementId: id,
      actorId: actor.userId,
    });
    return this.toDto(updated);
  }

  private async sendNotifications(announcement: Announcement | AnnouncementWithRelations): Promise<void> {
    if (announcement.notificationsSentAt) return;

    const userIds = await this.repo.resolveAudienceUserIds(announcement);
    const severity = priorityToNotificationSeverity(announcement.priority);
    const summary =
      announcement.content.length > 180
        ? `${announcement.content.slice(0, 177)}...`
        : announcement.content;

    for (const userId of userIds) {
      await this.notifyFn({
        userId,
        type: 'ANNOUNCEMENT',
        title: announcement.title,
        message: summary,
        severity,
        link: `/announcements?highlight=${announcement.id}`,
        metadata: {
          announcementId: announcement.id,
          category: announcement.category,
          priority: announcement.priority,
        },
      });
    }

    await this.repo.update(announcement.id, { notificationsSentAt: new Date() });
    log.info(`Announcement notifications sent for ${announcement.id} to ${userIds.length} users`);
  }

  async resolveActor(userId: string, roles: RoleName[], permissions: Set<string>): Promise<ActorContext> {
    const user = await this.repo.findUserById(userId);
    return { userId, roles, departmentId: user?.departmentId ?? null, permissions };
  }

  private buildFeedWhere(viewer: AnnouncementViewer) {
    const now = new Date();
    const audienceOr: Record<string, unknown>[] = [{ audienceType: 'ALL' }];
    if (viewer.roles.length > 0) {
      audienceOr.push({ audienceType: 'ROLE', targetRole: { in: viewer.roles } });
    }
    if (viewer.departmentId) {
      audienceOr.push({ audienceType: 'DEPARTMENT', targetDepartmentId: viewer.departmentId });
    }
    if (viewer.buildingIds && viewer.buildingIds.length > 0) {
      audienceOr.push({ audienceType: 'BUILDING', targetBuildingId: { in: viewer.buildingIds } });
    }
    audienceOr.push({ audienceType: 'USER', targetUserId: viewer.id });

    const where: Record<string, unknown> = {
      AND: [
        {
          OR: [{ status: 'PUBLISHED' }, { status: 'SCHEDULED', scheduledAt: { lte: now } }],
        },
        { OR: [{ expiresAt: null }, { expiresAt: { gt: now } }] },
        { OR: audienceOr },
      ],
    };

    return where;
  }

  private buildAdminWhere(query: ListAnnouncementsQuery) {
    const where: Record<string, unknown> = {};
    if (query.status) where['status'] = query.status;
    if (query.category) where['category'] = query.category;
    if (query.priority) where['priority'] = query.priority;
    if (query.authorId) where['authorId'] = query.authorId;
    if (query.search) {
      where['OR'] = [
        { title: { contains: query.search, mode: 'insensitive' } },
        { content: { contains: query.search, mode: 'insensitive' } },
      ];
    }
    if (query.from || query.to) {
      where['createdAt'] = {
        ...(query.from ? { gte: query.from } : {}),
        ...(query.to ? { lte: query.to } : {}),
      };
    }
    return where;
  }

  async list(
    actor: ActorContext,
    query: ListAnnouncementsQuery,
  ): Promise<{ data: AnnouncementDto[]; meta: { pagination: ReturnType<typeof buildPaginationMeta> } }> {
    await this.syncLifecycle();

    const adminView = query.adminView === true && (this.canManageAll(actor) || this.canCreate(actor));

    if (adminView) {
      const result = await this.repo.findMany(query, this.buildAdminWhere(query));
      const readIds = await this.repo.getReadIds(
        actor.userId,
        result.data.map((a) => a.id),
      );
      return {
        data: result.data.map((row) => this.toDto(row, readIds.has(row.id))),
        meta: { pagination: buildPaginationMeta(result.total, result.page, result.limit) },
      };
    }

    const viewer = await this.buildViewer(actor.userId, actor.roles, actor.departmentId);
    const feedWhere = this.buildFeedWhere(viewer);
    if (query.category) feedWhere['category'] = query.category;
    if (query.priority) feedWhere['priority'] = query.priority;
    if (query.search) {
      feedWhere['AND'] = [
        ...((feedWhere['AND'] as unknown[]) ?? []),
        {
          OR: [
            { title: { contains: query.search, mode: 'insensitive' } },
            { content: { contains: query.search, mode: 'insensitive' } },
          ],
        },
      ];
    }

    const result = await this.repo.findMany(query, feedWhere);
    const readIds = await this.repo.getReadIds(
      actor.userId,
      result.data.map((a) => a.id),
    );

    let rows = result.data;
    if (query.unreadOnly) {
      rows = rows.filter((a) => !readIds.has(a.id));
    }

    return {
      data: rows.map((row) => this.toDto(row, readIds.has(row.id))),
      meta: { pagination: buildPaginationMeta(result.total, result.page, result.limit) },
    };
  }

  async getById(actor: ActorContext, id: string): Promise<AnnouncementDto> {
    await this.syncLifecycle();
    const row = await this.repo.findById(id);
    if (!row) throw AppError.notFound('Announcement');

    const adminView = this.canManageAll(actor) || this.canCreate(actor);
    if (!adminView) {
      const viewer = await this.buildViewer(actor.userId, actor.roles, actor.departmentId);
      if (!isAnnouncementVisibleToUser(row, viewer)) {
        throw AppError.notFound('Announcement');
      }
    }

    const readIds = await this.repo.getReadIds(actor.userId, [id]);
    return this.toDto(row, readIds.has(id));
  }

  async markRead(actor: ActorContext, id: string): Promise<AnnouncementDto> {
    const dto = await this.getById(actor, id);
    await this.repo.markRead(id, actor.userId);
    await this.audit.logEvent({
      actorId: actor.userId,
      action: 'announcementRead',
      announcementId: id,
    });
    announcementEvents.emit('announcement.read', {
      timestamp: new Date().toISOString(),
      announcementId: id,
      userId: actor.userId,
      actorId: actor.userId,
    });
    return { ...dto, isRead: true };
  }

  async getUnreadCount(actor: ActorContext): Promise<{ unreadCount: number }> {
    await this.syncLifecycle();
    const viewer = await this.buildViewer(actor.userId, actor.roles, actor.departmentId);
    const result = await this.repo.findMany(
      { page: 1, limit: 500, sortOrder: 'desc' },
      this.buildFeedWhere(viewer),
    );
    const visibleIds = result.data.map((a) => a.id);
    const unreadCount = await this.repo.countUnreadForUser(actor.userId, visibleIds);
    return { unreadCount };
  }

  async getFeedSummary(actor: ActorContext): Promise<AnnouncementFeedSummary> {
    await this.syncLifecycle();
    const viewer = await this.buildViewer(actor.userId, actor.roles, actor.departmentId);
    const result = await this.repo.findMany(
      { page: 1, limit: 20, sortOrder: 'desc' },
      this.buildFeedWhere(viewer),
    );

    const visible = result.data;
    const readIds = await this.repo.getReadIds(
      actor.userId,
      visible.map((a) => a.id),
    );
    const unreadCount = visible.filter((a) => !readIds.has(a.id)).length;
    const urgentCount = visible.filter((a) => a.priority === 'URGENT' || a.priority === 'HIGH').length;
    const latest = visible.slice(0, 5).map((row) => this.toDto(row, readIds.has(row.id)));

    return { unreadCount, urgentCount, latest };
  }

  /** Read-only feed for AI assistant — same visibility rules as user feed. */
  async listForAI(
    userId: string,
    roles: RoleName[],
    departmentId: string | null,
    options?: { category?: string; urgentOnly?: boolean; limit?: number },
  ): Promise<AnnouncementDto[]> {
    await this.syncLifecycle();
    const viewer = await this.buildViewer(userId, roles, departmentId);
    const where = this.buildFeedWhere(viewer);
    if (options?.category) where['category'] = options.category;
    if (options?.urgentOnly) where['priority'] = { in: ['URGENT', 'HIGH'] };

    const result = await this.repo.findMany(
      { page: 1, limit: options?.limit ?? 10, sortOrder: 'desc' },
      where,
    );
    return result.data
      .filter((row) => isAnnouncementVisibleToUser(row, viewer))
      .map((row) => this.toDto(row));
  }
}
