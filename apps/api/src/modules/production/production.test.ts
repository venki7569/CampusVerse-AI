// @ts-nocheck
import assert from 'node:assert';
import jwt from 'jsonwebtoken';
import { config } from '../../config/env';
import { validateEnvironment } from '../../config/env.validation';
import { CacheService } from '../../services/cache.service';
import { authenticateSocket, userRoom, CAMPUS_ROOM, roleRoom } from '../realtime/socket.auth';
import { getLivenessReport } from '../health/health.service';
import { initUserStatusService } from '../../services/user-status.service';

let passed = 0;
let failed = 0;

async function test(name: string, fn: () => void | Promise<void>): Promise<void> {
  try {
    await fn();
    passed += 1;
    console.log(`  ✓ ${name}`);
  } catch (err) {
    failed += 1;
    console.error(`  ✗ ${name}`);
    console.error(err);
  }
}

function mockSocket(token?: string) {
  const events: Record<string, Array<(err?: Error) => void>> = {};
  return {
    id: 'socket-test-1',
    handshake: {
      auth: token ? { token } : {},
      headers: {},
    },
    disconnectCalled: false,
    disconnect(force?: boolean) {
      this.disconnectCalled = true;
      this.force = force;
    },
    on(event: string, handler: (err?: Error) => void) {
      events[event] = events[event] ?? [];
      events[event].push(handler);
    },
  };
}

async function runTests(): Promise<void> {
  console.log('Production readiness tests\n');

  initUserStatusService({
    user: {
      findUnique: async () => ({ isActive: true }),
    },
  } as any);

  await test('liveness report returns ok status', () => {
    const report = getLivenessReport();
    assert.strictEqual(report.status, 'ok');
    assert.ok(report.timestamp);
  });

  await test('environment validation passes in test mode', () => {
    validateEnvironment();
  });

  await test('cache service falls back when Redis unavailable', async () => {
    const cache = new CacheService('test');
    let calls = 0;
    const value = await cache.getOrSet('key', async () => {
      calls += 1;
      return { count: 1 };
    });
    assert.strictEqual(value.count, 1);
    assert.strictEqual(calls, 1);
  });

  await test('socket auth rejects missing token', async () => {
    const socket = mockSocket();
    let error: Error | undefined;
    await new Promise<void>((resolve) => {
      authenticateSocket(socket, (err) => {
        error = err;
        resolve();
      });
    });
    assert.ok(error);
    assert.match(error!.message, /Authentication required/);
  });

  await test('socket auth accepts valid JWT', async () => {
    const token = jwt.sign(
      { sub: 'user-1', email: 'test@campus.edu', roles: ['FACULTY'] },
      config.jwt.accessSecret,
      { expiresIn: '1h' },
    );
    const socket = mockSocket(token);
    let error: Error | undefined;
    await new Promise<void>((resolve) => {
      authenticateSocket(socket, (err) => {
        error = err;
        resolve();
      });
    });
    assert.strictEqual(error, undefined);
    assert.strictEqual(socket.user?.sub, 'user-1');
  });

  await test('room naming helpers are stable', () => {
    assert.strictEqual(userRoom('abc'), 'user:abc');
    assert.strictEqual(CAMPUS_ROOM, 'campus:updates');
    assert.strictEqual(roleRoom('FACULTY'), 'role:FACULTY');
  });

  await test('production config flags are readable', () => {
    assert.ok(typeof config.redis.enabled === 'boolean');
    assert.ok(typeof config.socket.enabled === 'boolean');
    assert.ok(config.socket.path.startsWith('/'));
  });

  console.log(`\n${passed} passed, ${failed} failed`);
  if (failed > 0) process.exit(1);
}

void runTests();
