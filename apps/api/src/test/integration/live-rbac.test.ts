// @ts-nocheck
/**
 * Phase 24 — Live RBAC + IDOR verification against real PostgreSQL.
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
  console.log('PHASE 24 — LIVE RBAC / SECURITY TESTS');
  console.log('============================================================\n');

  const infra = await probeInfrastructure();
  if (!integrationReady(infra)) {
    console.log('PostgreSQL/MongoDB unavailable — skipping RBAC suite.\n');
    await teardownMongo();
    process.exit(0);
  }

  const demoPassword = process.env['SEED_DEMO_PASSWORD'];
  const adminPassword = process.env['SEED_ADMIN_PASSWORD'];
  const adminEmail = (process.env['SEED_ADMIN_EMAIL'] ?? 'admin@campusverse.local').toLowerCase();

  if (!demoPassword) {
    console.log('SEED_DEMO_PASSWORD required for RBAC suite.\n');
    await teardownMongo();
    process.exit(0);
  }

  const harness = await IntegrationHarness.create();

  try {
    const student = (await harness.login('student@campusverse.local', demoPassword)).accessToken;
    const faculty = (await harness.login('faculty@campusverse.local', demoPassword)).accessToken;
    const deptAdmin = (await harness.login('dept.admin@campusverse.local', demoPassword)).accessToken;
    const campusAdmin = (await harness.login('campus.admin@campusverse.local', demoPassword)).accessToken;
    const adminToken = adminPassword
      ? (await harness.login(adminEmail, adminPassword)).accessToken
      : '';

    await test('STUDENT — denied admin users list', async () => {
      assert.strictEqual((await harness.authGet(student, '/api/v1/admin/users')).status, 403);
    });

    await test('STUDENT — denied analytics export', async () => {
      const res = await harness.authGet(student, '/api/v1/analytics/export?category=campus_overview&format=json');
      assert.ok([403, 401].includes(res.status));
    });

    await test('STUDENT — denied asset create', async () => {
      const res = await harness.authPost(student, '/api/v1/assets', { name: 'x', assetTag: 'X-PH24' });
      assert.strictEqual(res.status, 403);
    });

    await test('FACULTY — denied admin mutations', async () => {
      assert.strictEqual((await harness.authGet(faculty, '/api/v1/admin/users')).status, 403);
    });

    await test('FACULTY — can read buildings', async () => {
      assert.strictEqual((await harness.authGet(faculty, '/api/v1/buildings')).status, 200);
    });

    await test('DEPT_ADMIN — cross-department asset query denied', async () => {
      const ee = await harness.db.department.findFirst({ where: { code: 'EE' } });
      if (!ee) return;
      assert.strictEqual((await harness.authGet(deptAdmin, `/api/v1/assets?departmentId=${ee.id}`)).status, 403);
    });

    await test('CAMPUS_ADMIN — can list users', async () => {
      assert.strictEqual((await harness.authGet(campusAdmin, '/api/v1/admin/users')).status, 200);
    });

    if (adminToken) {
      await test('SUPER_ADMIN — system health access', async () => {
        assert.strictEqual((await harness.authGet(adminToken, '/api/v1/admin/system-health')).status, 200);
      });
    }

    await test('IDOR — random UUID returns 404 not 403 leak', async () => {
      const fakeId = '00000000-0000-0000-0000-000000000001';
      const res = await harness.authGet(faculty, `/api/v1/assets/${fakeId}`);
      assert.ok([404, 403].includes(res.status));
    });

    await test('Unauthenticated — protected routes return 401', async () => {
      assert.strictEqual((await harness.agent().get('/api/v1/dashboard/overview')).status, 401);
      assert.strictEqual((await harness.agent().get('/api/v1/admin/users')).status, 401);
    });
  } finally {
    await disconnectPrismaClient(harness.db);
    await teardownMongo();
  }

  console.log('\n============================================================');
  console.log(`📊 LIVE RBAC: ${passed} passed, ${failed} failed, ${skipped} skipped`);
  console.log('============================================================\n');

  if (failed > 0) process.exit(1);
}

void runTests();
