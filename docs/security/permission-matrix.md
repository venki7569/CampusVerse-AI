# CampusVerse AI — RBAC Permission Matrix

Backend authorization is enforced server-side via `requirePermission()` and `requireRole()`. UI navigation hiding is **not** authorization.

## Legend

| Symbol | Meaning |
|--------|---------|
| ✓ | Allowed |
| — | Denied |
| R | Read-only / limited |
| A | Requires human approval |

## Permission-Based Modules

| Module | Permission(s) | SUPER_ADMIN | CAMPUS_ADMIN | DEPT_ADMIN | FACULTY | MAINT_STAFF | SECURITY | STUDENT |
|--------|---------------|:-----------:|:------------:|:----------:|:-------:|:-----------:|:--------:|:-------:|
| Analytics view | `analytics.view` | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | — |
| Analytics report | `analytics.report` | ✓ | ✓ | ✓ | — | — | — | — |
| AI assistant | `ai.use` | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Digital twin | `digital_twin.view` | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | — |
| Recommendations view | `recommendation.view` | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | — |
| Recommendations manage | `recommendation.manage` | ✓ | ✓ | — | — | ✓ | — | — |
| IoT view | `iot.view` | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | — |
| IoT manage | `iot.manage` | ✓ | ✓ | — | — | — | — | — |
| IoT ingest | `iot.ingest` | ✓ | ✓ | — | — | — | — | — |
| IoT actions | `iot.actions` | ✓ | ✓ | — | — | ✓ | ✓ | — |
| Announcements | varies | ✓ | ✓ | create/publish | view | view | view | view |
| Parking allocate | `parking.allocate` | ✓ | ✓ | — | — | — | ✓ | — |
| Admin users/RBAC | `users.*`, `roles.*` | ✓ | ✓ | limited | — | — | — | — |

## Role-Based Modules

| Module | Allowed Roles (mutations) | All authenticated (reads) |
|--------|---------------------------|---------------------------|
| Buildings/Floors/Rooms | SUPER_ADMIN, CAMPUS_ADMIN, DEPT_ADMIN | ✓ (Phase 21: auth required) |
| Assets | SUPER_ADMIN, CAMPUS_ADMIN, DEPT_ADMIN, MAINT_STAFF | ✓ with auth |
| Maintenance workflow | Staff roles for assign/resolve; reporter for create | ✓ list/view with auth |
| Electricity/Water meters | Admin + maintenance roles | ✓ with auth |
| Dashboard | All authenticated users | ✓ |

## Human-Approved Actions (Phase 20)

| Action | Auto-execute | Approval |
|--------|--------------|----------|
| AI recommendations | — | Acknowledge/dismiss (human) |
| IoT operational actions | — | Approve/reject required |
| AI tools | Read-only | No mutations |

## Notes

- **Deactivated users**: Blocked at login, refresh, JWT middleware, and Socket.IO (Phase 21).
- **Maintenance cancel**: Reporter or admin only (Phase 21).
- **Notifications**: User-scoped in service layer; no cross-user access.
- **DEPARTMENT_ADMIN read scope** (Phase 22): Assets, maintenance, electricity meters, rooms, analytics, and admin user list/get are filtered to the admin's assigned department. Campus-wide resources (buildings, floors, water meters, parking areas) remain visible.
