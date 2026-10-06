# Phase 17 — Announcements & Campus Communication — Final Report

## 1. Architecture Inspected

The repository already contained a minimal Prisma `Announcement` model (title, content, authorId, targetRole, expiresAt). Phase 17 extended it into a full campus communication system while reusing:

- Phase 12 notification service (`publishNotification`)
- Phase 13 RBAC (`requirePermission`, permission catalog, role defaults)
- MongoDB audit logging (`AuditLog`)
- Transport-agnostic events (same pattern as notifications, parking, AI)
- Dashboard overview composition
- AI assistant tool layer (read-only)

No Redis, BullMQ, Socket.IO, email, or background workers were introduced.

---

## 2. Existing Announcement Schema (Before)

```prisma
model Announcement {
  id, title, content, authorId, targetRole?, expiresAt?, createdAt, updatedAt
}
```

Insufficient for lifecycle, categories, priorities, multi-type targeting, scheduling, or read tracking.

---

## 3. Schema Changes (Backward-Compatible Extension)

Added enums:

- `AnnouncementStatus`: DRAFT, SCHEDULED, PUBLISHED, EXPIRED, ARCHIVED, CANCELLED
- `AnnouncementPriority`: LOW, NORMAL, HIGH, URGENT
- `AnnouncementCategory`: GENERAL, ACADEMIC, EXAMINATION, EVENT, MAINTENANCE, EMERGENCY, TRANSPORT, FACILITY, SECURITY, OTHER
- `AnnouncementAudienceType`: ALL, ROLE, DEPARTMENT, BUILDING, USER

Extended `Announcement` with: category, priority, status, audienceType, targetDepartmentId, targetBuildingId, targetUserId, scheduledAt, publishedAt, notificationsSentAt, author relation.

Added `AnnouncementRead` model for per-user read tracking (separate from notification read state).

**Note:** Schema validates via Prisma; apply with `prisma db push` or your project's migration workflow (no migrations folder existed at implementation time).

---

## 4. Backend Files Created

| File | Purpose |
|------|---------|
| `announcement.dto.ts` | Zod validation, DTOs |
| `announcement.visibility.ts` | Visibility, audience matching, lifecycle transitions |
| `announcement.repository.ts` | Prisma queries, audience resolution, read tracking |
| `announcement.service.ts` | Business logic, notifications, lazy scheduling/expiration |
| `announcement.controller.ts` | HTTP handlers |
| `announcement.router.ts` | Routes + Swagger JSDoc |
| `announcement.audit.service.ts` | MongoDB audit integration |
| `announcement.events.ts` | Transport-agnostic events |
| `announcement.test.ts` | 14 deterministic tests |

---

## 5. Backend Files Modified

| File | Change |
|------|--------|
| `prisma/schema.prisma` | Extended Announcement + AnnouncementRead |
| `admin.permissions.ts` | Added `announcement.*` permissions |
| `server.ts` | Mounted `/api/v1/announcements` |
| `swagger.ts` | Announcements tag |
| `dashboard.dto.ts` | Optional `announcements` block in overview |
| `dashboard.controller.ts` | Injects announcement feed summary |
| `dashboard.router.ts` | Wires AnnouncementService |
| `ai.tools.ts` | Added `getAnnouncements` tool |
| `ai.router.ts` | Wires AnnouncementService into AI tools |

---

## 6. API Endpoints

| Method | Path | Permission | Description |
|--------|------|------------|-------------|
| GET | `/api/v1/announcements/unread-count` | `announcement.view` | Unread count |
| GET | `/api/v1/announcements/feed-summary` | `announcement.view` | Latest + counts |
| GET | `/api/v1/announcements` | `announcement.view` | User feed or admin list (`adminView=true`) |
| POST | `/api/v1/announcements` | `announcement.create` | Create draft/scheduled |
| GET | `/api/v1/announcements/:id` | `announcement.view` | Detail (visibility enforced) |
| PATCH | `/api/v1/announcements/:id` | `announcement.update` | Edit draft/scheduled |
| PATCH | `/api/v1/announcements/:id/read` | `announcement.view` | Mark read |
| POST | `/api/v1/announcements/:id/publish` | `announcement.publish` | Publish now |
| POST | `/api/v1/announcements/:id/schedule` | `announcement.publish` | Schedule |
| POST | `/api/v1/announcements/:id/cancel` | `announcement.update` | Cancel scheduled |
| POST | `/api/v1/announcements/:id/archive` | `announcement.update` | Archive |
| DELETE | `/api/v1/announcements/:id` | `announcement.delete` | Delete |

Static routes (`/unread-count`, `/feed-summary`) are registered before `/:id`.

---

## 7. Lifecycle Workflow

Valid transitions enforced via `canTransitionStatus()`:

- DRAFT → SCHEDULED | PUBLISHED | ARCHIVED
- SCHEDULED → PUBLISHED | CANCELLED | ARCHIVED
- PUBLISHED → ARCHIVED | EXPIRED (lazy on expiration)
- EXPIRED, ARCHIVED, CANCELLED → terminal

Lazy promotion: SCHEDULED items with `scheduledAt <= now` become PUBLISHED on read/list (no cron worker).

---

## 8. Audience Targeting

Server-side `isAnnouncementVisibleToUser()` / Prisma feed filters:

| Type | Rule |
|------|------|
| ALL | Everyone |
| ROLE | User has `targetRole` |
| DEPARTMENT | User's `departmentId` matches |
| BUILDING | User's department has rooms in building |
| USER | Specific `targetUserId` |

Department admins are restricted to their own department (and cannot target ALL/BUILDING).

---

## 9. RBAC Permissions

| Permission | SUPER/CAMPUS ADMIN | DEPT ADMIN | Others |
|------------|-------------------|------------|--------|
| announcement.view | ✓ | ✓ | ✓ (all roles) |
| announcement.create/update/publish | ✓ | ✓ (scoped) | ✗ |
| announcement.delete/manage | ✓ | ✗ | ✗ |

---

## 10. Read/Unread Implementation

- `AnnouncementRead` Prisma model (`announcementId`, `userId`, unique constraint)
- Separate from notification `isRead`
- `GET /unread-count`, feed `isRead` flag, `PATCH /:id/read`

---

## 11. Notification Integration

On publish (and lazy scheduled promotion):

- Calls existing `publishNotification()` per eligible user
- Type: `ANNOUNCEMENT`
- Severity mapped from priority (URGENT→URGENT, etc.)
- Link: `/announcements?highlight={id}`
- `notificationsSentAt` prevents duplicate fan-out

---

## 12. Audit Logging

Actions: `announcementCreated`, `announcementUpdated`, `announcementScheduled`, `announcementPublished`, `announcementCancelled`, `announcementArchived`, `announcementRead`

Metadata only — no full content or secrets.

---

## 13. Event Architecture

Events: `announcement.created`, `.updated`, `.scheduled`, `.published`, `.cancelled`, `.archived`, `.read`

In-process pub/sub; ready for future Socket.IO transport.

---

## 14. Dashboard Integration

`GET /api/v1/dashboard/overview` now includes optional:

```json
"announcements": {
  "unreadCount": 2,
  "urgentCount": 1,
  "latest": [...]
}
```

Only when user has `announcement.view`.

---

## 15. Frontend Implementation

| File | Purpose |
|------|---------|
| `pages/Announcements.tsx` | Feed + admin manage tab |
| `hooks/useAnnouncements.ts` | TanStack Query hooks |
| `components/announcements/AnnouncementComposer.tsx` | Create form |
| `App.tsx` | `/announcements` route |
| `Navigation.tsx` | Sidebar link |
| `GlobalSearchModal.tsx` | Search entry |
| `Header.tsx` | Announcements shortcut + unread badge |
| `types/index.ts` | Announcement types |

---

## 16. AI Integration

Added read-only `getAnnouncements` tool:

- Triggered by announcement/notice/urgent keywords
- Uses `listForAI()` with same visibility rules as user feed
- Requires `announcement.view`
- Cannot create or publish announcements

---

## 17. Swagger

All announcement endpoints documented via `@openapi` JSDoc in `announcement.router.ts`. Tag: **Announcements**.

---

## 18. Security Controls

- JWT required on all routes
- RBAC on management operations
- Server-side audience filtering (not frontend-only)
- Department admin scoping enforced in service
- Draft/scheduled/expired/archived never leak to user feed
- No trust of client-supplied role/department for authorization
- Read state scoped per user

---

## 19. Tests

**Announcements:** 14 tests covering visibility, lifecycle, targeting, notifications, read/unread, department scoping, AI access.

**Regression total:** **199/199**

| Suite | Tests |
|-------|-------|
| Dashboard | 16 |
| Notifications | 17 |
| Admin | 38 |
| Maintenance | 17 |
| Electricity | 20 |
| Water | 19 |
| Parking | 24 |
| Analytics | 14 |
| AI | 20 |
| **Announcements (new)** | **14** |

---

## 20. Validation Results

| Check | Result |
|-------|--------|
| `npx prisma validate` | Pass |
| `npx prisma generate` | Pass |
| Backend `npx tsc --noEmit` | Pass |
| Frontend `npm run typecheck` | Pass |
| Frontend `npm run build` | Pass |
| All test suites | 199/199 |

---

## 21. Known Limitations

- No background worker — scheduling/expiration uses lazy promotion on API access
- Notification fan-out is synchronous (may be slow for very large campuses; designed for future queue)
- Building audience uses department-room association heuristic
- No email/SMS/push delivery
- Existing DBs need schema push + permission re-seed for `announcement.*` codes

---

## 22. Recommended Phase 18

1. Background job for scheduled publish and expiration at scale
2. Email digest for urgent announcements
3. Rich text / attachments for announcements
4. Announcement analytics (views, reach, engagement)
5. Socket.IO live feed updates
6. User-specific targeting picker in admin UI

---

**Phase 17 status: COMPLETE**
