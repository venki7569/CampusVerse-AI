# Phase 15 — Campus-Wide Analytics Final Report

**Status:** COMPLETE  
**Date:** 2026-08-29  
**Scope:** Unified campus analytics module reusing Phase 11–14 infrastructure. Phase 16 not started.

---

## 1. Architecture inspection

Reused existing:

- **Dashboard** aggregation patterns (`calculateOccupancyRate`, utility grouping, maintenance/asset counts)
- **ElectricityRepository** / **WaterRepository** `getReadingsBetweenDates` (kWh / liters interval consumption)
- **Parking** slot status groupBy from Phase 14
- **MongoDB** `AuditLog` (occupancy/parking trend events, analytics audit)
- **MongoDB** `Notification` (utility anomaly counts, unread alerts)
- **MongoDB** `AnalyticsSnapshot` (optional report snapshot persistence on report generation)
- Phase 13 RBAC (`authenticate`, `requirePermission`)

No new Prisma models. No mock data.

## 2. Existing analytics infrastructure

| Source | Used for |
|---|---|
| Dashboard overview | Reference patterns; not duplicated wholesale |
| Electricity readings | Consumption trends, building/department totals (kWh) |
| Water readings | Consumption trends, building totals (liters) |
| Maintenance requests | Status/priority/category/building/department analytics |
| Assets | Category/condition/status/building/department distribution |
| Room occupancy | Campus/building/floor occupancy snapshots |
| Parking slots | Capacity, allocation, utilization, type/status breakdown |
| Notifications | Utility anomaly counts, unread alert KPI |
| AuditLog | Occupancy change + parking allocate/release trend series |
| AnalyticsSnapshot | Report snapshot metadata on `/reports` (upsert, non-fatal) |

## 3. Backend implementation

Module: `apps/api/src/modules/analytics/`

- `analytics.dto.ts` — Zod validation, date presets, response types
- `analytics.repository.ts` — Prisma groupBy/count aggregations
- `analytics.service.ts` — Orchestration, trend grouping, report assembly
- `analytics.controller.ts`
- `analytics.router.ts`
- `analytics.events.ts`
- `analytics.audit.service.ts`
- `analytics.snapshot.service.ts`
- `analytics.test.ts`

## 4. API endpoints

Mounted at `/api/v1/analytics`:

| Method | Path | Permission |
|---|---|---|
| GET | `/overview` | `analytics.view` |
| GET | `/trends` | `analytics.view` |
| GET | `/buildings` | `analytics.view` |
| GET | `/departments` | `analytics.view` |
| GET | `/utilities` | `analytics.view` |
| GET | `/maintenance` | `analytics.view` |
| GET | `/assets` | `analytics.view` |
| GET | `/occupancy` | `analytics.view` |
| GET | `/parking` | `analytics.view` |
| GET | `/reports?category=...` | `analytics.report` |

## 5. Analytics calculations

- **Electricity:** Sum of `kwhConsumption` per reading in range (not cumulative meter values)
- **Water:** Sum of `litersConsumption` per reading in range
- **Occupancy rate:** `occupied / total * 100` (1 decimal), null when total = 0
- **Parking utilization:** `(occupied + reserved) / total * 100`
- **Maintenance resolution:** Average hours from `createdAt` → `completedAt` for RESOLVED/CLOSED (max 500 recent)
- **Asset warranty:** Count where `warrantyExpiry` within next 30 days

## 6. Date-range behavior

Presets: `today`, `yesterday`, `last7days`, `last30days`, `last90days`, `currentMonth`, `previousMonth`, `custom`.

- Default when unspecified: `last30days`
- Custom requires `from` and/or `to`
- **`from > to` rejected** with 400 (Zod + service validation)
- Maintenance filtering uses `createdAt` within range

## 7–13. Domain analytics

All implemented via dedicated service methods and repository aggregations:

- Building comparison (paginated, sortable)
- Department metrics (rooms, assets, maintenance, meters, kWh)
- Asset distributions (category, condition, status, building, department)
- Maintenance (status, priority, category, building, department, asset-related, technician workload)
- Occupancy (campus + by building + by floor)
- Parking (areas, slots, type/status, building utilization)
- Utilities (combined electricity + water with anomaly counts)

## 14. Snapshot implementation

- **Primary:** Live PostgreSQL + Mongo aggregation (no background worker)
- **Optional:** `AnalyticsSnapshotService.saveReportSnapshot` on report generation only
- Upserts by `(metricName, dimension, period, startDate)` — avoids uncontrolled high-frequency writes
- Snapshot failure is non-fatal (logged, does not block report)

## 15. RBAC

Added to `PERMISSION_CATALOG`:

- `analytics.view`
- `analytics.report`

Default mappings:

| Role | Permissions |
|---|---|
| SUPER_ADMIN, CAMPUS_ADMIN | view + report |
| DEPARTMENT_ADMIN | view + report |
| FACULTY, MAINTENANCE_STAFF, SECURITY_STAFF | view |
| STUDENT | none |

## 16. Audit logging

Mongo `AuditLog` records:

- `analyticsViewed` (section metadata)
- `analyticsReportGenerated` (category metadata)

No per-internal-query noise.

## 17. Realtime readiness

`analytics.events.ts`:

- `analytics.updated`
- `analytics.report.generated`

Transport-agnostic; no Socket.IO.

## 18. Frontend implementation

- Types in `apps/web/src/types/index.ts`
- Hooks in `apps/web/src/hooks/useAnalytics.ts`
- Page `apps/web/src/pages/Analytics.tsx`
- Recharts charts (existing library)
- Date presets, building filter, KPI cards, trend charts, breakdown tables, utility anomaly banner

## 19. Dashboard integration

- Phase 11 Dashboard unchanged functionally
- Added **Campus Insights** link on Dashboard → `/analytics`
- Analytics nav entry + Global Search registration

## 20. Tests

| Suite | Result |
|---|---|
| **Analytics** | **14 / 14 PASSED** |
| Parking | 24 / 24 PASSED |
| Dashboard | 16 / 16 PASSED |
| Notifications | 17 / 17 PASSED |
| Admin / RBAC | 38 / 38 PASSED |
| Maintenance | 17 / 17 PASSED |
| Electricity | 20 / 20 PASSED |
| Water | 19 / 19 PASSED |
| **Total** | **165 / 165 PASSED** |

## 21. Validation

| Check | Result |
|---|---|
| `npx prisma validate` | Valid |
| `npx prisma generate` | Success |
| API `npx tsc --noEmit` | Exit 0 |
| Web `npm run typecheck` | Exit 0 |
| Web `npm run lint` | Exit 0 (2 pre-existing warnings) |
| Web `npm run build` | Exit 0 |

## 22. Files created/modified

### Created
- `apps/api/src/modules/analytics/*` (9 files)
- `apps/web/src/hooks/useAnalytics.ts`
- `apps/web/src/pages/Analytics.tsx`
- `phase15_final_report.md`

### Modified
- `apps/api/src/modules/admin/admin.permissions.ts`
- `apps/api/src/server.ts`
- `apps/api/src/config/swagger.ts`
- `apps/web/src/types/index.ts`
- `apps/web/src/App.tsx`
- `apps/web/src/components/Navigation.tsx`
- `apps/web/src/components/layout/GlobalSearchModal.tsx`
- `apps/web/src/pages/Dashboard.tsx`

## 23. Known limitations

- **Occupancy/parking trends** rely on audit log events when historical point-in-time occupancy is unavailable; empty when no audit data exists
- **Building analytics** fetches per-building metrics in a loop (bounded by paginated building count; may benefit from future SQL aggregation/caching)
- **Department electricity** only where meters have `departmentId`
- **No PDF/CSV export** in this phase (JSON reports ready for future export)
- **No Redis caching** — expensive ranges documented for future optimization
- Re-seed permissions in environments needing `analytics.*` RolePermission rows

## 24. Database migration requirements

**None.** No Prisma schema changes in Phase 15. Existing Mongo `AnalyticsSnapshot` collection used as-is.

---

**Phase 15 completed. Work stopped here. Phase 16 not started.**
