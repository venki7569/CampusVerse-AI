# Phase 11 — Live Smart Campus Dashboard

## 1. Architecture Inspection

Inspected the existing monorepo before changes:

- Prisma schema (`apps/api/prisma/schema.prisma`) — used existing enums and models; **no schema changes**
- Mock `Dashboard.tsx` (hardcoded KPIs, charts, activity)
- Room occupancy: `PATCH /rooms/:id/occupancy`, `GET /rooms/occupancy-summary`, `OccupancySimulationService`, `RoomAuditService`
- Existing modules: auth, buildings, floors, rooms, departments, assets, maintenance, electricity, water
- TanStack Query hooks, Axios client, RBAC middleware, Swagger, Mongo audit/notification schemas
- In-process event buses (maintenance/electricity/water) — no Socket.IO server yet

Conclusion: a dedicated `GET /api/v1/dashboard/overview` aggregation endpoint was required. Reusing many separate list endpoints would have caused N+1 client traffic and inconsistent filter semantics.

## 2. Existing APIs Reused

| Source | How reused |
|--------|------------|
| Prisma counts / `groupBy` | Buildings, departments, rooms, assets, maintenance |
| `ElectricityRepository.getReadingsBetweenDates` | Energy KPIs, trends, building breakdown |
| `WaterRepository.getReadingsBetweenDates` | Water KPIs, trends, building breakdown |
| Mongo `AuditLog` | Recent campus activity feed |
| Mongo `Notification` (`UTILITY_ANOMALY`) | Energy/water anomaly alerts |
| `PATCH /rooms/:id/occupancy` | Rooms UI occupancy controls |
| Existing design system | `KpiCard`, `DataTable`, `ChartContainer`, `Skeleton`, `EmptyState`, `ErrorState` |

## 3. Backend Changes

### Created

- `apps/api/src/modules/dashboard/dashboard.dto.ts`
- `apps/api/src/modules/dashboard/dashboard.repository.ts`
- `apps/api/src/modules/dashboard/dashboard.service.ts`
- `apps/api/src/modules/dashboard/dashboard.controller.ts`
- `apps/api/src/modules/dashboard/dashboard.router.ts`
- `apps/api/src/modules/dashboard/dashboard.events.ts`
- `apps/api/src/modules/dashboard/dashboard.test.ts`

### Modified

- `apps/api/src/server.ts` — mount `/dashboard`, optional occupancy simulation startup
- `apps/api/src/config/env.ts` — `OCCUPANCY_SIMULATION_ENABLED`, `OCCUPANCY_SIMULATION_INTERVAL_MS`
- `apps/api/.env.example` — document simulation flags
- `apps/api/src/config/swagger.ts` — Dashboard tag
- `apps/api/src/modules/rooms/room.service.ts` — audit + dashboard event on occupancy change
- `apps/api/src/modules/rooms/room.controller.ts` — pass actor id to occupancy update
- `apps/api/src/modules/rooms/room.router.ts` — env-gated `POST /rooms/simulate-occupancy`
- `apps/api/src/modules/rooms/occupancy.service.ts` — safer simulation (skips UNDER_MAINTENANCE rooms)

### Cleanup

- Removed stale compiled artifacts under `apps/api/src/**` (`*.js`, `*.d.ts`) that shadowed TypeScript sources and broke `createLogger` at runtime for tests.

## 4. Frontend Changes

### Created

- `apps/web/src/hooks/useDashboard.ts`
- `apps/web/src/services/dashboardEvents.ts`

### Modified

- `apps/web/src/pages/Dashboard.tsx` — full live dashboard (no mock operational data)
- `apps/web/src/types/index.ts` — dashboard + occupancy types
- `apps/web/src/hooks/useRooms.ts` — `useUpdateOccupancy`, dashboard cache invalidation
- `apps/web/src/pages/Rooms.tsx` — RBAC occupancy selector using occupancy PATCH API
- `apps/web/src/pages/Electricity.tsx` — fixed pre-existing `dailyData` reference (blocked production build)
- `apps/web/src/pages/Water.tsx` — fixed toast API (`success`/`error`) and unused imports (blocked production build)

## 5. Dashboard Features

Live overview includes:

- KPI cards: buildings, departments, rooms (classrooms/labs subtitle), assets, open maintenance, occupied/available rooms, occupancy rate
- Occupancy pie + building occupancy table
- Electricity / water trend charts with empty states when no readings exist
- Maintenance status + asset health charts
- Building performance table (rooms, occupancy, electricity, water)
- Recent activity from Mongo audit logs
- Alerts: critical maintenance, electricity anomalies, water anomalies
- Filters: date range, building, department + manual refresh
- Loading skeletons, empty states, top-level error state with retry
- Polling: `refetchInterval` 30s, `staleTime` 15s

## 6. Occupancy Integration

- Occupancy buckets use Prisma `RoomOccupancyStatus` (`AVAILABLE`, `OCCUPIED`, `RESERVED`, `UNDER_MAINTENANCE`)
- Occupancy rate = `occupied / total * 100` (null when total = 0)
- Building-wise occupancy computed from a single room fetch (no N+1)
- Rooms page: authorized roles can change occupancy via `PATCH /rooms/:id/occupancy`
- Simulation:
  - Default **off**
  - Started only when `OCCUPANCY_SIMULATION_ENABLED=true` **and** `NODE_ENV !== production`
  - Optional admin trigger: `POST /api/v1/rooms/simulate-occupancy` (same gate)

## 7. Electricity Integration

- Daily / weekly / monthly totals and trend series from real readings
- Building breakdown for performance table
- Missing data returns `available: false` and UI shows “No electricity data available” (not fake zeros)
- Utility failures are isolated — other dashboard sections still render

## 8. Water Integration

- Same pattern as electricity with liters (`L`)
- Building breakdown + empty-state handling

## 9. Maintenance Integration

- Counts for REPORTED, ASSIGNED, IN_PROGRESS, RESOLVED, CLOSED, CANCELLED, REJECTED
- Open = REPORTED + ASSIGNED + IN_PROGRESS
- Critical open count + high-priority open list
- Average resolution hours from completed tickets (when available)

## 10. Asset Integration

- Distribution by `OperationalStatus`
- Percentages computed from real counts; empty dataset yields `percent: null`

## 11. Recent Activity

- Sourced from Mongo `AuditLog` (not mocked)
- Humanized messages for room occupancy, maintenance, utilities, assets
- Empty state when Mongo is offline or no audit rows exist

## 12. Filters

Query params on overview:

- `from`, `to` — analytics / maintenance createdAt window
- `buildingId`, `departmentId`, `floorId` — scope rooms/assets/maintenance/utilities where applicable

Filters that cannot be applied to a data source are not invented.

## 13. Socket.IO Readiness

- Backend: `dashboardEvents` in-process bus (`dashboard.updated`, `room.occupancy.changed`, …)
- Frontend: `subscribeToDashboardEvents` / `notifyDashboardEvent` integration point
- Occupancy mutations invalidate `dashboardKeys` and notify the client bus
- **No Socket.IO server was added** (none existed globally); transport can subscribe later without changing producers

## 14. Security / RBAC

- `GET /api/v1/dashboard/overview` requires `authenticate` (not public)
- Occupancy PATCH retains existing roles: SUPER_ADMIN, CAMPUS_ADMIN, DEPARTMENT_ADMIN, MAINTENANCE_STAFF
- Simulation endpoint restricted to SUPER_ADMIN / CAMPUS_ADMIN and env-gated

## 15. Tests

Executed with `npx ts-node --transpile-only`:

| Suite | Result |
|-------|--------|
| Dashboard (`dashboard.test.ts`) | **16 / 16 passed** |
| Maintenance | **17 / 17 passed** |
| Electricity | **20 / 20 passed** |
| Water | **19 / 19 passed** |
| **Total** | **72 / 72 passed** |

Dashboard coverage includes: KPI calc, occupancy rate, zero-room guard, building occupancy, maintenance summary, asset health, electricity/water aggregation, empty utilities, partial electricity failure, filters, audit activity, empty assets.

No frontend test framework exists — not introduced in this phase.

## 16. Validation Results

| Check | Result |
|-------|--------|
| `npx prisma validate` | **PASSED** |
| `npx prisma generate` | **PASSED** |
| Backend `npx tsc --noEmit` | **PASSED** |
| Backend `npx tsc` (build) | **PASSED** |
| Frontend `npm run typecheck` | **PASSED** |
| Frontend `npm run lint` | **PASSED** (pre-existing warnings only in Electricity/Water/Toast/authContext) |
| Frontend `npm run build` | **PASSED** |
| Tests | **72 / 72 passed** |

## Remaining Limitations

1. Dashboard overview is authenticated but not role-restricted beyond login (any authenticated role can view).
2. Real-time still uses polling + in-process event hooks; Socket.IO transport is not implemented.
3. Recent activity / anomaly alerts depend on Mongo being available.
4. Seed data still lacks a demo admin user and sample utility readings — empty states will show until data exists.
5. Prisma migrations folder is still unused (schema-only workflow unchanged).
6. Dead nav links (`/ai-assistant`, `/admin`, `/utilities`) were intentionally left for later phases.

## Stop Condition

Phase 11 complete. Did **not** start Notifications, Admin, Parking, AI Assistant, campus-wide analytics, predictive maintenance, or production deployment.
