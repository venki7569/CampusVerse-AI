// @ts-nocheck
import assert from 'node:assert';
import bcrypt from 'bcryptjs';
import { AuthRepository } from '../modules/auth/auth.repository';
import { AuthService } from '../modules/auth/auth.service';

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

const passwordHash = bcrypt.hashSync('Password123!', 4);

const users = new Map([
  [
    'user-1',
    {
      id: 'user-1',
      email: 'profile@test.local',
      passwordHash,
      firstName: 'Test',
      lastName: 'User',
      isActive: true,
      departmentId: null,
      userRoles: [{ role: { name: 'FACULTY' } }],
    },
  ],
]);

const mockDb: any = {
  user: {
    findUnique: async ({ where }: any) => {
      if (where.email) return [...users.values()].find((u) => u.email === where.email) ?? null;
      return users.get(where.id) ?? null;
    },
    update: async ({ where, data, include }: any) => {
      const existing = users.get(where.id);
      if (!existing) throw new Error('not found');
      const updated = { ...existing, ...data };
      users.set(where.id, updated);
      return updated;
    },
  },
  role: { upsert: async () => ({ id: 'role-1', name: 'FACULTY' }) },
  userRole: { create: async () => ({}) },
  refreshToken: {
    create: async () => ({}),
    findUnique: async () => null,
    deleteMany: async () => ({}),
  },
};

async function runTests() {
  console.log('\n============================================================');
  console.log('AUTH PROFILE TESTS');
  console.log('============================================================\n');

  const repo = new AuthRepository(mockDb);
  const service = new AuthService(repo);

  await test('getCurrentUser returns departmentId without password', async () => {
    const user = await service.getCurrentUser('user-1');
    assert.strictEqual(user.email, 'profile@test.local');
    assert.strictEqual(user.firstName, 'Test');
    assert.ok(!('passwordHash' in user));
    assert.ok(!('password' in user));
  });

  await test('updateProfile changes safe fields only', async () => {
    const updated = await service.updateProfile('user-1', { firstName: 'Updated' });
    assert.strictEqual(updated.firstName, 'Updated');
    assert.strictEqual(updated.lastName, 'User');
  });

  await test('changePassword rejects wrong current password', async () => {
    let rejected = false;
    try {
      await service.changePassword('user-1', {
        currentPassword: 'WrongPassword!',
        newPassword: 'NewPassword123!',
      });
    } catch (err: any) {
      rejected = err?.statusCode === 401;
    }
    assert.strictEqual(rejected, true);
  });

  await test('changePassword succeeds with valid current password', async () => {
    await service.changePassword('user-1', {
      currentPassword: 'Password123!',
      newPassword: 'NewSecurePass123!',
    });
    const login = await service.login({ email: 'profile@test.local', password: 'NewSecurePass123!' });
    assert.ok(login.tokens.accessToken);
  });

  console.log('\n============================================================');
  console.log(`📊 AUTH PROFILE: ${passed} / ${passed + failed} TESTS PASSED`);
  console.log('============================================================\n');

  if (failed > 0) process.exit(1);
}

void runTests();
