// @ts-nocheck
/**
 * Environment and configuration validation tests.
 */
import assert from 'node:assert';
import { getConfigDiagnostics } from '../config/config-diagnostics';

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

async function runTests() {
  console.log('\n============================================================');
  console.log('CONFIG VALIDATION TESTS');
  console.log('============================================================\n');

  await test('getConfigDiagnostics returns safe report without secrets', () => {
    const report = getConfigDiagnostics();
    const serialized = JSON.stringify(report);
    assert.ok(!serialized.includes('password'));
    assert.ok(!serialized.includes('secret'));
    assert.ok(report.timestamp);
    assert.ok(report.integrations.postgres);
    assert.ok(report.integrations.gemini);
    assert.ok(report.rateLimits.globalMax > 0);
  });

  await test('Google auth disabled note present in production mode check', () => {
    const report = getConfigDiagnostics();
    if (report.isProduction) {
      assert.strictEqual(report.integrations.googleAuth.enabled, false);
    } else {
      assert.ok(report.integrations.googleAuth.note);
    }
  });

  await test('Cloudinary marked as not wired', () => {
    const report = getConfigDiagnostics();
    assert.strictEqual(report.integrations.cloudinary.enabled, false);
    assert.ok(report.integrations.cloudinary.note?.includes('not wired'));
  });

  console.log('\n============================================================');
  console.log(`📊 CONFIG RESULTS: ${passed} / ${passed + failed} TESTS PASSED`);
  console.log('============================================================\n');

  if (failed > 0) process.exit(1);
}

void runTests();
