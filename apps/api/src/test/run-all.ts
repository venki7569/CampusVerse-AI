import { spawnSync } from 'node:child_process';
import path from 'node:path';

const apiRoot = path.resolve(__dirname, '..', '..');
const testFiles = [
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

let passedSuites = 0;
let failedSuites = 0;

console.log('CampusVerse API — unified test runner\n');

for (const file of testFiles) {
  const fullPath = path.join(apiRoot, file);
  process.stdout.write(`Running ${file} ... `);

  const result = spawnSync(
    'npx',
    ['ts-node', '--transpile-only', fullPath],
    {
      cwd: apiRoot,
      stdio: 'pipe',
      shell: true,
      env: { ...process.env, NODE_ENV: 'test' },
    },
  );

  if (result.status === 0) {
    passedSuites += 1;
    console.log('PASS');
  } else {
    failedSuites += 1;
    console.log('FAIL');
    if (result.stdout?.length) process.stdout.write(result.stdout.toString());
    if (result.stderr?.length) process.stderr.write(result.stderr.toString());
  }
}

console.log(`\nSuites passed: ${passedSuites}/${testFiles.length}`);

if (failedSuites > 0) {
  process.exit(1);
}
