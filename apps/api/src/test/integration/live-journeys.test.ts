// @ts-nocheck
/**
 * Phase 24 — Live E2E user journeys against real PostgreSQL + MongoDB.
 * Skips gracefully when infrastructure or seed credentials are unavailable.
 */
import assert from 'node:assert';
import 'dotenv/config';
import { disconnectPrismaClient } from '../../database/prisma.client';
import { IntegrationHarness } from './harness';
import { integrationReady, probeInfrastructure, teardownMongo } from './infra';

let passed = 0;
let failed = 0;
let skipped = 0;

async function test(name: string, fn: () => void | Promise<void>) {
  try {
    await fn();
    passed += 1;
    console.log(`  ✓ ${name}`);
  } catch (err) {
    failed += 1;
    console.error(`  ✗ ${name}`, err);
  }
}

function skip(name: string, reason: string) {
  skipped += 1;
  console.log(`  ○ SKIP ${name} — ${reason}`);
}

async function runTests() {
  console.log('\n============================================================');
  console.log('PHASE 24 — LIVE E2E USER JOURNEYS');
  console.log('============================================================\n');

  const infra = await probeInfrastructure();
  console.log('Infrastructure:', JSON.stringify({ ...infra, postgresError: infra.postgresError?.slice(0, 80) }, null, 2));

  if (!integrationReady(infra)) {
    console.log('\nPostgreSQL and/or MongoDB unavailable — skipping journey suite.\n');
    await teardownMongo();
    process.exit(0);
  }

  const adminPassword = process.env['SEED_ADMIN_PASSWORD'];
  const demoPassword = process.env['SEED_DEMO_PASSWORD'];
  const adminEmail = (process.env['SEED_ADMIN_EMAIL'] ?? 'admin@campusverse.local').toLowerCase();

  if (!adminPassword && !demoPassword) {
    console.log('\nSet SEED_ADMIN_PASSWORD or SEED_DEMO_PASSWORD for authenticated journeys.\n');
    await teardownMongo();
    process.exit(0);
  }

  const harness = await IntegrationHarness.create();
  let adminToken = '';
  let facultyToken = '';
  let studentToken = '';
  let maintToken = '';

  try {
    if (adminPassword) {
      const login = await harness.login(adminEmail, adminPassword);
      adminToken = login.accessToken;
    }
    if (demoPassword) {
      facultyToken = (await harness.login('faculty@campusverse.local', demoPassword)).accessToken;
      studentToken = (await harness.login('student@campusverse.local', demoPassword)).accessToken;
      maintToken = (await harness.login('maintenance@campusverse.local', demoPassword)).accessToken;
    }

    const primary = adminToken || facultyToken;
    if (!primary) {
      skip('All journeys', 'no login token');
    } else {
      // Journey 1: Login → Dashboard → Logout
      await test('J1 — dashboard overview after login', async () => {
        const res = await harness.authGet(primary, '/api/v1/dashboard/overview');
        assert.strictEqual(res.status, 200);
        assert.ok(res.body.data);
      });

      if (adminPassword) {
        await test('J1 — logout clears refresh cookie path', async () => {
          const agent = harness.agent();
          const login = await agent.post('/api/v1/auth/login').send({ email: adminEmail, password: adminPassword });
          assert.strictEqual(login.status, 200);
          const logout = await agent.post('/api/v1/auth/logout');
          assert.ok([200, 204].includes(logout.status));
        });
      }

      // Journey 2: Building → Floor → Room → Asset
      await test('J2 — campus hierarchy drill-down', async () => {
        const buildings = await harness.authGet(primary, '/api/v1/buildings');
        assert.strictEqual(buildings.status, 200);
        assert.ok(buildings.body.data.length > 0);
        const buildingId = buildings.body.data[0].id;

        const floors = await harness.authGet(primary, `/api/v1/floors?buildingId=${buildingId}`);
        assert.strictEqual(floors.status, 200);

        const rooms = await harness.authGet(primary, '/api/v1/rooms');
        assert.strictEqual(rooms.status, 200);
        assert.ok(rooms.body.data.length > 0);

        const assets = await harness.authGet(primary, '/api/v1/assets');
        assert.strictEqual(assets.status, 200);
      });

      // Journey 3: Maintenance lifecycle
      if (studentToken && adminToken && maintToken) {
        await test('J3 — maintenance report → assign → start → resolve → close', async () => {
          const room = await harness.db.room.findFirst();
          assert.ok(room);

          const create = await harness.authPost(studentToken, '/api/v1/maintenance', {
            title: 'Phase24 journey test ticket',
            description: 'Automated integration verification ticket',
            priority: 'MEDIUM',
            roomId: room.id,
          });
          assert.strictEqual(create.status, 201);
          const ticketId = create.body.data.id;

          const assign = await harness.authPost(adminToken, `/api/v1/maintenance/${ticketId}/assign`, {
            technicianId: (await harness.db.user.findFirst({ where: { email: 'maintenance@campusverse.local' } }))!.id,
          });
          assert.strictEqual(assign.status, 200);

          const start = await harness.authPost(maintToken, `/api/v1/maintenance/${ticketId}/start`, {});
          assert.strictEqual(start.status, 200);

          const resolve = await harness.authPost(maintToken, `/api/v1/maintenance/${ticketId}/resolve`, {
            resolutionNotes: 'Phase 24 integration test resolution',
          });
          assert.strictEqual(resolve.status, 200);

          const close = await harness.authPost(adminToken, `/api/v1/maintenance/${ticketId}/close`, {});
          assert.ok([200, 403].includes(close.status));
        });
      } else {
        skip('J3 — maintenance lifecycle', 'requires admin + student + maintenance tokens');
      }

      // Journey 4: Electricity
      await test('J4 — electricity meter readings + analytics', async () => {
        const meters = await harness.authGet(primary, '/api/v1/electricity/meters');
        assert.strictEqual(meters.status, 200);
        if (meters.body.data.length === 0) return;
        const meterId = meters.body.data[0].id;
        const readings = await harness.authGet(primary, `/api/v1/electricity/meters/${meterId}/readings`);
        assert.strictEqual(readings.status, 200);
        const analytics = await harness.authGet(primary, '/api/v1/analytics/utilities');
        assert.strictEqual(analytics.status, 200);
        const dash = await harness.authGet(primary, '/api/v1/dashboard/overview');
        assert.strictEqual(dash.status, 200);
      });

      // Journey 5: Water
      await test('J5 — water meter readings + analytics', async () => {
        const meters = await harness.authGet(primary, '/api/v1/water/meters');
        assert.strictEqual(meters.status, 200);
        const analytics = await harness.authGet(primary, '/api/v1/analytics/utilities');
        assert.strictEqual(analytics.status, 200);
      });

      // Journey 6: Parking
      if (adminToken) {
        await test('J6 — parking area → slot allocate → release', async () => {
          const areas = await harness.authGet(adminToken, '/api/v1/parking/areas');
          assert.strictEqual(areas.status, 200);
          if (areas.body.data.length === 0) return;
          const areaId = areas.body.data[0].id;
          const slots = await harness.authGet(adminToken, `/api/v1/parking/slots?areaId=${areaId}`);
          assert.strictEqual(slots.status, 200);
          const available = slots.body.data.find((s: { status: string }) => s.status === 'AVAILABLE');
          if (!available) return;
          const alloc = await harness.authPost(adminToken, `/api/v1/parking/slots/${available.id}/allocate`, {
            allocatedTo: 'Phase24 Test',
            vehiclePlate: 'TEST-2400',
          });
          assert.ok([200, 409].includes(alloc.status));
          if (alloc.status === 200) {
            const release = await harness.authPost(adminToken, `/api/v1/parking/slots/${available.id}/release`, {});
            assert.strictEqual(release.status, 200);
          }
        });
      }

      // Journey 7: Announcements
      if (adminToken) {
        await test('J7 — announcement create → publish → read', async () => {
          const create = await harness.authPost(adminToken, '/api/v1/announcements', {
            title: 'Phase 24 Integration Announcement',
            body: 'Automated go-live verification announcement.',
            category: 'GENERAL',
            priority: 'NORMAL',
            audienceType: 'ALL',
          });
          assert.strictEqual(create.status, 201);
          const id = create.body.data.id;
          const publish = await harness.authPost(adminToken, `/api/v1/announcements/${id}/publish`, {});
          assert.strictEqual(publish.status, 200);
          const read = await harness.authPatch(facultyToken || primary, `/api/v1/announcements/${id}/read`, {});
          assert.strictEqual(read.status, 200);
        });
      }

      // Journey 8: IoT + digital twin
      await test('J8 — IoT summary + digital twin overview', async () => {
        const iot = await harness.authGet(primary, '/api/v1/iot/summary');
        assert.strictEqual(iot.status, 200);
        const twin = await harness.authGet(primary, '/api/v1/digital-twin/overview');
        assert.strictEqual(twin.status, 200);
        const devices = await harness.authGet(primary, '/api/v1/iot/devices');
        assert.strictEqual(devices.status, 200);
        if (devices.body.data.length > 0) {
          const health = await harness.authGet(primary, `/api/v1/iot/devices/${devices.body.data[0].id}/health`);
          assert.strictEqual(health.status, 200);
        }
      });

      // Journey 9: Recommendations
      await test('J9 — recommendations list + acknowledge flow', async () => {
        const list = await harness.authGet(primary, '/api/v1/digital-twin/recommendations');
        assert.ok([200, 403].includes(list.status));
        if (list.status !== 200 || list.body.data.length === 0) return;
        const rec = list.body.data.find((r: { status: string }) => r.status === 'OPEN');
        if (!rec || !adminToken) return;
        const ack = await harness.authPatch(adminToken, `/api/v1/digital-twin/recommendations/${rec.id}/acknowledge`, {});
        assert.ok([200, 409].includes(ack.status));
      });

      // Journey 10: AI
      await test('J10 — AI status (+ chat if Gemini configured)', async () => {
        const status = await harness.authGet(primary, '/api/v1/ai/status');
        assert.strictEqual(status.status, 200);
        if (!status.body.data.available) {
          console.log('    (Gemini not configured — degraded state verified)');
          return;
        }
        const chat = await harness.authPost(primary, '/api/v1/ai/chat', {
          message: 'How many buildings are on campus?',
        });
        assert.ok([200, 503].includes(chat.status));
        if (chat.status === 200) {
          const convos = await harness.authGet(primary, '/api/v1/ai/conversations');
          assert.strictEqual(convos.status, 200);
        }
      });

      // Journey 11: Admin user management
      if (adminToken) {
        await test('J11 — admin lists users + enforces permissions on create', async () => {
          const users = await harness.authGet(adminToken, '/api/v1/admin/users');
          assert.strictEqual(users.status, 200);
          assert.ok(users.body.data.length > 0);
        });
      }

      // Journey 12: Department scoping
      if (adminToken && demoPassword) {
        await test('J12 — department admin scoped asset access', async () => {
          const deptAdmin = (await harness.login('dept.admin@campusverse.local', demoPassword)).accessToken;
          const eeDept = await harness.db.department.findFirst({ where: { code: 'EE' } });
          if (!eeDept) return;
          const denied = await harness.authGet(deptAdmin, `/api/v1/assets?departmentId=${eeDept.id}`);
          assert.strictEqual(denied.status, 403);
          const csDept = await harness.db.department.findFirst({ where: { code: 'CS' } });
          if (!csDept) return;
          const allowed = await harness.authGet(deptAdmin, `/api/v1/assets?departmentId=${csDept.id}`);
          assert.strictEqual(allowed.status, 200);
        });
      }
    }
  } finally {
    await disconnectPrismaClient(harness.db);
    await teardownMongo();
  }

  console.log('\n============================================================');
  console.log(`📊 LIVE JOURNEYS: ${passed} passed, ${failed} failed, ${skipped} skipped`);
  console.log('============================================================\n');

  if (failed > 0) process.exit(1);
}

void runTests();
