// @ts-nocheck
import { spawnSync } from 'node:child_process';
import path from 'node:path';

const apiRoot = path.resolve(__dirname, '..', '..', '..');

/** UNIT tests — mock DB, always run via `npm test` */
export const UNIT_TEST_FILES = [
  'src/modules/admin/admin.test.ts',
  'src/modules/dashboard/dashboard.test.ts',
  'src/modules/notifications/notification.test.ts',
  'src/modules/maintenance/maintenance.test.ts',
  'src/modules/electricity/electricity.test.ts',
  'src/modules/water/water.test.ts',
  'src/modules/parking/parking.test.ts',
  'src/modules/analytics/analytics.test.ts',
  'src/modules/ai/ai.test.ts',
  'src/modules/announcements/announcement.test.ts',
  'src/modules/production/production.test.ts',
  'src/modules/digital-twin/digital-twin.test.ts',
  'src/modules/iot/iot.test.ts',
  'src/test/security.test.ts',
  'src/test/e2e.test.ts',
  'src/test/department-scope.test.ts',
  'src/test/auth-profile.test.ts',
  'src/test/config-validation.test.ts',
];

/** INTEGRATION tests — require live MongoDB and/or PostgreSQL */
export const INTEGRATION_TEST_FILES = [
  'src/test/integration/live-health-secrets.test.ts',
  'src/test/integration/live-mongo.test.ts',
  'src/test/integration/live-api.test.ts',
  'src/test/integration/live-journeys.test.ts',
  'src/test/integration/live-rbac.test.ts',
  'src/test/integration/live-redis.test.ts',
  'src/test/integration/live-socket.test.ts',
];

const files = INTEGRATION_TEST_FILES;

let passed = 0;
let failed = 0;

console.log('CampusVerse API — live integration runner (Phase 24)\n');
console.log('Categories: INTEGRATION (live infra) — UNIT suites run via npm test\n');

for (const file of files) {
  const fullPath = path.join(apiRoot, file);
  process.stdout.write(`Running ${file} ... `);

  const result = spawnSync('npx', ['ts-node', '--transpile-only', fullPath], {
    cwd: apiRoot,
    stdio: 'pipe',
    shell: true,
    env: { ...process.env, NODE_ENV: 'test' },
  });

  if (result.status === 0) {
    passed += 1;
    console.log('PASS');
    if (result.stdout?.length) process.stdout.write(result.stdout.toString());
  } else {
    failed += 1;
    console.log('FAIL');
    if (result.stdout?.length) process.stdout.write(result.stdout.toString());
    if (result.stderr?.length) process.stderr.write(result.stderr.toString());
  }
}

console.log(`\nLive integration suites passed: ${passed}/${files.length}`);
if (failed > 0) process.exit(1);
