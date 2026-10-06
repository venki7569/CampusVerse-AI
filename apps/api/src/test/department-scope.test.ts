// @ts-nocheck
import assert from 'node:assert';
import {
  applyDepartmentQueryFilter,
  assertDepartmentAccess,
  resolveDepartmentScope,
} from '../services/department-scope.service';

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

const mockDb = {
  user: {
    findUnique: async ({ where }: { where: { id: string } }) => {
      if (where.id === 'dept-admin-cs') return { departmentId: 'dept-cs' };
      if (where.id === 'dept-admin-no-dept') return { departmentId: null };
      return null;
    },
  },
};

async function runTests() {
  console.log('\n============================================================');
  console.log('DEPARTMENT SCOPE TESTS');
  console.log('============================================================\n');

  await test('SUPER_ADMIN is campus-wide', async () => {
    const scope = await resolveDepartmentScope(mockDb as never, {
      userId: 'super',
      roles: ['SUPER_ADMIN'],
    });
    assert.strictEqual(scope.restricted, false);
  });

  await test('CAMPUS_ADMIN is campus-wide', async () => {
    const scope = await resolveDepartmentScope(mockDb as never, {
      userId: 'campus',
      roles: ['CAMPUS_ADMIN'],
    });
    assert.strictEqual(scope.restricted, false);
  });

  await test('DEPARTMENT_ADMIN is restricted to assigned department', async () => {
    const scope = await resolveDepartmentScope(mockDb as never, {
      userId: 'dept-admin-cs',
      roles: ['DEPARTMENT_ADMIN'],
    });
    assert.strictEqual(scope.restricted, true);
    assert.strictEqual(scope.departmentId, 'dept-cs');
  });

  await test('FACULTY is not department-restricted at API layer', async () => {
    const scope = await resolveDepartmentScope(mockDb as never, {
      userId: 'faculty',
      roles: ['FACULTY'],
    });
    assert.strictEqual(scope.restricted, false);
  });

  await test('applyDepartmentQueryFilter forces departmentId', async () => {
    const scoped = applyDepartmentQueryFilter(
      { restricted: true, departmentId: 'dept-cs' },
      { page: 1, limit: 10 },
    );
    assert.strictEqual(scoped.departmentId, 'dept-cs');
  });

  await test('cross-department query is rejected', async () => {
    let rejected = false;
    try {
      applyDepartmentQueryFilter(
        { restricted: true, departmentId: 'dept-cs' },
        { page: 1, limit: 10, departmentId: 'dept-ee' },
      );
    } catch (err: any) {
      rejected = err?.statusCode === 403;
    }
    assert.strictEqual(rejected, true);
  });

  await test('assertDepartmentAccess blocks foreign department', async () => {
    let rejected = false;
    try {
      assertDepartmentAccess({ restricted: true, departmentId: 'dept-cs' }, 'dept-ee');
    } catch (err: any) {
      rejected = err?.statusCode === 403;
    }
    assert.strictEqual(rejected, true);
  });

  await test('campus-wide resource without department is allowed', async () => {
    assert.doesNotThrow(() => {
      assertDepartmentAccess({ restricted: true, departmentId: 'dept-cs' }, null);
    });
  });

  await test('unassigned DEPARTMENT_ADMIN is rejected', async () => {
    let rejected = false;
    try {
      await resolveDepartmentScope(mockDb as never, {
        userId: 'dept-admin-no-dept',
        roles: ['DEPARTMENT_ADMIN'],
      });
    } catch (err: any) {
      rejected = err?.statusCode === 403;
    }
    assert.strictEqual(rejected, true);
  });

  console.log('\n============================================================');
  console.log(`📊 DEPARTMENT SCOPE: ${passed} / ${passed + failed} TESTS PASSED`);
  console.log('============================================================\n');

  if (failed > 0) process.exit(1);
}

void runTests();
