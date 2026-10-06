import { PrismaClient, MaintenanceRequest } from '@prisma/client';
import { AppError } from '../../utils/AppError';
import { buildPaginationMeta } from '../../utils/pagination';
import { createLogger } from '../../utils/logger';
import type { MaintenanceRepository } from './maintenance.repository';
import type { MaintenanceAuditService } from './maintenance.audit.service';
import { maintenanceEvents } from './maintenance.events';
import type {
  CreateMaintenanceRequestDto,
  UpdateMaintenanceRequestDto,
  ListMaintenanceRequestsQuery,
  AssignMaintenanceRequestDto,
  ResolveMaintenanceRequestDto,
  CloseMaintenanceRequestDto,
  CancelOrRejectMaintenanceRequestDto,
  CreateMaintenanceCommentDto,
} from './maintenance.dto';
import type { PaginatedResult } from '../../types';
import type { RequestActor } from '../../services/department-scope.service';
import {
  applyDepartmentQueryFilter,
  assertDepartmentAccess,
  resolveDepartmentScope,
} from '../../services/department-scope.service';

function maintenanceDepartmentId(request: {
  room?: { departmentId: string | null } | null;
  asset?: { departmentId: string | null } | null;
}): string | null {
  return request.room?.departmentId ?? request.asset?.departmentId ?? null;
}

const log = createLogger('MaintenanceService');

export class MaintenanceService {
  constructor(
    private readonly repo: MaintenanceRepository,
    private readonly audit: MaintenanceAuditService,
    private readonly db: PrismaClient,
  ) {}

  async list(query: ListMaintenanceRequestsQuery, actor?: RequestActor): Promise<PaginatedResult<any>> {
    let scopedQuery = query;
    if (actor) {
      const scope = await resolveDepartmentScope(this.db, actor);
      scopedQuery = applyDepartmentQueryFilter(scope, query);
    }
    const result = await this.repo.findAll(scopedQuery);
    return {
      data: result.data,
      meta: {
        pagination: buildPaginationMeta(result.total, result.page, result.limit),
      },
    };
  }

  async getById(id: string, actor?: RequestActor) {
    const request = await this.repo.findById(id);
    if (!request) throw AppError.notFound('Maintenance request');
    if (actor) {
      const scope = await resolveDepartmentScope(this.db, actor);
      assertDepartmentAccess(scope, maintenanceDepartmentId(request));
    }
    return request;
  }

  async create(dto: CreateMaintenanceRequestDto, reporterId: string): Promise<MaintenanceRequest> {
    // 1. Verify reporter
    const reporter = await this.db.user.findUnique({ where: { id: reporterId } });
    if (!reporter) {
      throw AppError.notFound('Reporter user not found');
    }

    // 2. Validate Room & Location consistency if provided
    let resolvedRoomId = dto.roomId;
    if (dto.roomId) {
      const room = await this.db.room.findUnique({
        where: { id: dto.roomId },
        include: { floor: true },
      });
      if (!room) throw AppError.notFound('Target room not found');
      if (room.operationalStatus === 'RETIRED') {
        throw AppError.badRequest('Cannot report maintenance for a RETIRED room');
      }

      if (dto.buildingId && room.floor.buildingId !== dto.buildingId) {
        throw AppError.conflict(
          `Conflict: Room ${room.roomNumber} is in a different building than the provided building ID.`,
        );
      }
    }

    // 3. Validate Asset & Location consistency if provided
    if (dto.assetId) {
      const asset = await this.db.asset.findUnique({
        where: { id: dto.assetId },
        include: { room: { include: { floor: true } } },
      });
      if (!asset) throw AppError.notFound('Target asset not found');
      if (asset.operationalStatus === 'RETIRED') {
        throw AppError.badRequest('Cannot report maintenance for a RETIRED asset');
      }

      // Check room consistency
      if (dto.roomId && asset.roomId && asset.roomId !== dto.roomId) {
        throw AppError.conflict(
          `Conflict: Asset ${asset.assetTag} is assigned to a different room than specified.`,
        );
      }
      // Check building consistency
      if (dto.buildingId && asset.buildingId && asset.buildingId !== dto.buildingId) {
        throw AppError.conflict(
          `Conflict: Asset ${asset.assetTag} is in a different building than specified.`,
        );
      }

      if (!resolvedRoomId && asset.roomId) {
        resolvedRoomId = asset.roomId;
      }
    }

    const request = await this.repo.create({
      ...dto,
      roomId: resolvedRoomId,
      reporterId,
    });

    log.info(`Maintenance request created: ${request.id} by ${reporter.email}`);

    // Audit & Event
    await this.audit.logAuditEvent({
      actorId: reporterId,
      requestId: request.id,
      action: 'createMaintenanceRequest',
      details: {
        title: request.title,
        priority: request.priority,
        categoryId: request.categoryId,
        roomId: request.roomId,
        assetId: request.assetId,
      },
    });

    maintenanceEvents.emit('maintenance:created', {
      requestId: request.id,
      status: request.status,
      timestamp: new Date().toISOString(),
      actorId: reporterId,
      metadata: { title: request.title, priority: request.priority },
    });

    return request;
  }

  async update(id: string, dto: UpdateMaintenanceRequestDto, actorId: string): Promise<MaintenanceRequest> {
    const existing = await this.getById(id);

    if (['CLOSED', 'CANCELLED', 'REJECTED'].includes(existing.status)) {
      throw AppError.badRequest(`Cannot modify request with terminal status "${existing.status}"`);
    }

    const updated = await this.repo.update(id, dto);

    await this.audit.logAuditEvent({
      actorId,
      requestId: id,
      action: 'updateMaintenanceRequest',
      details: { changes: dto },
    });

    return updated;
  }

  async assign(id: string, dto: AssignMaintenanceRequestDto, actorId: string) {
    const existing = await this.getById(id);

    if (['CLOSED', 'CANCELLED', 'REJECTED'].includes(existing.status)) {
      throw AppError.badRequest(`Cannot assign request in terminal status "${existing.status}"`);
    }

    // Verify technician is a valid user and has MAINTENANCE_STAFF or Admin role
    const technician = await this.db.user.findUnique({
      where: { id: dto.technicianId },
      include: { userRoles: { include: { role: true } } },
    });
    if (!technician) throw AppError.notFound('Technician user not found');

    const hasTechRole = technician.userRoles.some((ur) =>
      ['MAINTENANCE_STAFF', 'SUPER_ADMIN', 'CAMPUS_ADMIN'].includes(ur.role.name),
    );
    if (!hasTechRole) {
      throw AppError.badRequest('Selected user is not a member of maintenance staff or admin.');
    }

    const { assignment, updatedRequest } = await this.repo.assignTechnician(id, dto.technicianId);

    // Audit & Notification
    await this.audit.logAuditEvent({
      actorId,
      requestId: id,
      action: 'assignMaintenanceRequest',
      details: { technicianId: dto.technicianId, technicianEmail: technician.email },
    });

    await this.audit.sendNotification({
      userId: dto.technicianId,
      type: 'MAINTENANCE_ASSIGNED',
      title: 'New Maintenance Assignment',
      message: `You have been assigned to maintenance ticket: "${existing.title}"`,
      link: `/maintenance?id=${id}`,
      metadata: { requestId: id, priority: existing.priority },
    });

    maintenanceEvents.emit('maintenance:assigned', {
      requestId: id,
      status: 'ASSIGNED',
      timestamp: new Date().toISOString(),
      actorId,
      metadata: { technicianId: dto.technicianId },
    });

    return { request: updatedRequest, assignment };
  }

  async startWork(id: string, actorId: string): Promise<MaintenanceRequest> {
    const existing = await this.getById(id);

    if (existing.status !== 'ASSIGNED' && existing.status !== 'REPORTED') {
      throw AppError.badRequest(`Cannot start work on a request with status "${existing.status}". Must be ASSIGNED or REPORTED.`);
    }

    const updated = await this.repo.updateStatus(id, 'IN_PROGRESS');

    // Also update asset operationalStatus to UNDER_MAINTENANCE if an asset is linked
    if (existing.assetId) {
      await this.db.asset.update({
        where: { id: existing.assetId },
        data: { operationalStatus: 'UNDER_MAINTENANCE' },
      });
    }

    await this.audit.logAuditEvent({
      actorId,
      requestId: id,
      action: 'startMaintenance',
      details: { fromStatus: existing.status, toStatus: 'IN_PROGRESS' },
    });

    maintenanceEvents.emit('maintenance:status_changed', {
      requestId: id,
      status: 'IN_PROGRESS',
      timestamp: new Date().toISOString(),
      actorId,
    });

    return updated;
  }

  async resolve(id: string, dto: ResolveMaintenanceRequestDto, actorId: string): Promise<MaintenanceRequest> {
    const existing = await this.getById(id);

    if (existing.status !== 'IN_PROGRESS' && existing.status !== 'ASSIGNED') {
      throw AppError.badRequest(`Cannot resolve request in status "${existing.status}". Must be IN_PROGRESS or ASSIGNED.`);
    }

    if (!dto.resolutionNotes || dto.resolutionNotes.trim().length < 5) {
      throw AppError.badRequest('Resolution notes (min 5 characters) are required to resolve a request.');
    }

    const completedAt = new Date();
    const updated = await this.repo.updateStatus(id, 'RESOLVED', completedAt);

    // Add resolution notes as a comment
    await this.repo.addComment(id, actorId, `[RESOLUTION]: ${dto.resolutionNotes}`);

    // If an asset is linked, create a MaintenanceHistory record and restore asset status to ACTIVE
    if (existing.assetId) {
      const activeAssignment = existing.assignments?.[0];
      await this.repo.recordAssetHistory({
        assetId: existing.assetId,
        action: `Work Order Resolved: ${existing.title}`,
        technicianId: activeAssignment?.technicianId ?? actorId,
        cost: dto.cost ?? null,
        notes: dto.resolutionNotes,
        performedAt: completedAt,
      });

      await this.db.asset.update({
        where: { id: existing.assetId },
        data: {
          operationalStatus: 'ACTIVE',
          lastMaintenance: completedAt,
        },
      });
    }

    // Audit & Notification to reporter
    await this.audit.logAuditEvent({
      actorId,
      requestId: id,
      action: 'resolveMaintenanceRequest',
      details: { resolutionNotes: dto.resolutionNotes, cost: dto.cost },
    });

    await this.audit.sendNotification({
      userId: existing.reporterId,
      type: 'MAINTENANCE_RESOLVED',
      title: 'Issue Resolved',
      message: `Your maintenance ticket "${existing.title}" has been resolved.`,
      link: `/maintenance?id=${id}`,
    });

    maintenanceEvents.emit('maintenance:resolved', {
      requestId: id,
      status: 'RESOLVED',
      timestamp: completedAt.toISOString(),
      actorId,
      metadata: { resolutionNotes: dto.resolutionNotes },
    });

    return updated;
  }

  async close(id: string, dto: CloseMaintenanceRequestDto, actorId: string): Promise<MaintenanceRequest> {
    const existing = await this.getById(id);

    if (existing.status !== 'RESOLVED') {
      throw AppError.badRequest(`Cannot close a request that has not been RESOLVED (Current: "${existing.status}").`);
    }

    const updated = await this.repo.updateStatus(id, 'CLOSED');

    if (dto.notes) {
      await this.repo.addComment(id, actorId, `[CLOSURE NOTES]: ${dto.notes}`);
    }

    await this.audit.logAuditEvent({
      actorId,
      requestId: id,
      action: 'closeMaintenanceRequest',
      details: { notes: dto.notes },
    });

    maintenanceEvents.emit('maintenance:closed', {
      requestId: id,
      status: 'CLOSED',
      timestamp: new Date().toISOString(),
      actorId,
    });

    return updated;
  }

  async cancel(id: string, dto: CancelOrRejectMaintenanceRequestDto, actorId: string): Promise<MaintenanceRequest> {
    const existing = await this.getById(id);

    if (['CLOSED', 'RESOLVED', 'CANCELLED', 'REJECTED'].includes(existing.status)) {
      throw AppError.badRequest(`Cannot cancel request in status "${existing.status}".`);
    }

    const isReporter = existing.reporterId === actorId;
    const actor = await this.db.user.findUnique({
      where: { id: actorId },
      include: { userRoles: { include: { role: true } } },
    });
    const roles = actor?.userRoles.map((ur) => ur.role.name) ?? [];
    const isAdmin = roles.some((r) =>
      ['SUPER_ADMIN', 'CAMPUS_ADMIN', 'DEPARTMENT_ADMIN'].includes(r),
    );

    if (!isReporter && !isAdmin) {
      throw AppError.forbidden('Only the reporter or an administrator can cancel this request.');
    }

    const updated = await this.repo.updateStatus(id, 'CANCELLED');
    await this.repo.addComment(id, actorId, `[CANCELLED]: ${dto.reason}`);

    // If asset was under maintenance, restore it
    if (existing.assetId) {
      await this.db.asset.update({
        where: { id: existing.assetId },
        data: { operationalStatus: 'ACTIVE' },
      });
    }

    await this.audit.logAuditEvent({
      actorId,
      requestId: id,
      action: 'cancelMaintenanceRequest',
      details: { reason: dto.reason },
    });

    maintenanceEvents.emit('maintenance:cancelled', {
      requestId: id,
      status: 'CANCELLED',
      timestamp: new Date().toISOString(),
      actorId,
      metadata: { reason: dto.reason },
    });

    return updated;
  }

  async reject(id: string, dto: CancelOrRejectMaintenanceRequestDto, actorId: string): Promise<MaintenanceRequest> {
    const existing = await this.getById(id);

    if (existing.status !== 'REPORTED' && existing.status !== 'ASSIGNED') {
      throw AppError.badRequest(`Cannot reject request in status "${existing.status}".`);
    }

    const updated = await this.repo.updateStatus(id, 'REJECTED');
    await this.repo.addComment(id, actorId, `[REJECTED]: ${dto.reason}`);

    await this.audit.logAuditEvent({
      actorId,
      requestId: id,
      action: 'rejectMaintenanceRequest',
      details: { reason: dto.reason },
    });

    await this.audit.sendNotification({
      userId: existing.reporterId,
      type: 'MAINTENANCE_UPDATE',
      title: 'Issue Rejected',
      message: `Your maintenance ticket "${existing.title}" was rejected: ${dto.reason}`,
      link: `/maintenance?id=${id}`,
    });

    maintenanceEvents.emit('maintenance:rejected', {
      requestId: id,
      status: 'REJECTED',
      timestamp: new Date().toISOString(),
      actorId,
      metadata: { reason: dto.reason },
    });

    return updated;
  }

  async addComment(id: string, dto: CreateMaintenanceCommentDto, authorId: string) {
    await this.getById(id);
    const comment = await this.repo.addComment(id, authorId, dto.content);

    await this.audit.logAuditEvent({
      actorId: authorId,
      requestId: id,
      action: 'addMaintenanceComment',
      details: { commentId: comment.id },
    });

    maintenanceEvents.emit('maintenance:comment_added', {
      requestId: id,
      status: 'COMMENT',
      timestamp: new Date().toISOString(),
      actorId: authorId,
      metadata: { commentId: comment.id },
    });

    return comment;
  }

  async getComments(id: string) {
    await this.getById(id);
    return this.repo.getComments(id);
  }

  async getMetrics() {
    return this.repo.getMetrics();
  }

  async getTechnicians() {
    return this.db.user.findMany({
      where: {
        userRoles: {
          some: {
            role: {
              name: { in: ['MAINTENANCE_STAFF', 'SUPER_ADMIN', 'CAMPUS_ADMIN'] },
            },
          },
        },
        isActive: true,
      },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
      },
      orderBy: { firstName: 'asc' },
    });
  }
}
