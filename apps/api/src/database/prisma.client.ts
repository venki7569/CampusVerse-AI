import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import { config } from '../config/env';

let sharedPool: Pool | null = null;

/**
 * Creates a PrismaClient backed by the official PostgreSQL driver adapter (Prisma 7+).
 */
export function createPrismaClient(connectionString?: string): PrismaClient {
  const uri = connectionString ?? config.db.postgresUri;
  sharedPool = new Pool({ connectionString: uri });
  const adapter = new PrismaPg(sharedPool);
  return new PrismaClient({ adapter });
}

export async function disconnectPrismaClient(prisma: PrismaClient): Promise<void> {
  await prisma.$disconnect();
  if (sharedPool) {
    await sharedPool.end();
    sharedPool = null;
  }
}
