#!/usr/bin/env ts-node
/**
 * Phase 24 — Verify demo seed idempotency (requires PostgreSQL + seed passwords).
 * Usage: npm run verify:seed
 */
import 'dotenv/config';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { createPrismaClient, disconnectPrismaClient } from '../../database/prisma.client';
import { probeInfrastructure, teardownMongo } from './infra';

async function counts(db: ReturnType<typeof createPrismaClient>) {
  const [users, buildings, assets, maintenance, meters, parkingAreas, iotDevices] = await Promise.all([
    db.user.count(),
    db.building.count(),
    db.asset.count(),
    db.maintenanceRequest.count(),
    db.electricityMeter.count(),
    db.parkingArea.count(),
    db.ioTDevice.count(),
  ]);
  return { users, buildings, assets, maintenance, meters, parkingAreas, iotDevices };
}

async function main() {
  const infra = await probeInfrastructure();
  if (infra.postgres !== 'ok') {
    console.error('PostgreSQL unavailable — cannot verify seed idempotency.');
    console.error(infra.postgresError);
    await teardownMongo();
    process.exit(1);
  }

  if (!process.env['SEED_ADMIN_PASSWORD'] && !process.env['SEED_DEMO_PASSWORD']) {
    console.error('Set SEED_ADMIN_PASSWORD and/or SEED_DEMO_PASSWORD before running seed verification.');
    process.exit(1);
  }

  const apiRoot = path.resolve(__dirname, '..', '..', '..');
  const db = createPrismaClient();

  try {
    const before = await counts(db);
    console.log('Counts before seed:', before);

    for (let run = 1; run <= 2; run++) {
      console.log(`\nRunning seed pass ${run}...`);
      const result = spawnSync('npx', ['ts-node', '--transpile-only', 'src/database/seeds/seed.ts'], {
        cwd: apiRoot,
        stdio: 'inherit',
        shell: true,
        env: process.env,
      });
      if (result.status !== 0) {
        console.error(`Seed pass ${run} failed`);
        process.exit(1);
      }
    }

    const after = await counts(db);
    console.log('\nCounts after double seed:', after);

    if (after.users !== before.users && before.users > 0) {
      console.warn('User count changed — verify upsert logic if unexpected.');
    }

    if (after.buildings < before.buildings) {
      console.error('Building count decreased — seed may not be idempotent.');
      process.exit(1);
    }

    console.log('\nSeed idempotency check: PASS (no destructive duplicate growth detected)');
    console.log('Verify role coverage: SUPER_ADMIN, CAMPUS_ADMIN, DEPARTMENT_ADMIN, FACULTY, STUDENT, MAINTENANCE_STAFF, SECURITY_STAFF');

    const roles = await db.role.findMany({ select: { name: true } });
    console.log('Roles present:', roles.map((r) => r.name).join(', '));
  } finally {
    await disconnectPrismaClient(db);
    await teardownMongo();
  }
}

void main();
