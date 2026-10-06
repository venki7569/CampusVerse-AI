# Phase 13 — Admin, User Management & RBAC

## 1. Architecture Inspection

Inspected before changes:

- Prisma User / Role / Permission / RolePermission / UserRole / RefreshToken
- Auth module (login, refresh, logout, forgot/reset password, JWT roles in payload)
- `authenticate` + `requireRole` middleware (permissions previously unused)
- Seed (roles/dept/building only; incomplete RBAC)
- Dead `/admin` nav link and no Admin page
- Phase 12 notifications + Mongo AuditLog
- Existing module patterns (departments, notifications)
- No `implementation_plan.md` in repo; used `phase12_final_report.md` + schema as source of truth

Conclusion: reuse existing RBAC tables and JWT auth. Add optional `User.departmentId`, enforce RolePermission via middleware, and build `/api/v1/admin/*` + Admin UI without redesigning auth.

## 2. Existing RBAC Schema

| Model | Notes |
|-------|--------|
| User | email unique, passwordHash, isActive, **optional departmentId (added)** |
| Role | `name` is Prisma `RoleName` enum (system catalog) |
| Permission | unique `[action, resource]` |
| UserRole | unique `[userId, roleId]` |
| RolePermission | unique `[roleId, permissionId]` |
| RefreshToken | session rotation store |

All `RoleName` enum values are treated as **system roles** (`isSystem: true`). Arbitrary custom role names are not supported without a schema change.

## 3. User Management Implementation

Module: `apps/api/src/modules/admin/`

- List / get / create / update users
- Status activate/deactivate
- Soft delete = deactivate + revoke refresh tokens
- Optional admin password reset (`PATCH /users/:id/password`)
- Never returns password hashes; never logs passwords

## 4. Role Management

- List / get / create (catalog enum only) / update description / delete
- System roles cannot be deleted
- Role DTO includes userCount, permissionCount, permissions

## 5. Permission Management

- List / get permissions (read-only catalog)
- `PUT /roles/:roleId/permissions` replaces assignments in a transaction
- Duplicate permission IDs are stripped (idempotent)

## 6. Permission Enforcement

Added `requirePermission(...codes)` alongside existing `requireRole(...)`.

Resolution path: JWT roles → RolePermission → Permission (`resource.action` codes).

Performance:

- In-process cache per role (~60s TTL)
- `AuthorizationService` singleton initialized at API startup
- Cache invalidated on role-permission changes
- JWT still carries **roles only**; permission changes apply on next request without unsafe JWT mutation
- `SUPER_ADMIN` retains full access even if RolePermission rows are incomplete

Admin routes use:

1. `authenticate`
2. `requireRole(SUPER_ADMIN | CAMPUS_ADMIN | DEPARTMENT_ADMIN)`
3. `requirePermission(...)`

Existing operational modules keep `requireRole` only (no global permission rewrite).

### Permission coverage (Phase 13)

| Area | Enforced |
|------|----------|
| `/api/v1/admin/*` | Yes (`users.*`, `roles.*`, `permissions.*`, `audit.read`) |
| Auth / Buildings / Floors / Rooms / Departments / Assets / Maintenance / Utilities / Dashboard / Notifications | Unchanged (`requireRole` / authenticate as before) |

## 7. API Endpoints

Base: `/api/v1/admin`

### Users

| Method | Path | Permission |
|--------|------|------------|
| GET | `/users` | `users.read` |
| GET | `/users/:id` | `users.read` |
| POST | `/users` | `users.create` |
| PATCH | `/users/:id` | `users.update` |
| PATCH | `/users/:id/status` | `users.manage` |
| PATCH | `/users/:id/password` | `users.manage` |
| DELETE | `/users/:id` | `users.manage` (soft deactivate) |

### Roles

| Method | Path | Permission |
|--------|------|------------|
| GET | `/roles` | `roles.read` |
| GET | `/roles/:id` | `roles.read` |
| POST | `/roles` | `roles.create` |
| PATCH | `/roles/:id` | `roles.update` |
| DELETE | `/roles/:id` | `roles.manage` |
| PUT | `/roles/:roleId/permissions` | `permissions.manage` |

### Permissions / Audit

| Method | Path | Permission |
|--------|------|------------|
| GET | `/permissions` | `permissions.read` |
| GET | `/permissions/:id` | `permissions.read` |
| GET | `/audit` | `audit.read` |

## 8. Frontend Admin Page

- Route `/admin` protected for SUPER_ADMIN / CAMPUS_ADMIN / DEPARTMENT_ADMIN
- Tabs: Users, Roles, Permissions, Audit
- Users: search/filters/pagination, create/edit, activate/deactivate, detail + inherited permissions, optional password reset
- Roles: system badge, permission checkboxes grouped by resource
- Permissions: catalog view (no destructive UI)
- Navigation + Global Search updated; Admin search results role-gated

## 9. Authentication Compatibility

Preserved:

- login / refresh / logout / forgot / reset password
- JWT role payload
- ProtectedRoute
- Existing `requireRole` routes

Permission authority remains **backend-only**.

## 10. Seed Changes

Seed now creates:

- All system roles
- Core permissions from catalog
- Default RolePermission mappings
- Existing CS department / building / room upserts
- Optional development SUPER_ADMIN via `SEED_ADMIN_EMAIL` / `SEED_ADMIN_PASSWORD`

Documented in `apps/api/.env.example`. No production secrets hardcoded.

## 11. Audit Logging

Mongo AuditLog for:

- create/update/activate/deactivate user
- reset password (no secret payload)
- create/update/delete role
- update role permissions

Passwords, hashes, JWTs, and tokens are stripped from metadata.

## 12. Notification Integration

Meaningful SYSTEM notifications only:

- account activated / deactivated
- role changed for a user
- role permission changes (capped sample of affected users)

## 13. Tests

`npx ts-node --transpile-only src/modules/admin/admin.test.ts`

**38 / 38 passed** (covers user/role/permission/authz/audit/notification cases from the Phase 13 checklist).

Regression:

| Suite | Result |
|-------|--------|
| Notifications | 17 / 17 |
| Dashboard | 16 / 16 |
| Maintenance | 17 / 17 |
| Electricity | 20 / 20 |
| Water | 19 / 19 |
| Admin | 38 / 38 |

**Total: 127 / 127**

## 14. Validation Results

| Check | Result |
|-------|--------|
| Prisma validate / generate | Pass |
| API `tsc --noEmit` | Pass |
| Web typecheck / lint / build | Pass (pre-existing Fast Refresh warnings only) |

## 15. Security Review

Checked and mitigated within Phase 13:

- Privilege escalation (CAMPUS_ADMIN cannot assign SUPER_ADMIN)
- Cross-user SUPER_ADMIN modification blocked for non–super-admins
- Last SUPER_ADMIN cannot be deactivated / demoted
- Password hashes never returned
- Soft delete preferred over hard delete (historical maintenance FKs)
- System role deletion blocked
- Permission assignment restricted to SUPER_ADMIN
- Admin routes authenticated + role + permission gated
- JWT not treated as permission authority

## 16. Files Created / Modified

### Created

- `apps/api/src/modules/admin/admin.permissions.ts`
- `apps/api/src/modules/admin/authorization.service.ts`
- `apps/api/src/modules/admin/admin.dto.ts`
- `apps/api/src/modules/admin/admin.repository.ts`
- `apps/api/src/modules/admin/admin.service.ts`
- `apps/api/src/modules/admin/admin.controller.ts`
- `apps/api/src/modules/admin/admin.router.ts`
- `apps/api/src/modules/admin/admin.audit.service.ts`
- `apps/api/src/modules/admin/admin.test.ts`
- `apps/web/src/hooks/useAdmin.ts`
- `apps/web/src/pages/Admin.tsx`
- `phase13_final_report.md`

### Modified

- `apps/api/prisma/schema.prisma` (optional `User.departmentId`)
- `apps/api/src/middleware/auth.middleware.ts` (`requirePermission`)
- `apps/api/src/types/index.ts` (`permissionCodes` on Request)
- `apps/api/src/server.ts`
- `apps/api/src/config/swagger.ts`
- `apps/api/src/config/env.ts`
- `apps/api/.env.example`
- `apps/api/src/database/seeds/seed.ts`
- `apps/web/src/types/index.ts`
- `apps/web/src/App.tsx`
- `apps/web/src/components/Navigation.tsx`
- `apps/web/src/components/layout/GlobalSearchModal.tsx`

## 17. Remaining Limitations

- Role names limited to Prisma `RoleName` enum (no free-form custom roles)
- Permission enforcement is incremental: **admin module only** in this phase
- No Redis-backed permission cache
- No Socket.IO push for admin events
- Department association on users is optional; historical users may have null department
- Apply Prisma migration/db push in each environment before using department filters

## Stop Confirmation

**Phase 13 completed. Work stopped here.**

Not started: Parking, Campus-wide Analytics, Announcements, AI Assistant, Cloudinary, Gemini, Redis, Socket.IO server.
