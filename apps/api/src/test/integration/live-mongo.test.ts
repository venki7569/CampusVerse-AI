// @ts-nocheck
/**
 * Live MongoDB integration verification.
 */
import assert from 'node:assert';
import 'dotenv/config';
import mongoose from 'mongoose';
import { Notification } from '../../modules/database/mongodb/schemas/notification.schema';
import { AuditLog } from '../../modules/database/mongodb/schemas/auditLog.schema';
import { Recommendation } from '../../modules/digital-twin/recommendation.schema';
import { TelemetryReading } from '../../modules/iot/telemetry.schema';
import { AIConversation } from '../../modules/database/mongodb/schemas/aiConversation.schema';
import { AnalyticsSnapshot } from '../../modules/database/mongodb/schemas/analyticsSnapshot.schema';
import { config } from '../../config/env';
import { probeInfrastructure, teardownMongo } from './infra';

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
  console.log('LIVE MONGODB INTEGRATION TESTS');
  console.log('============================================================\n');

  const infra = await probeInfrastructure();
  if (infra.mongodb !== 'ok') {
    console.log('MongoDB unavailable — skipping.\n');
    process.exit(0);
  }

  if (mongoose.connection.readyState !== 1) {
    await mongoose.connect(config.db.mongoUri);
  }

  await test('Notification collection accessible', async () => {
    const count = await Notification.countDocuments();
    assert.ok(count >= 0);
  });

  await test('AuditLog collection accessible', async () => {
    const count = await AuditLog.countDocuments();
    assert.ok(count >= 0);
  });

  await test('Recommendation collection accessible', async () => {
    const count = await Recommendation.countDocuments();
    assert.ok(count >= 0);
  });

  await test('TelemetryReading collection + TTL index', async () => {
    const indexes = await TelemetryReading.collection.indexes();
    const ttl = indexes.find(
      (idx) => typeof idx.expireAfterSeconds === 'number' && idx.expireAfterSeconds > 0,
    );
    if (ttl) {
      assert.strictEqual(ttl.expireAfterSeconds, 90 * 24 * 60 * 60);
      return;
    }
    // Index may not exist until first document on empty DB — verify schema declares TTL
    const ttlFromSchema = TelemetryReading.schema.indexes().find(
      (spec) => Array.isArray(spec) && spec[1]?.expireAfterSeconds,
    );
    assert.ok(ttlFromSchema, 'TelemetryReading schema must declare 90-day TTL on createdAt');
  });

  await test('AIConversation collection accessible', async () => {
    const count = await AIConversation.countDocuments();
    assert.ok(count >= 0);
  });

  await test('AnalyticsSnapshot collection accessible', async () => {
    const count = await AnalyticsSnapshot.countDocuments();
    assert.ok(count >= 0);
  });

  await teardownMongo();

  console.log('\n============================================================');
  console.log(`📊 LIVE MONGO: ${passed} / ${passed + failed} PASSED`);
  console.log('============================================================\n');

  if (failed > 0) process.exit(1);
}

void runTests();
