// @ts-nocheck
/**
 * HTTP-level integration tests using supertest.
 * Validates auth boundaries, health endpoints, and critical route protection.
 */
import assert from 'node:assert';
import jwt from 'jsonwebtoken';
import request from 'supertest';
import { createApp } from '../app';
import { config } from '../config/env';

let passed = 0;
let failed = 0;

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

/** Minimal Prisma mock for HTTP boundary tests — avoids live DB requirement. */
const mockDb: any = {
  $queryRaw: async () => [{ ok: 1 }],
  user: {
    findUnique: async ({ where, select }: { where: { id: string }; select?: { isActive?: boolean } }) => {
      if (select?.isActive) {
        return { isActive: where.id !== '00000000-0000-0000-0000-000000000099' };
      }
      return null;
    },
  },
};

const app = createApp(mockDb);

function signToken(payload: { sub: string; email: string; roles: string[] }) {
  return jwt.sign(payload, config.jwt.accessSecret, { expiresIn: '15m' });
}

async function runTests() {
  console.log('\n============================================================');
  console.log('HTTP E2E / INTEGRATION TESTS');
  console.log('============================================================\n');

  await test('GET /health returns 200 liveness', async () => {
    const res = await request(app).get('/api/v1/health');
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.success, true);
    assert.strictEqual(res.body.data.status, 'ok');
    assert.ok(res.headers['x-request-id']);
  });

  await test('GET /health/ready returns structured readiness', async () => {
    const res = await request(app).get('/api/v1/health/ready');
    assert.ok([200, 503].includes(res.status));
    assert.strictEqual(res.body.success, true);
    assert.ok(res.body.data.dependencies);
    assert.ok(res.body.data.status);
  });

  await test('Protected dashboard route rejects missing token', async () => {
    const res = await request(app).get('/api/v1/dashboard/overview');
    assert.strictEqual(res.status, 401);
    assert.strictEqual(res.body.success, false);
    assert.strictEqual(res.body.error.code, 'UNAUTHORIZED');
  });

  await test('Protected buildings list rejects missing token', async () => {
    const res = await request(app).get('/api/v1/buildings');
    assert.strictEqual(res.status, 401);
  });

  await test('Protected rooms list rejects missing token', async () => {
    const res = await request(app).get('/api/v1/rooms');
    assert.strictEqual(res.status, 401);
  });

  await test('Protected admin route rejects missing token', async () => {
    const res = await request(app).get('/api/v1/admin/users');
    assert.strictEqual(res.status, 401);
  });

  await test('Protected IoT route rejects missing token', async () => {
    const res = await request(app).get('/api/v1/iot/summary');
    assert.strictEqual(res.status, 401);
  });

  await test('Protected digital-twin route rejects missing token', async () => {
    const res = await request(app).get('/api/v1/digital-twin/overview');
    assert.strictEqual(res.status, 401);
  });

  await test('Protected AI route rejects missing token', async () => {
    const res = await request(app).get('/api/v1/ai/status');
    assert.strictEqual(res.status, 401);
  });

  await test('Invalid login payload returns validation error', async () => {
    const res = await request(app).post('/api/v1/auth/login').send({ email: 'not-an-email' });
    assert.strictEqual(res.status, 422);
    assert.strictEqual(res.body.error.code, 'VALIDATION_ERROR');
  });

  await test('Invalid token returns 401 on protected route', async () => {
    const res = await request(app)
      .get('/api/v1/dashboard/overview')
      .set('Authorization', 'Bearer invalid-token');
    assert.strictEqual(res.status, 401);
  });

  await test('Malformed telemetry rejected without auth', async () => {
    const res = await request(app)
      .post('/api/v1/iot/telemetry')
      .send({ deviceId: 'x', metric: 'invalid', value: 1, unit: 'x' });
    assert.strictEqual(res.status, 401);
  });

  await test('Error responses include X-Request-Id header', async () => {
    const res = await request(app).get('/api/v1/notifications');
    assert.ok(res.headers['x-request-id']);
  });

  await test('Unknown route returns 404', async () => {
    const res = await request(app).get('/api/v1/does-not-exist-route');
    assert.strictEqual(res.status, 404);
  });

  // Token with valid signature but inactive/missing user
  await test('Signed token for inactive user is rejected', async () => {
    const token = signToken({
      sub: '00000000-0000-0000-0000-000000000099',
      email: 'ghost@test.local',
      roles: ['STUDENT'],
    });
    const res = await request(app)
      .get('/api/v1/dashboard/overview')
      .set('Authorization', `Bearer ${token}`);
    assert.strictEqual(res.status, 403);
    assert.strictEqual(res.body.error.code, 'FORBIDDEN');
  });

  await test('GET /auth/me rejects missing token', async () => {
    const res = await request(app).get('/api/v1/auth/me');
    assert.strictEqual(res.status, 401);
  });

  await test('PATCH /auth/me rejects missing token', async () => {
    const res = await request(app).patch('/api/v1/auth/me').send({ firstName: 'X' });
    assert.strictEqual(res.status, 401);
  });

  await test('GET /analytics/export rejects missing token', async () => {
    const res = await request(app).get('/api/v1/analytics/export').query({
      category: 'campus_overview',
      format: 'json',
    });
    assert.strictEqual(res.status, 401);
  });

  await test('GET /admin/system-health rejects missing token', async () => {
    const res = await request(app).get('/api/v1/admin/system-health');
    assert.strictEqual(res.status, 401);
  });

  // Journey boundary tests — additional protected modules
  await test('Journey: protected water route rejects missing token', async () => {
    const res = await request(app).get('/api/v1/water/meters');
    assert.strictEqual(res.status, 401);
  });

  await test('Journey: protected parking route rejects missing token', async () => {
    const res = await request(app).get('/api/v1/parking/areas');
    assert.strictEqual(res.status, 401);
  });

  await test('Journey: protected maintenance route rejects missing token', async () => {
    const res = await request(app).get('/api/v1/maintenance');
    assert.strictEqual(res.status, 401);
  });

  await test('Journey: protected announcements route rejects missing token', async () => {
    const res = await request(app).get('/api/v1/announcements');
    assert.strictEqual(res.status, 401);
  });

  await test('Journey: protected assets route rejects missing token', async () => {
    const res = await request(app).get('/api/v1/assets');
    assert.strictEqual(res.status, 401);
  });

  await test('Journey: protected analytics overview rejects missing token', async () => {
    const res = await request(app).get('/api/v1/analytics/overview');
    assert.strictEqual(res.status, 401);
  });

  await test('GET /health/config returns safe diagnostics without secrets', async () => {
    const res = await request(app).get('/api/v1/health/config');
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.success, true);
    assert.ok(res.body.data.integrations);
    assert.ok(!JSON.stringify(res.body).toLowerCase().includes('change_me'));
  });

  await test('POST /auth/google rejects empty body with validation or bad request', async () => {
    const res = await request(app).post('/api/v1/auth/google').send({});
    assert.ok([400, 422].includes(res.status));
  });

  console.log('\n============================================================');
  console.log(`📊 E2E RESULTS: ${passed} / ${passed + failed} TESTS PASSED`);
  console.log('============================================================\n');

  if (failed > 0) process.exit(1);
}

void runTests();
