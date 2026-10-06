import { AuditLog } from '../database/mongodb/schemas/auditLog.schema';
import { createLogger } from '../../utils/logger';
import { publishNotification } from '../notifications/notification.service';
import type { ListAdminAuditQuery } from './admin.dto';

const log = createLogger('AdminAuditService');

export type AdminAuditAction =
  | 'createUser'
  | 'updateUser'
  | 'activateUser'
  | 'deactivateUser'
  | 'resetUserPassword'
  | 'createRole'
  | 'updateRole'
  | 'deleteRole'
  | 'updateRolePermissions';

const ADMIN_ENTITY_NAMES = ['User', 'Role', 'RolePermission', 'Permission'];

export class AdminAuditService {
  async logEvent(entry: {
    actorId: string;
    action: AdminAuditAction;
    entityName: 'User' | 'Role' | 'RolePermission';
    entityId: string;
    metadata?: Record<string, unknown>;
  }): Promise<void> {
    try {
      const metadata = { ...(entry.metadata ?? {}) };
      delete metadata['password'];
      delete metadata['passwordHash'];
      delete metadata['token'];
      delete metadata['refreshToken'];
      delete metadata['accessToken'];
      delete metadata['secret'];

      await AuditLog.create({
        actorId: entry.actorId,
        action: entry.action,
        entityName: entry.entityName,
        entityId: entry.entityId,
        metadata,
      });
    } catch (err) {
      log.warn('Failed to persist admin audit log', { err, action: entry.action });
    }
  }

  async listEvents(query: ListAdminAuditQuery): Promise<{
    data: Array<{
      id: string;
      actorId: string;
      action: string;
      entityName: string;
      entityId: string;
      metadata: Record<string, unknown>;
      createdAt: string;
    }>;
    total: number;
    page: number;
    limit: number;
  }> {
    const page = query.page;
    const limit = query.limit;
    const filter: Record<string, unknown> = { entityName: { $in: ADMIN_ENTITY_NAMES } };
    if (query.action) filter['action'] = query.action;
    if (query.search) {
      filter['$or'] = [
        { action: { $regex: query.search, $options: 'i' } },
        { entityName: { $regex: query.search, $options: 'i' } },
        { entityId: { $regex: query.search, $options: 'i' } },
      ];
    }

    try {
      const [rows, total] = await Promise.all([
        AuditLog.find(filter)
          .sort({ createdAt: query.sortOrder === 'asc' ? 1 : -1 })
          .skip((page - 1) * limit)
          .limit(limit)
          .exec(),
        AuditLog.countDocuments(filter),
      ]);

      return {
        data: rows.map((row) => ({
          id: String(row._id),
          actorId: row.actorId,
          action: row.action,
          entityName: row.entityName,
          entityId: row.entityId,
          metadata: (row.metadata ?? {}) as Record<string, unknown>,
          createdAt: row.createdAt?.toISOString?.() ?? new Date().toISOString(),
        })),
        total,
        page,
        limit,
      };
    } catch (err) {
      log.warn('Failed to list admin audit logs', { err });
      return { data: [], total: 0, page, limit };
    }
  }

  async notifyUser(input: {
    userId: string;
    title: string;
    message: string;
    severity?: string;
    metadata?: Record<string, unknown>;
  }): Promise<void> {
    try {
      await publishNotification({
        userId: input.userId,
        type: 'SYSTEM',
        title: input.title,
        message: input.message,
        link: '/admin',
        severity: input.severity ?? 'INFO',
        metadata: {
          ...(input.metadata ?? {}),
          category: 'ADMIN',
          severity: input.severity ?? 'INFO',
        },
      });
    } catch (err) {
      log.warn('Failed to publish admin notification', { err, userId: input.userId });
    }
  }
}
