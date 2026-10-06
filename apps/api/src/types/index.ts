import type { PaginationMeta } from '../utils/apiResponse';

// ── RBAC ──────────────────────────────────────────────────────────────────

export type RoleName =
  | 'SUPER_ADMIN'
  | 'CAMPUS_ADMIN'
  | 'DEPARTMENT_ADMIN'
  | 'FACULTY'
  | 'STUDENT'
  | 'MAINTENANCE_STAFF'
  | 'SECURITY_STAFF';

export interface JwtPayload {
  sub: string;       // userId
  email: string;
  roles: RoleName[];
  iat?: number;
  exp?: number;
}

// Augment Express Request to carry the authenticated user
declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: JwtPayload;
      permissionCodes?: Set<string>;
    }
  }
}

// ── Query Helpers ─────────────────────────────────────────────────────────

export interface PaginationQuery {
  page: number;
  limit: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
  search?: string;
}

export interface PaginatedResult<T> {
  data: T[];
  meta: { pagination: PaginationMeta };
}

// ── Generic service result ────────────────────────────────────────────────

export type ServiceResult<T> =
  | { success: true; data: T }
  | { success: false; error: string; code: string };

// ── ID param helper ───────────────────────────────────────────────────────
export interface IdParam {
  id: string;
}
