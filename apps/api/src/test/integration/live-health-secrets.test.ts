// @ts-nocheck
/**
 * Verifies health/config endpoints never leak secrets (no live DB required).
 */
import assert from 'node:assert';
import 'dotenv/config';
import { createApp } from '../../app';

const FORBIDDEN_PATTERNS = [
  /postgresql:\/\/[^"'\s]+:[^"'\s]+@/i,
  /mongodb(\+srv)?:\/\/[^"'\s]+:[^"'\s]+@/i,
  /redis:\/\/[^"'\s]*:[^"'\s]+@/i,
  /change_me/i,
  /dev_access_secret/i,
  /dev_refresh_secret/i,
  /eyJ[a-zA-Z0-9_-]{20,}/,
  /\bsk-[a-zA-Z0-9]{10,}\b/,
  /\bAIza[a-zA-Z0-9_-]{10,}\b/,
];

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

function assertNoSecrets(body: unknown, label: string): void {
  const serialized = JSON.stringify(body);
  for (const pattern of FORBIDDEN_PATTERNS) {
    assert.ok(!pattern.test(serialized), `${label} must not match secret pattern ${pattern}`);
  }
}

async function runTests() {
  console.log('\n============================================================');
  console.log('LIVE HEALTH / SECRET LEAK TESTS');
  console.log('============================================================\n');

  const mockDb: any = {
    $queryRaw: async () => [{ ok: 1 }],
    user: {
      findUnique: async () => ({ isActive: true }),
    },
  };

  const app = createApp(mockDb);
  const request = (await import('supertest')).default;

  await test('GET /health — no secrets in response', async () => {
    const res = await request(app).get('/api/v1/health');
    assert.strictEqual(res.status, 200);
    assertNoSecrets(res.body, 'health');
  });

  await test('GET /health/config — no secrets in response', async () => {
    const res = await request(app).get('/api/v1/health/config');
    assert.strictEqual(res.status, 200);
    assertNoSecrets(res.body, 'health/config');
    assert.ok(res.body.data.integrations);
  });

  await test('GET /health/ready — no connection strings in response', async () => {
    const res = await request(app).get('/api/v1/health/ready');
    assert.ok([200, 503].includes(res.status));
    assertNoSecrets(res.body, 'health/ready');
  });

  console.log('\n============================================================');
  console.log(`📊 HEALTH/SECRETS: ${passed} / ${passed + failed} PASSED`);
  console.log('============================================================\n');

  if (failed > 0) process.exit(1);
}

void runTests();
