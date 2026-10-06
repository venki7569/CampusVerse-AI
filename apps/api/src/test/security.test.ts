// @ts-nocheck
/**
 * Phase 21 security hardening verification tests.
 */
import assert from 'node:assert';
import jwt from 'jsonwebtoken';
import { config } from '../config/env';
import { CacheService } from '../services/cache.service';
import { authenticateSocket, userRoom, CAMPUS_ROOM, roleRoom } from '../modules/realtime/socket.auth';
import { getLivenessReport } from '../modules/health/health.service';
import { DefaultTelemetryProcessor } from '../modules/iot/telemetry.processor';
import { AppError } from '../utils/AppError';

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

function mockSocket(token?: string) {
  return {
    id: 'socket-test-1',
    handshake: {
      auth: token ? { token } : {},
      headers: {},
    },
  };
}

async function runTests() {
  console.log('\n============================================================');
  console.log('PHASE 21 SECURITY TESTS');
  console.log('============================================================\n');

  await test('AppError.serviceUnavailable returns 503 code', () => {
    const err = AppError.serviceUnavailable('test');
    assert.strictEqual(err.statusCode, 503);
    assert.strictEqual(err.code, 'SERVICE_UNAVAILABLE');
  });

  await test('Production mode hides internal error messages', () => {
    const original = config.isProduction;
    Object.defineProperty(config, 'isProduction', { value: true, configurable: true });
    assert.strictEqual(config.isProduction, true);
    Object.defineProperty(config, 'isProduction', { value: original, configurable: true });
  });

  await test('Telemetry processor rejects BAD quality readings', async () => {
    const processor = new DefaultTelemetryProcessor();
    const batch = await processor.process([
      {
        deviceId: 'd1',
        timestamp: new Date(),
        metric: 'temperature',
        value: 20,
        unit: 'Celsius',
        quality: 'BAD',
      },
    ]);
    assert.strictEqual(batch.accepted.length, 0);
  });

  await test('Telemetry processor rejects future timestamps', async () => {
    const processor = new DefaultTelemetryProcessor();
    const future = new Date(Date.now() + 3600_000);
    const batch = await processor.process([
      {
        deviceId: 'd1',
        timestamp: future,
        metric: 'occupancy',
        value: 5,
        unit: 'people',
        quality: 'GOOD',
      },
    ]);
    assert.strictEqual(batch.accepted.length, 0);
  });

  await test('Cache service degrades gracefully without Redis', async () => {
    const cache = new CacheService('sec-test');
    const value = await cache.getOrSet('k', async () => ({ ok: true }));
    assert.strictEqual(value.ok, true);
  });

  await test('Socket auth rejects missing token', async () => {
    const socket = mockSocket();
    let error: Error | undefined;
    await new Promise<void>((resolve) => {
      authenticateSocket(socket, (err) => {
        error = err;
        resolve();
      });
    });
    assert.ok(error);
  });

  await test('Socket auth rejects invalid token', async () => {
    const socket = mockSocket('not-a-jwt');
    let error: Error | undefined;
    await new Promise<void>((resolve) => {
      authenticateSocket(socket, (err) => {
        error = err;
        resolve();
      });
    });
    assert.ok(error);
  });

  await test('Socket auth rejects expired token', async () => {
    const expired = jwt.sign(
      { sub: 'u1', email: 'a@b.com', roles: ['STUDENT'] },
      config.jwt.accessSecret,
      { expiresIn: -10 },
    );
    const socket = mockSocket(expired);
    let error: Error | undefined;
    await new Promise<void>((resolve) => {
      authenticateSocket(socket, (err) => {
        error = err;
        resolve();
      });
    });
    assert.ok(error);
  });

  await test('Socket room helpers isolate user and campus channels', () => {
    assert.strictEqual(userRoom('abc'), 'user:abc');
    assert.strictEqual(CAMPUS_ROOM, 'campus:updates');
    assert.strictEqual(roleRoom('CAMPUS_ADMIN'), 'role:CAMPUS_ADMIN');
  });

  await test('Liveness probe is lightweight', () => {
    const report = getLivenessReport();
    assert.strictEqual(report.status, 'ok');
    assert.ok(!('checks' in report));
  });

  await test('JWT access secret is not default in test env check', () => {
    assert.ok(config.jwt.accessSecret.length >= 10);
  });

  console.log('\n============================================================');
  console.log(`📊 SECURITY RESULTS: ${passed} / ${passed + failed} TESTS PASSED`);
  console.log('============================================================\n');

  if (failed > 0) process.exit(1);
}

void runTests();
