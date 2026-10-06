# Phase 20 Final Report — IoT Integration, Advanced Operational Automation & Control Center

**Date:** 2026-08-29  
**Status:** COMPLETE — STOP (Phase 21 not started)

---

## Executive Summary

Phase 20 bridges CampusVerse AI's software-based digital twin with real operational/IoT data. The system supports device registration, transport-agnostic telemetry ingestion, device health monitoring, explainable rule-based alerts, human-approved operational actions, and realtime updates — while preserving all Phase 1–19 functionality and RBAC.

---

## 1. Device Architecture

### Prisma model: `IoTDevice`
- **Location:** `apps/api/prisma/schema.prisma`
- **Migration:** `apps/api/prisma/migrations/20250829100000_phase20_iot_devices/migration.sql`
- **Design:** Does **not** duplicate `ElectricityMeter` / `WaterMeter`. Devices link via optional FKs:
  - `electricityMeterId`, `waterMeterId`, `roomId`, `buildingId`, `floorId`, `assetId`
- **Types:** `ELECTRICITY_METER`, `WATER_METER`, `OCCUPANCY_SENSOR`, `TEMPERATURE_SENSOR`, `HUMIDITY_SENSOR`, `AIR_QUALITY_SENSOR`, `LIGHT_SENSOR`, `PARKING_SENSOR`, `OTHER`
- **Status:** `ONLINE`, `OFFLINE`, `STALE`, `MAINTENANCE`, `ARCHIVED`
- **Ingest auth:** Optional `ingestKeyHash` (SHA-256 of device key, header `X-Device-Key`)

### API endpoints
| Method | Path | Permission |
|--------|------|------------|
| GET | `/api/v1/iot/summary` | `iot.view` |
| GET | `/api/v1/iot/devices` | `iot.view` |
| GET | `/api/v1/iot/devices/:id` | `iot.view` |
| GET | `/api/v1/iot/devices/:id/health` | `iot.view` |
| GET | `/api/v1/iot/devices/:id/telemetry` | `iot.view` |
| POST | `/api/v1/iot/devices` | `iot.manage` |
| PATCH | `/api/v1/iot/devices/:id` | `iot.manage` |
| DELETE | `/api/v1/iot/devices/:id` | `iot.manage` (archive) |
| GET | `/api/v1/iot/occupancy/rooms/:roomId` | `iot.view` |
| GET | `/api/v1/iot/environment/buildings/:buildingId` | `iot.view` |

---

## 2. Telemetry Architecture

### Ingestion endpoints
- `POST /api/v1/iot/telemetry` — batch or single point (`iot.ingest`)
- `POST /api/v1/iot/devices/:deviceId/telemetry` — device-scoped ingest

### Payload schema
```json
{
  "deviceId": "sensor-101",
  "timestamp": "2026-08-29T10:00:00Z",
  "metric": "temperature",
  "value": 22.5,
  "unit": "Celsius",
  "quality": "GOOD",
  "idempotencyKey": "optional-unique-key"
}
```

### Validation (reject safely)
- Device existence and active state
- Timestamp window (no future, max age configurable)
- Metric/unit compatibility matrix
- Numeric range per metric
- `BAD` quality rejection
- Idempotency via Redis + Mongo unique index

---

## 3. Storage Strategy

| Data type | Store | Rationale |
|-----------|-------|-----------|
| Electricity `kwh` | `ElectricityReading` (PostgreSQL) | Reuses existing meter infrastructure |
| Water `liters` | `WaterReading` (PostgreSQL) | Reuses existing meter infrastructure |
| Occupancy, environmental, other sensors | `TelemetryReading` (MongoDB) | High-frequency time-series; TTL 90 days |
| Operational actions | `OperationalAction` (MongoDB) | Workflow state machine |
| Latest device/occupancy state | Redis (optional) | Fast reads; graceful degrade |

**Authoritative stores:** PostgreSQL + MongoDB. Redis is cache/dedup only.

---

## 4. Ingestion Adapters

**Module:** `apps/api/src/modules/iot/telemetry.adapters.ts`

| Interface | Phase 20 | Future |
|-----------|----------|--------|
| `TelemetrySource` | `RestTelemetrySource` | MQTT, WebSocket, gateways |
| `TelemetryProcessor` | `DefaultTelemetryProcessor` | — |
| `TelemetryRepository` | `MongoTelemetryRepository` | — |

Business logic in `IoTService` is adapter-agnostic; new transports plug in without changing rules or actions.

---

## 5. Device Health

**Service:** `device-health.service.ts`

Explainable rules:
- Never claims hardware failure — uses communication-loss language
- `"Device has not reported for N minutes."`
- Health score 0–100 with issue codes: `OFFLINE`, `STALE`, `NEVER_SEEN`, `INVALID_READINGS`
- Data freshness: `LIVE` | `STALE` | `UNKNOWN`

---

## 6. Digital Twin Integration

Extended existing `DigitalTwinService` (no duplicate twin):
- Overview includes `iot` block: total/online/offline/stale/maintenance/activeAlerts
- Telemetry ingestion emits `digitalTwin.updated`
- Building/room/asset drill-down unchanged; IoT enriches via linked entities

---

## 7. Realtime Events

**Socket.IO channels:** `iot`, `digital-twin`

| Event | Trigger |
|-------|---------|
| `telemetry.updated` | Successful ingest |
| `device.online` | Offline → online transition |
| `device.offline` | Stale scan / threshold |
| `device.alert` | Rule engine alert |
| `occupancy.updated` | Occupancy sensor |
| `utility.updated` | Meter reading routed |
| `digitalTwin.updated` | IoT + existing twin events |
| `action.proposed/approved/completed` | Action workflow |

Electricity/water domain events now bridged to Socket.IO via `event-bridge.ts`.

Frontend `RealtimeProvider` invalidates `iot` and `digital-twin` React Query caches selectively.

---

## 8. Utility Intelligence

- Real telemetry routes to `ElectricityService.createReading()` / `WaterService.createReading()`
- Baseline comparison via Redis-cached rolling baseline
- Rule: `UTILITY_ANOMALY` — never states "leak confirmed"; uses "possible abnormal flow pattern"

---

## 9. Occupancy Intelligence

- Occupancy sensors update rooms via `RoomService.updateOccupancy()` with `source: IOT_SENSOR`
- Redis cache: count, timestamp, `LIVE`/`STALE` status
- Over-capacity rule: `OCCUPANCY_OVER_CAPACITY`
- Stale data explicitly marked — not presented as live

---

## 10. Environmental Monitoring

- Temperature, humidity, air quality stored in MongoDB
- Configurable thresholds in `env.ts` (`IOT_TEMP_HIGH_C`, etc.)
- Building environmental summary endpoint
- No medical/health claims

---

## 11. Rule Engine

**Service:** `rule-engine.service.ts`

Explainable IF/THEN rules producing structured events:
- Occupancy over capacity
- Device offline (communication gap)
- Utility anomaly (baseline multiplier)
- Environmental threshold exceeded

Rules **do not** mutate operational records directly — they propose actions and notifications.

---

## 12. Human-Approved Actions

**Mongo model:** `OperationalAction`

States: `PROPOSED` → `APPROVED` → `EXECUTING` → `COMPLETED` | `FAILED` | `CANCELLED`

Supported executions (after approval + RBAC):
- `CREATE_MAINTENANCE_REQUEST`
- `MARK_DEVICE_INSPECTION`
- `GENERAL` (audit-only)

Every action records actor, reason, source, affected entity, result.

---

## 13. AI Action Planning

Extended `CampusTools` with read-only IoT tools:
- `getDeviceHealthSummary`
- `getLiveTelemetrySummary`
- `getEnvironmentalConditions`
- `getProposedOperationalActions`

AI **cannot** auto-execute. Tool responses include source grounding and stale-data notes. Action planning requires human confirmation via `/iot` approval UI.

---

## 14. IoT Control Center

**Route:** `/iot`  
**Page:** `apps/web/src/pages/IoTControlCenter.tsx`

Features:
- Device KPIs (total, online, offline, stale, maintenance)
- Device list with type/status filters
- Device health drill-down
- Pending action approval UI (Approve/Reject)

---

## 15. Digital Twin Enhancements

**Route:** `/digital-twin`

Added live IoT indicators section with Socket.IO-driven cache invalidation (no full page reload).

---

## 16. Security / RBAC

New permissions:
- `iot.view`, `iot.manage`, `iot.ingest`, `iot.actions`

Role assignments:
- **SUPER_ADMIN / CAMPUS_ADMIN:** full IoT
- **MAINTENANCE_STAFF / SECURITY_STAFF:** view + actions
- **DEPARTMENT_ADMIN / FACULTY:** view only
- **STUDENT:** no IoT access

Ingest requires JWT + `iot.ingest`; optional per-device key hash.

---

## 17. Redis Integration

Used for:
- Latest device state (`iot:device:{id}:latest`)
- Occupancy cache (`iot:occupancy:{roomId}`)
- Telemetry deduplication (`iot:dedup:{key}`)
- Alert cooldowns (`iot:alert:{dedupeKey}`)
- Invalid reading counters
- Utility baselines

Graceful degrade when Redis unavailable — PostgreSQL/Mongo remain authoritative.

---

## 18. Audit Logging

MongoDB `AuditLog` events:
- `deviceCreated`, `deviceUpdated`, `deviceArchived`
- `telemetryIngested`, `deviceAlertCreated`
- `actionProposed`, `actionApproved`, `actionRejected`, `actionCompleted`

Raw telemetry values not logged in audit entries.

---

## 19. Database Changes

### PostgreSQL
- New enums: `IoTDeviceType`, `IoTDeviceStatus`
- New table: `IoTDevice` with indexes and FKs to Building, Floor, Room, Asset, ElectricityMeter, WaterMeter

### MongoDB
- `TelemetryReading` — time-series with 90-day TTL
- `OperationalAction` — approval workflow

---

## 20. Tests

| Suite | Tests | Status |
|-------|-------|--------|
| Phase 1–19 suites | 216 | PASS |
| `iot.test.ts` (new) | 12 | PASS |
| **Total** | **228** | **PASS** |

IoT test coverage:
- Telemetry validation (valid, invalid unit/value/timestamp/quality)
- Device health (online, offline, stale language)
- Rule engine (occupancy, utility anomaly, device offline)
- Event emission
- Idempotency concept

---

## 21. Validation Results

| Command | Result |
|---------|--------|
| `npx prisma validate` | PASS |
| `npx prisma generate` | PASS |
| `npx tsc --noEmit` (API) | PASS |
| `npm test` (13/13 suites) | PASS |
| `npm run typecheck` (root) | PASS |
| `npm run lint` | PASS (pre-existing warnings only) |
| `npm run build` (web) | PASS |

---

## 22. Deployment Changes

- **No MQTT broker required** — REST ingestion only in Phase 20
- Optional env vars documented in `apps/api/src/config/env.ts` under `iot.*`
- Apply migration: `npx prisma migrate deploy` (or run `migration.sql`)
- MongoDB TTL index created on first `TelemetryReading` write
- Docker unchanged — no new infrastructure services

---

## 23. Known Limitations

1. MQTT/WebSocket adapters are interface-only — not implemented
2. Simulated devices require manual registration + REST ingest (no auto-discovery)
3. Parking sensor telemetry stored in Mongo but not yet wired to parking slot status
4. Utility baseline is simplified (Redis rolling estimate, not full analytics integration)
5. Device offline scan is on-demand (`scanOfflineDevices`) — no background cron in Phase 20
6. Action types beyond maintenance/inspection are audit placeholders

---

## 24. Recommended Phase 21

1. **MQTT ingestion adapter** with device provisioning workflow
2. **Background device health scheduler** (cron/worker)
3. **Deep utility intelligence** — integrate live telemetry into Phase 19 anomaly detection
4. **Parking sensor → slot status** bidirectional sync
5. **Operational action dashboard** with full maintenance/assignment workflows
6. **Device simulation CLI** for development seeding
7. **Building-scoped Socket.IO rooms** for large-campus scale

---

## STOP Condition

Phase 20 is complete. Phase 21 has **not** been started. No autonomous unrestricted control was introduced. No unsupported ML models were added.
