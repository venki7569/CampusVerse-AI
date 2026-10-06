// @ts-nocheck
/**
 * Phase 24 — Redis cache + graceful degradation verification.
 */
import assert from 'node:assert';
import 'dotenv/config';
import Redis from 'ioredis';
import { config } from '../../config/env';
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
  console.log('PHASE 24 — LIVE REDIS TESTS');
  console.log('============================================================\n');

  const infra = await probeInfrastructure();
  console.log('Redis status:', infra.redis, infra.redisError ?? '');

  if (!integrationReady(infra)) {
    console.log('PostgreSQL/MongoDB unavailable — skipping Redis API suite.\n');
    await teardownMongo();
    process.exit(0);
  }

  const adminPassword = process.env['SEED_ADMIN_PASSWORD'];
  const adminEmail = (process.env['SEED_ADMIN_EMAIL'] ?? 'admin@campusverse.local').toLowerCase();
  if (!adminPassword) {
    console.log('SEED_ADMIN_PASSWORD required.\n');
    await teardownMongo();
    process.exit(0);
  }

  const harness = await IntegrationHarness.create();

  try {
    const login = await harness.login(adminEmail, adminPassword);
    const token = login.accessToken;

    await test('API — login works regardless of Redis state', async () => {
      assert.ok(token);
    });

    await test('API — dashboard responds with or without Redis', async () => {
      const res = await harness.authGet(token, '/api/v1/dashboard/overview');
      assert.strictEqual(res.status, 200);
    });

    await test('API — analytics overview responds', async () => {
      const res = await harness.authGet(token, '/api/v1/analytics/overview');
      assert.strictEqual(res.status, 200);
    });

    await test('API — notification unread count responds', async () => {
      const res = await harness.authGet(token, '/api/v1/notifications/unread-count');
      assert.strictEqual(res.status, 200);
    });

    if (infra.redis === 'ok') {
      await test('Redis — direct PING', async () => {
        const redis = new Redis(config.db.redisUri, { lazyConnect: true });
        await redis.connect();
        assert.strictEqual(await redis.ping(), 'PONG');
        await redis.quit();
      });

      await test('Redis — cache keys can be written and read', async () => {
        const redis = new Redis(config.db.redisUri, { lazyConnect: true });
        await redis.connect();
        const key = 'campusverse:phase24:probe';
        await redis.set(key, '1', 'EX', 30);
        assert.strictEqual(await redis.get(key), '1');
        await redis.del(key);
        await redis.quit();
      });
    } else {
      skip('Redis direct tests', `Redis ${infra.redis}: ${infra.redisError ?? 'unavailable'}`);
      await test('Graceful degradation — API remains functional without Redis', async () => {
        const res = await harness.authGet(token, '/api/v1/buildings');
        assert.strictEqual(res.status, 200);
      });
    }
  } finally {
    await disconnectPrismaClient(harness.db);
    await teardownMongo();
  }

  console.log('\n============================================================');
  console.log(`📊 LIVE REDIS: ${passed} passed, ${failed} failed, ${skipped} skipped`);
  console.log('============================================================\n');

  if (failed > 0) process.exit(1);
}

void runTests();
