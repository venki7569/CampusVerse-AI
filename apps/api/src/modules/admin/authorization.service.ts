import { PrismaClient, RoleName } from '@prisma/client';
import { toPermissionCode } from './admin.permissions';

const CACHE_TTL_MS = 60_000;

type CacheEntry = {
  codes: Set<string>;
  expiresAt: number;
};

/**
 * Loads Role → RolePermission → Permission codes with a short in-process cache.
 * Permission changes take effect without JWT refresh (JWT carries roles only).
 */
export class AuthorizationService {
  private readonly cache = new Map<string, CacheEntry>();

  constructor(private readonly db: PrismaClient) {}

  invalidate(): void {
    this.cache.clear();
  }

  async getPermissionCodes(roles: RoleName[]): Promise<Set<string>> {
    if (roles.length === 0) return new Set();
    if (roles.includes('SUPER_ADMIN')) {
      // SUPER_ADMIN retains full access even if RolePermission rows are incomplete.
      const cachedSuper = this.cache.get('__SUPER_ADMIN__');
      if (cachedSuper && cachedSuper.expiresAt > Date.now()) {
        return cachedSuper.codes;
      }
    }

    const uniqueRoles = [...new Set(roles)];
    const merged = new Set<string>();

    for (const role of uniqueRoles) {
      const codes = await this.getCodesForRole(role);
      for (const code of codes) merged.add(code);
    }

    if (roles.includes('SUPER_ADMIN')) {
      this.cache.set('__SUPER_ADMIN__', { codes: merged, expiresAt: Date.now() + CACHE_TTL_MS });
    }

    return merged;
  }

  hasPermission(codes: Set<string>, required: string, roles: RoleName[]): boolean {
    if (roles.includes('SUPER_ADMIN')) return true;
    return codes.has(required);
  }

  private async getCodesForRole(role: RoleName): Promise<Set<string>> {
    const cached = this.cache.get(role);
    if (cached && cached.expiresAt > Date.now()) {
      return cached.codes;
    }

    const rows = await this.db.rolePermission.findMany({
      where: { role: { name: role } },
      include: { permission: { select: { action: true, resource: true } } },
    });

    const codes = new Set(rows.map((row) => toPermissionCode(row.permission.resource, row.permission.action)));
    this.cache.set(role, { codes, expiresAt: Date.now() + CACHE_TTL_MS });
    return codes;
  }
}

let authorizationService: AuthorizationService | null = null;

export function initAuthorizationService(db: PrismaClient): AuthorizationService {
  authorizationService = new AuthorizationService(db);
  return authorizationService;
}

export function getAuthorizationService(): AuthorizationService {
  if (!authorizationService) {
    throw new Error('AuthorizationService is not initialized');
  }
  return authorizationService;
}

export function invalidateAuthorizationCache(): void {
  authorizationService?.invalidate();
}
