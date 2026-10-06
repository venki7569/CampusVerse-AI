# Phase 12 — Notifications & Alert Management

## 1. Architecture Inspection

Inspected the monorepo before changes:

- Mongo `Notification` schema (`apps/api/src/modules/database/mongodb/schemas/notification.schema.ts`)
- Write-only producers: Maintenance, Electricity, Water audit services
- Dashboard overview (Phase 11) — operational alerts / recent activity
- Auth middleware (`authenticate`) and JWT `req.user.sub` ownership pattern
- Header mock notification dropdown
- TanStack Query v5 hooks, Axios client, shared UI (`DataTable`, `Modal`, `Toast`, `KpiCard`, `EmptyState`)
- In-process event buses from Phase 11 (dashboard/maintenance/electricity/water) — **no Socket.IO server**
- No `implementation_plan.md` present in the repo

Conclusion: reuse the existing Mongo notification collection and producer writes; add a full CRUD-style read/manage API and UI without redesigning operational modules.

## 2. Existing Notification Schema

| Field | Notes |
|-------|--------|
| `userId` | Recipient (string, indexed) |
| `type` | Producer type string (indexed) |
| `title` / `message` | Display content |
| `isRead` | Boolean, default `false` (indexed) |
| `severity` | **Added** optional top-level field for filtering (backward-compatible) |
| `link` | Optional deep link |
| `metadata` | Mixed; legacy severity often lived here |
| `createdAt` | Default `Date.now` (indexed) |

Indexes added (compound):

- `{ userId: 1, isRead: 1, createdAt: -1 }`
- `{ userId: 1, createdAt: -1 }`

No TTL / retention policy exists. No Prisma changes (notifications are Mongo-only).

**Existing type strings preserved:**

- `MAINTENANCE_UPDATE`, `MAINTENANCE_ASSIGNED`, `MAINTENANCE_RESOLVED`, `MAINTENANCE_COMMENT`
- `UTILITY_ANOMALY`
- `SYSTEM`

Severity values used by producers: `INFO`, `LOW`, `MEDIUM`, `HIGH`, `CRITICAL`, plus filter support for `WARNING` / `SUCCESS`.

## 3. Backend Implementation

### Created (`apps/api/src/modules/notifications/`)

| File | Role |
|------|------|
| `notification.dto.ts` | Zod query/param schemas + DTO types |
| `notification.repository.ts` | Mongo access, ownership-scoped queries |
| `notification.service.ts` | Business logic + `publishNotification()` helper |
| `notification.controller.ts` | HTTP handlers |
| `notification.router.ts` | Authenticated routes |
| `notification.events.ts` | In-process event bus |
| `notification.test.ts` | Service test suite |

`notification.audit.service.ts` was **not** added — creation already flows through audit producers + `publishNotification` + events; a separate audit file would duplicate noise for low-value read actions.

### Modified

- `notification.schema.ts` — optional `severity` + compound indexes
- `server.ts` — mount `/api/v1/notifications`
- `maintenance.audit.service.ts` — uses `publishNotification` (severity + `category: MAINTENANCE`)
- `electricity.audit.service.ts` — uses `publishNotification` (severity + `category: ELECTRICITY`)
- `water.audit.service.ts` — uses `publishNotification` (severity + `category: WATER`)

## 4. API Endpoints

All under `/api/v1/notifications`, **authenticated**. Recipient identity always from `req.user.sub` (never from client body).

| Method | Path | Behavior |
|--------|------|----------|
| `GET` | `/` | List own notifications (`page`, `limit`, `unreadOnly`, `type`, `severity`, `search`, `sortBy`, `sortOrder`) |
| `GET` | `/unread-count` | `{ unreadCount: number }` |
| `GET` | `/:id` | Single owned notification |
| `PATCH` | `/:id/read` | Mark one as read |
| `PATCH` | `/read-all` | Mark all owned as read |
| `DELETE` | `/:id` | Hard-delete/dismiss owned notification |

Cross-user get/update/delete returns not-found (ownership filter).

## 5. RBAC / Security

- `authenticate` on every notification route
- Ownership enforced in repository queries (`userId` + `_id`)
- No client-supplied `recipientId` / `userId` on management endpoints
- No system-wide SUPER_ADMIN inbox in this phase (would be a separate capability later)

## 6. Notification Types & Producers

| Producer | Types | Notes |
|----------|-------|--------|
| Maintenance | `MAINTENANCE_*` | Assigned, resolved, update, comment (existing call sites unchanged in behavior) |
| Electricity | `UTILITY_ANOMALY` | Anomaly notifications to admin IDs |
| Water | `UTILITY_ANOMALY` | Same pattern |
| Dashboard | — | Consumes unread count / alerts via notification hooks; does not duplicate writes |

Shared create path: `publishNotification()` → Mongo write → `notification.created` event.

## 7. Frontend Implementation

### Created

- `apps/web/src/pages/Notifications.tsx` — notification center
- `apps/web/src/hooks/useNotifications.ts` — query keys + hooks
- `apps/web/src/services/notificationEvents.ts` — client event subscription abstraction

### Types (`apps/web/src/types/index.ts`)

- `NotificationType`, `NotificationSeverity`
- `AppNotification`
- `NotificationQueryParams`
- `NotificationListResponse`
- `UnreadNotificationCount`

### Hooks

- `useNotifications(params)`
- `useNotification(id)`
- `useUnreadNotificationCount()`
- `useMarkNotificationRead()`
- `useMarkAllNotificationsRead()`
- `useDeleteNotification()`

Query-key factory: `notificationKeys.all | lists | list | details | detail | unreadCount`.

Mutations invalidate list, detail, unread count, and dashboard keys.

## 8. Header Notification Center

`Header.tsx` mock data removed. Now uses:

- Live unread badge from `GET /notifications/unread-count`
- Latest 5 notifications
- Mark-all-as-read
- Click → mark read (if unread) + navigate `link` or `/notifications`
- “View Notification Center” → `/notifications`

## 9. Routing & Navigation

- Protected route `/notifications` in `App.tsx`
- Nav item in `Navigation.tsx`
- Global search entry for Notification Center

## 10. Realtime Readiness

**Socket.IO server was NOT added.**

Prepared only:

- Backend: `notification.events.ts` — `notification.created | read | readAll | deleted`
- Frontend: `notificationEvents.ts` — `subscribeToNotificationEvents` / `notifyNotificationEvent`

Transport-agnostic; a future Socket.IO layer can subscribe/emit without changing producers or hooks.

## 11. Dashboard Integration

- Unread notification KPI via `useUnreadNotificationCount`
- Link into `/notifications` for alert follow-up
- No duplicate notification list query beyond shared hooks

## 12. Audit Logging

- Lifecycle create continues via operational audit services + Mongo notifications
- In-process events cover create/read/readAll/delete
- Per-read Mongo audit rows intentionally avoided (noise)

## 13. Tests

`npx ts-node --transpile-only src/modules/notifications/notification.test.ts`

**17 / 17 passed**, covering:

1. Creation (unread + event)
2. Owner-scoped retrieval
3. Pagination
4. Search
5. `unreadOnly`
6. Severity filter
7. Type filter
8. Get by id
9–10. Cross-user rejection (get/delete)
11–12. Mark one / mark all + unread count
13. Delete + event
14. Legacy metadata severity DTO
15–17. Maintenance / electricity / water producer integration shapes

Regression:

| Suite | Result |
|-------|--------|
| Dashboard | 16 / 16 |
| Maintenance | 17 / 17 |
| Electricity | 20 / 20 |
| Water | 19 / 19 |

**Total with notifications: 89 / 89**

## 14. Validation Results

| Check | Result |
|-------|--------|
| `npx prisma validate --schema=prisma/schema.prisma` (apps/api) | Pass |
| `npx prisma generate --schema=prisma/schema.prisma` | Pass |
| API `npx tsc --noEmit` | Pass |
| Web `npm run typecheck` | Pass |
| Web `npm run lint` | Pass (pre-existing Fast Refresh warnings in `authContext` / `Toast` only) |
| Web `npm run build` | Pass |

## 15. Files Created / Modified

### Created

- `apps/api/src/modules/notifications/notification.dto.ts`
- `apps/api/src/modules/notifications/notification.repository.ts`
- `apps/api/src/modules/notifications/notification.service.ts`
- `apps/api/src/modules/notifications/notification.controller.ts`
- `apps/api/src/modules/notifications/notification.router.ts`
- `apps/api/src/modules/notifications/notification.events.ts`
- `apps/api/src/modules/notifications/notification.test.ts`
- `apps/web/src/pages/Notifications.tsx`
- `apps/web/src/hooks/useNotifications.ts`
- `apps/web/src/services/notificationEvents.ts`
- `phase12_final_report.md`

### Modified

- `apps/api/src/modules/database/mongodb/schemas/notification.schema.ts`
- `apps/api/src/server.ts`
- `apps/api/src/modules/maintenance/maintenance.audit.service.ts`
- `apps/api/src/modules/electricity/electricity.audit.service.ts`
- `apps/api/src/modules/water/water.audit.service.ts`
- `apps/web/src/types/index.ts`
- `apps/web/src/components/layout/Header.tsx`
- `apps/web/src/components/Navigation.tsx`
- `apps/web/src/components/layout/GlobalSearchModal.tsx`
- `apps/web/src/App.tsx`
- `apps/web/src/pages/Dashboard.tsx`

## 16. Remaining Limitations

- No Socket.IO / push delivery yet (polling + in-process events only)
- No TTL / retention / archive policy
- No preference/channel settings (email, SMS, mute by type)
- No SUPER_ADMIN cross-user notification admin console
- Hard delete only (no soft-dismiss flag beyond `isRead`)
- Severity filter uses `$or` on top-level + `metadata.severity` for legacy docs
- Header dropdown does not auto-open detail modal (navigates to link or center)

## 17. Stop Confirmation

**Phase 12 is complete. Work stopped here.**

Not started (later phases):

- Parking
- Admin / User Management
- AI Assistant
- Announcements
- Campus-wide Analytics
- Cloudinary
- Gemini
- Redis
