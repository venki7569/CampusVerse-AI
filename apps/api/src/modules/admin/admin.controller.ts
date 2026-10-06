import { Request, Response, NextFunction } from 'express';
import { sendSuccess, sendCreated, sendNoContent, sendPaginated } from '../../utils/apiResponse';
import { AppError } from '../../utils/AppError';
import type { AdminService } from './admin.service';
import type {
  ActorContext,
  AdminRoleName,
  CreateAdminUserDto,
  CreateRoleDto,
  ListAdminAuditQuery,
  ListAdminUsersQuery,
  ListPermissionsQuery,
  ListRolesQuery,
  ResetUserPasswordDto,
  UpdateAdminUserDto,
  UpdateRoleDto,
  UpdateRolePermissionsDto,
  UpdateUserStatusDto,
} from './admin.dto';

export class AdminController {
  constructor(private readonly service: AdminService) {}

  private actor(req: Request): ActorContext {
    if (!req.user) {
      throw AppError.unauthorized('Authentication required');
    }
    return {
      id: req.user.sub,
      email: req.user.email,
      roles: req.user.roles as AdminRoleName[],
    };
  }

  listUsers = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const result = await this.service.listUsers(
        req.query as unknown as ListAdminUsersQuery,
        this.actor(req),
      );
      sendPaginated(res, result.data, result.meta.pagination);
    } catch (err) {
      next(err);
    }
  };

  getUser = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      sendSuccess(res, await this.service.getUser(req.params['id'] as string, this.actor(req)));
    } catch (err) {
      next(err);
    }
  };

  createUser = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      sendCreated(res, await this.service.createUser(this.actor(req), req.body as CreateAdminUserDto));
    } catch (err) {
      next(err);
    }
  };

  updateUser = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      sendSuccess(
        res,
        await this.service.updateUser(this.actor(req), req.params['id'] as string, req.body as UpdateAdminUserDto),
      );
    } catch (err) {
      next(err);
    }
  };

  updateUserStatus = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      sendSuccess(
        res,
        await this.service.updateUserStatus(
          this.actor(req),
          req.params['id'] as string,
          req.body as UpdateUserStatusDto,
        ),
      );
    } catch (err) {
      next(err);
    }
  };

  resetUserPassword = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      sendSuccess(
        res,
        await this.service.resetUserPassword(
          this.actor(req),
          req.params['id'] as string,
          req.body as ResetUserPasswordDto,
        ),
      );
    } catch (err) {
      next(err);
    }
  };

  deleteUser = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      await this.service.deactivateUser(this.actor(req), req.params['id'] as string);
      sendNoContent(res);
    } catch (err) {
      next(err);
    }
  };

  listRoles = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const result = await this.service.listRoles(req.query as unknown as ListRolesQuery);
      sendPaginated(res, result.data, result.meta.pagination);
    } catch (err) {
      next(err);
    }
  };

  getRole = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      sendSuccess(res, await this.service.getRole(req.params['id'] as string));
    } catch (err) {
      next(err);
    }
  };

  createRole = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      sendCreated(res, await this.service.createRole(this.actor(req), req.body as CreateRoleDto));
    } catch (err) {
      next(err);
    }
  };

  updateRole = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      sendSuccess(
        res,
        await this.service.updateRole(this.actor(req), req.params['id'] as string, req.body as UpdateRoleDto),
      );
    } catch (err) {
      next(err);
    }
  };

  deleteRole = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      await this.service.deleteRole(this.actor(req), req.params['id'] as string);
      sendNoContent(res);
    } catch (err) {
      next(err);
    }
  };

  updateRolePermissions = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      sendSuccess(
        res,
        await this.service.updateRolePermissions(
          this.actor(req),
          req.params['roleId'] as string,
          req.body as UpdateRolePermissionsDto,
        ),
      );
    } catch (err) {
      next(err);
    }
  };

  listPermissions = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const result = await this.service.listPermissions(req.query as unknown as ListPermissionsQuery);
      sendPaginated(res, result.data, result.meta.pagination);
    } catch (err) {
      next(err);
    }
  };

  getPermission = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      sendSuccess(res, await this.service.getPermission(req.params['id'] as string));
    } catch (err) {
      next(err);
    }
  };

  listAudit = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const result = await this.service.listAudit(req.query as unknown as ListAdminAuditQuery);
      sendPaginated(res, result.data, result.meta.pagination);
    } catch (err) {
      next(err);
    }
  };
}
