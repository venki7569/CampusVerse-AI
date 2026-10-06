// @ts-nocheck
/**
 * Live HTTP integration tests — requires PostgreSQL + MongoDB.
 * Run: npm run test:integration
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
  console.log('LIVE HTTP INTEGRATION TESTS');
  console.log('============================================================\n');

  const infra = await probeInfrastructure();
  console.log('Infrastructure:', JSON.stringify(infra, null, 2));

  if (!integrationReady(infra)) {
    console.log('\nPostgreSQL and/or MongoDB unavailable — skipping live integration suite.');
    console.log('Start services: npm run docker:up (or align POSTGRES_URI / MONGODB_URI)\n');
    await teardownMongo();
    process.exit(0);
  }

  const demoPassword = process.env['SEED_DEMO_PASSWORD'];
  const adminPassword = process.env['SEED_ADMIN_PASSWORD'];
  const adminEmail = (process.env['SEED_ADMIN_EMAIL'] ?? 'admin@campusverse.local').toLowerCase();

  if (!demoPassword && !adminPassword) {
    console.log('\nSet SEED_DEMO_PASSWORD or SEED_ADMIN_PASSWORD to run authenticated flows.\n');
    await teardownMongo();
    process.exit(0);
  }

  const harness = await IntegrationHarness.create();
  let superToken = '';
  let facultyToken = '';
  let deptAdminToken = '';

  try {
    await test('Health liveness', async () => {
      const res = await harness.agent().get('/api/v1/health');
      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.body.data.status, 'ok');
    });

    await test('Health readiness against live dependencies', async () => {
      const res = await harness.agent().get('/api/v1/health/ready');
      assert.ok([200, 503].includes(res.status));
      assert.ok(res.body.data.dependencies);
      assert.strictEqual(res.body.data.dependencies.postgres.status, 'ok');
    });

    if (adminPassword) {
      await test('AUTH — admin login', async () => {
        const login = await harness.login(adminEmail, adminPassword);
        superToken = login.accessToken;
        assert.ok(superToken);
        assert.ok(login.user.roles.includes('SUPER_ADMIN'));
      });
    } else {
      skip('AUTH — admin login', 'SEED_ADMIN_PASSWORD not set');
    }

    if (demoPassword) {
      await test('AUTH — faculty login', async () => {
        const login = await harness.login('faculty@campusverse.local', demoPassword);
        facultyToken = login.accessToken;
        assert.ok(facultyToken);
      });

      await test('AUTH — department admin login', async () => {
        const login = await harness.login('dept.admin@campusverse.local', demoPassword);
        deptAdminToken = login.accessToken;
        assert.ok(deptAdminToken);
      });
    }

    const token = superToken || facultyToken;
    if (!token) {
      skip('Remaining authenticated tests', 'no login token available');
    } else {
      await test('AUTH — GET /auth/me', async () => {
        const res = await harness.authGet(token, '/api/v1/auth/me');
        assert.strictEqual(res.status, 200);
        assert.ok(res.body.data.email);
        assert.ok(!('passwordHash' in res.body.data));
      });

      await test('CAMPUS — list buildings', async () => {
        const res = await harness.authGet(token, '/api/v1/buildings');
        assert.strictEqual(res.status, 200);
        assert.ok(Array.isArray(res.body.data));
      });

      await test('CAMPUS — list departments', async () => {
        const res = await harness.authGet(token, '/api/v1/departments');
        assert.strictEqual(res.status, 200);
      });

      await test('CAMPUS — list rooms', async () => {
        const res = await harness.authGet(token, '/api/v1/rooms');
        assert.strictEqual(res.status, 200);
      });

      await test('ASSETS — list assets', async () => {
        const res = await harness.authGet(token, '/api/v1/assets');
        assert.strictEqual(res.status, 200);
      });

      await test('MAINTENANCE — list requests', async () => {
        const res = await harness.authGet(token, '/api/v1/maintenance');
        assert.strictEqual(res.status, 200);
      });

      await test('UTILITIES — list electricity meters', async () => {
        const res = await harness.authGet(token, '/api/v1/electricity/meters');
        assert.strictEqual(res.status, 200);
      });

      await test('NOTIFICATIONS — list', async () => {
        const res = await harness.authGet(token, '/api/v1/notifications');
        assert.strictEqual(res.status, 200);
      });

      await test('NOTIFICATIONS — unread count', async () => {
        const res = await harness.authGet(token, '/api/v1/notifications/unread-count');
        assert.strictEqual(res.status, 200);
        assert.ok(typeof res.body.data.unreadCount === 'number');
      });

      await test('PARKING — list areas', async () => {
        const res = await harness.authGet(token, '/api/v1/parking/areas');
        assert.strictEqual(res.status, 200);
      });

      await test('ANNOUNCEMENTS — feed', async () => {
        const res = await harness.authGet(token, '/api/v1/announcements');
        assert.strictEqual(res.status, 200);
      });

      await test('ANALYTICS — overview', async () => {
        const res = await harness.authGet(token, '/api/v1/analytics/overview');
        assert.strictEqual(res.status, 200);
        assert.ok(res.body.data.kpis);
      });

      await test('AI — status', async () => {
        const res = await harness.authGet(token, '/api/v1/ai/status');
        assert.strictEqual(res.status, 200);
      });

      await test('IOT — summary', async () => {
        const res = await harness.authGet(token, '/api/v1/iot/summary');
        assert.strictEqual(res.status, 200);
      });

      await test('DIGITAL TWIN — overview', async () => {
        const res = await harness.authGet(token, '/api/v1/digital-twin/overview');
        assert.strictEqual(res.status, 200);
      });

      await test('RECOMMENDATIONS — list', async () => {
        const res = await harness.authGet(token, '/api/v1/digital-twin/recommendations');
        assert.ok([200, 403].includes(res.status));
      });

      if (superToken) {
        await test('ADMIN — system health', async () => {
          const res = await harness.authGet(superToken, '/api/v1/admin/system-health');
          assert.strictEqual(res.status, 200);
          assert.ok(res.body.data.dependencies);
        });

        await test('ADMIN — list users', async () => {
          const res = await harness.authGet(superToken, '/api/v1/admin/users');
          assert.strictEqual(res.status, 200);
        });
      }
    }

    if (deptAdminToken && superToken) {
      await test('RBAC — dept admin cannot access other dept asset by forced filter', async () => {
        const eeDept = await harness.db.department.findFirst({ where: { code: 'EE' } });
        if (!eeDept) return;
        const res = await harness.authGet(deptAdminToken, `/api/v1/assets?departmentId=${eeDept.id}`);
        assert.strictEqual(res.status, 403);
      });
    }

    if (facultyToken) {
      await test('RBAC — faculty cannot access admin users', async () => {
        const res = await harness.authGet(facultyToken, '/api/v1/admin/users');
        assert.strictEqual(res.status, 403);
      });
    }
  } finally {
    await disconnectPrismaClient(harness.db);
    await teardownMongo();
  }

  console.log('\n============================================================');
  console.log(`📊 LIVE INTEGRATION: ${passed} passed, ${failed} failed, ${skipped} skipped`);
  console.log('============================================================\n');

  if (failed > 0) process.exit(1);
}

void runTests();
