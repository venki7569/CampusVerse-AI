#!/usr/bin/env ts-node
/**
 * Standalone infrastructure probe for Phase 23 verification.
 * Usage: npx ts-node --transpile-only src/test/integration/verify-infra.ts
 */
import 'dotenv/config';
import { probeInfrastructure, teardownMongo } from './infra';

async function main() {
  const status = await probeInfrastructure();
  console.log(JSON.stringify(status, null, 2));
  await teardownMongo();
  const ready = status.postgres === 'ok' && status.mongodb === 'ok';
  process.exit(ready ? 0 : 1);
}

void main();
