import type { PrismaClient } from '@prisma/client';
import { AppError } from '../utils/AppError';
import type { RoleName } from '../types';

/** Campus-wide roles bypass department restrictions. */
const CAMPUS_WIDE_ROLES: RoleName[] = ['SUPER_ADMIN', 'CAMPUS_ADMIN'];

export interface DepartmentScope {
  /** When true, queries must be limited to `departmentId`. */
  restricted: boolean;
  departmentId: string | null;
}

export interface RequestActor {
  userId: string;
  roles: RoleName[];
}

/**
 * Resolves whether the caller is department-scoped (DEPARTMENT_ADMIN without campus-wide role).
 */
export async function resolveDepartmentScope(
  db: PrismaClient,
  actor: RequestActor,
): Promise<DepartmentScope> {
  const isCampusWide = actor.roles.some((r) => CAMPUS_WIDE_ROLES.includes(r));
  if (isCampusWide) {
    return { restricted: false, departmentId: null };
  }

  if (!actor.roles.includes('DEPARTMENT_ADMIN')) {
    return { restricted: false, departmentId: null };
  }

  const user = await db.user.findUnique({
    where: { id: actor.userId },
    select: { departmentId: true },
  });

  if (!user?.departmentId) {
    throw AppError.forbidden('Department admin account is not assigned to a department');
  }

  return { restricted: true, departmentId: user.departmentId };
}

/**
 * Applies department filter to list/query params. Rejects cross-department requests.
 */
export function applyDepartmentQueryFilter<T extends { departmentId?: string }>(
  scope: DepartmentScope,
  query: T,
): T {
  if (!scope.restricted || !scope.departmentId) {
    return query;
  }
  if (query.departmentId && query.departmentId !== scope.departmentId) {
    throw AppError.forbidden('Access denied to resources outside your department');
  }
  return { ...query, departmentId: scope.departmentId };
}

/**
 * Validates single-resource department ownership. Campus-wide resources (no department) remain readable.
 */
export function assertDepartmentAccess(
  scope: DepartmentScope,
  resourceDepartmentId: string | null | undefined,
): void {
  if (!scope.restricted || !scope.departmentId) return;
  if (!resourceDepartmentId) return;
  if (resourceDepartmentId !== scope.departmentId) {
    throw AppError.forbidden('Access denied to resources outside your department');
  }
}

export function actorFromRequest(user: { sub: string; roles: RoleName[] }): RequestActor {
  return { userId: user.sub, roles: user.roles };
}
