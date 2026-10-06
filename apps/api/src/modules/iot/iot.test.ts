// @ts-nocheck
import assert from 'node:assert';
import { DefaultTelemetryProcessor } from './telemetry.processor';
import { DeviceHealthService } from './device-health.service';
import { OperationalRuleEngine } from './rule-engine.service';
import { iotEvents } from './iot.events';
import { isUnitCompatible } from './iot.dto';

let passed = 0;
let failed = 0;
const emitted: Array<{ event: string; payload: unknown }> = [];

iotEvents.subscribe((event, payload) => {
  emitted.push({ event, payload });
});

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

const now = new Date();

async function runTests() {
  console.log('\n============================================================');
  console.log('IoT MODULE TESTS');
  console.log('============================================================\n');

  const processor = new DefaultTelemetryProcessor();
  const healthService = new DeviceHealthService();
  const ruleEngine = new OperationalRuleEngine();

  await test('Valid telemetry is accepted', async () => {
    const batch = await processor.process([
      {
        deviceId: 'dev-1',
        timestamp: now,
        metric: 'temperature',
        value: 22,
        unit: 'Celsius',
        quality: 'GOOD',
      },
    ]);
    assert.strictEqual(batch.accepted.length, 1);
    assert.strictEqual(batch.rejected.length, 0);
  });

  await test('Invalid unit rejected', async () => {
    assert.strictEqual(isUnitCompatible('temperature', 'liters'), false);
    const batch = await processor.process([
      {
        deviceId: 'dev-1',
        timestamp: now,
        metric: 'temperature',
        value: 22,
        unit: 'liters',
        quality: 'GOOD',
      },
    ]);
    assert.strictEqual(batch.accepted.length, 0);
    assert.ok(batch.rejected.length >= 1);
  });

  await test('Invalid value range rejected', async () => {
    const batch = await processor.process([
      {
        deviceId: 'dev-1',
        timestamp: now,
        metric: 'humidity',
        value: 150,
        unit: 'percent',
        quality: 'GOOD',
      },
    ]);
    assert.strictEqual(batch.accepted.length, 0);
  });

  await test('Future timestamp rejected', async () => {
    const future = new Date(now.getTime() + 60 * 60 * 1000);
    const batch = await processor.process([
      {
        deviceId: 'dev-1',
        timestamp: future,
        metric: 'occupancy',
        value: 10,
        unit: 'people',
        quality: 'GOOD',
      },
    ]);
    assert.strictEqual(batch.accepted.length, 0);
  });

  await test('BAD quality rejected', async () => {
    const batch = await processor.process([
      {
        deviceId: 'dev-1',
        timestamp: now,
        metric: 'occupancy',
        value: 10,
        unit: 'people',
        quality: 'BAD',
      },
    ]);
    assert.strictEqual(batch.accepted.length, 0);
  });

  await test('Device online health assessment', () => {
    const report = healthService.assess({
      id: 'd1',
      deviceId: 'sensor-1',
      name: 'Temp Sensor',
      type: 'TEMPERATURE_SENSOR',
      status: 'ONLINE',
      lastSeenAt: new Date(now.getTime() - 2 * 60 * 1000),
      isActive: true,
    } as any);
    assert.strictEqual(report.dataFreshness, 'LIVE');
    assert.ok(report.healthScore >= 80);
  });

  await test('Device offline uses communication-loss language', () => {
    const report = healthService.assess({
      id: 'd1',
      deviceId: 'sensor-1',
      name: 'Temp Sensor',
      type: 'TEMPERATURE_SENSOR',
      status: 'OFFLINE',
      lastSeenAt: new Date(now.getTime() - 45 * 60 * 1000),
      isActive: true,
    } as any);
    assert.ok(report.issues.some((i) => i.message.includes('has not reported')));
    assert.strictEqual(report.dataFreshness, 'STALE');
  });

  await test('Occupancy over capacity rule fires', () => {
    const events = ruleEngine.evaluateTelemetry(
      {
        id: 'd1',
        deviceId: 'occ-1',
        name: 'Occupancy',
        roomId: 'room-1',
        room: { capacity: 60, roomNumber: '201' },
      } as any,
      {
        deviceId: 'occ-1',
        timestamp: now,
        metric: 'occupancy',
        value: 70,
        unit: 'people',
        normalizedValue: 70,
        normalizedUnit: 'people',
        quality: 'GOOD',
      },
    );
    assert.ok(events.some((e) => e.type === 'OCCUPANCY_OVER_CAPACITY'));
  });

  await test('Utility anomaly rule does not confirm leak', () => {
    const evt = ruleEngine.evaluateUtilityAnomaly(
      { id: 'd1', name: 'Water Meter' } as any,
      'flow',
      500,
      100,
    );
    assert.ok(evt);
    assert.ok(!evt!.description.toLowerCase().includes('leak confirmed'));
    assert.ok(evt!.description.includes('abnormal'));
  });

  await test('Device offline rule event', () => {
    const evt = ruleEngine.evaluateDeviceOffline({ id: 'd1', name: 'Sensor', deviceId: 's1' } as any, 35);
    assert.ok(evt);
    assert.strictEqual(evt!.type, 'DEVICE_OFFLINE');
  });

  await test('IoT events emit for telemetry', () => {
    emitted.length = 0;
    iotEvents.emit('telemetry.updated', {
      timestamp: now.toISOString(),
      deviceId: 'dev-1',
      deviceInternalId: 'uuid-1',
    });
    assert.ok(emitted.some((e) => e.event === 'telemetry.updated'));
  });

  await test('Duplicate idempotency concept — processor accepts unique keys', async () => {
    const key = `dup-${Date.now()}`;
    const batch = await processor.process([
      {
        deviceId: 'dev-1',
        timestamp: now,
        metric: 'light',
        value: 300,
        unit: 'lux',
        quality: 'GOOD',
        idempotencyKey: key,
      },
    ]);
    assert.strictEqual(batch.accepted.length, 1);
  });

  console.log('\n============================================================');
  console.log(`📊 IOT RESULTS: ${passed} / ${passed + failed} TESTS PASSED`);
  console.log('============================================================\n');

  if (failed > 0) process.exit(1);
}

void runTests();
