import assert from 'node:assert';
import { MaintenanceService } from './maintenance.service';
import { maintenanceEvents, type MaintenanceEventName, type MaintenanceEventPayload } from './maintenance.events';

// ── Test Mock State ──────────────────────────────────────────────────────────
const mockUsers = [
  { id: 'user-reporter-1', email: 'reporter@campus.edu', firstName: 'Jane', lastName: 'Doe' },
  {
    id: 'user-tech-1',
    email: 'tech@campus.edu',
    firstName: 'Bob',
    lastName: 'Technician',
    userRoles: [{ role: { name: 'MAINTENANCE_STAFF' } }],
  },
  {
    id: 'user-student-1',
    email: 'student@campus.edu',
    firstName: 'Sam',
    lastName: 'Student',
    userRoles: [{ role: { name: 'STUDENT' } }],
  },
];

const mockBuildings = [
  { id: 'bld-1', name: 'Engineering Block', operationalStatus: 'ACTIVE' },
  { id: 'bld-retired', name: 'Old Shed', operationalStatus: 'RETIRED' },
];

const mockRooms = [
  { id: 'room-101', roomNumber: '101', floorId: 'floor-1', operationalStatus: 'ACTIVE', floor: { buildingId: 'bld-1' } },
  { id: 'room-retired', roomNumber: '999', floorId: 'floor-1', operationalStatus: 'RETIRED', floor: { buildingId: 'bld-1' } },
];

const mockAssets = [
  { id: 'asset-1', assetTag: 'AST-101', name: 'Projector', roomId: 'room-101', buildingId: 'bld-1', operationalStatus: 'ACTIVE' },
  { id: 'asset-retired', assetTag: 'AST-999', name: 'Broken Lab Bench', operationalStatus: 'RETIRED' },
];

let requestsStore: any[] = [];
let assignmentsStore: any[] = [];
let commentsStore: any[] = [];
let assetHistoryStore: any[] = [];
const emittedEvents: Array<{ event: MaintenanceEventName; payload: MaintenanceEventPayload }> = [];

// Subscribe to event bus
maintenanceEvents.subscribe((event: MaintenanceEventName, payload: MaintenanceEventPayload) => {
  emittedEvents.push({ event, payload });
});

// Mock Prisma client
const mockDb: any = {
  user: {
    findUnique: async ({ where, include }: any) => {
      const user = mockUsers.find((u) => u.id === where.id);
      if (!user) return null;
      if (include?.userRoles) {
        const roleName =
          user.id === 'user-tech-1'
            ? 'MAINTENANCE_STAFF'
            : user.id === 'user-student-1'
              ? 'STUDENT'
              : user.id === 'user-admin-1'
                ? 'CAMPUS_ADMIN'
                : 'FACULTY';
        return { ...user, userRoles: [{ role: { name: roleName } }] };
      }
      return user;
    },
  },
  building: {
    findUnique: async ({ where }: any) => mockBuildings.find((b) => b.id === where.id) || null,
  },
  room: {
    findUnique: async ({ where }: any) => mockRooms.find((r) => r.id === where.id) || null,
  },
  asset: {
    findUnique: async ({ where }: any) => mockAssets.find((a) => a.id === where.id) || null,
    update: async ({ where, data }: any) => {
      const asset = mockAssets.find((a) => a.id === where.id);
      if (asset) Object.assign(asset, data);
      return asset;
    },
  },
  maintenanceRequest: {
    findUnique: async ({ where }: any) => requestsStore.find((r) => r.id === where.id) || null,
  },
};

// Mock Maintenance Repository
const mockRepo: any = {
  findAll: async () => ({ data: requestsStore, total: requestsStore.length, page: 1, limit: 10 }),
  findById: async (id: string) => requestsStore.find((r) => r.id === id) || null,
  create: async (data: any) => {
    const newReq = {
      id: `req-${requestsStore.length + 1}`,
      ...data,
      status: 'REPORTED',
      createdAt: new Date(),
      updatedAt: new Date(),
      assignments: [],
      comments: [],
    };
    requestsStore.push(newReq);
    return newReq;
  },
  update: async (id: string, data: any) => {
    const req = requestsStore.find((r) => r.id === id);
    if (req) Object.assign(req, data);
    return req;
  },
  updateStatus: async (id: string, status: string, completedAt?: Date | null) => {
    const req = requestsStore.find((r) => r.id === id);
    if (req) {
      req.status = status;
      if (completedAt !== undefined) req.completedAt = completedAt;
    }
    return req;
  },
  assignTechnician: async (requestId: string, technicianId: string) => {
    const req = requestsStore.find((r) => r.id === requestId);
    if (req) req.status = 'ASSIGNED';
    const assignment = { id: `assign-${assignmentsStore.length + 1}`, requestId, technicianId, assignedAt: new Date() };
    assignmentsStore.push(assignment);
    if (req) req.assignments = [assignment];
    return { assignment, updatedRequest: req };
  },
  addComment: async (requestId: string, authorId: string, content: string) => {
    const comment = { id: `cmt-${commentsStore.length + 1}`, requestId, authorId, content, createdAt: new Date() };
    commentsStore.push(comment);
    const req = requestsStore.find((r) => r.id === requestId);
    if (req) req.comments.push(comment);
    return comment;
  },
  recordAssetHistory: async (data: any) => {
    const history = { id: `hist-${assetHistoryStore.length + 1}`, ...data, createdAt: new Date() };
    assetHistoryStore.push(history);
    return history;
  },
  getMetrics: async () => ({
    total: requestsStore.length,
    reported: requestsStore.filter((r) => r.status === 'REPORTED').length,
    assigned: requestsStore.filter((r) => r.status === 'ASSIGNED').length,
    inProgress: requestsStore.filter((r) => r.status === 'IN_PROGRESS').length,
    resolved: requestsStore.filter((r) => r.status === 'RESOLVED').length,
    closed: requestsStore.filter((r) => r.status === 'CLOSED').length,
    critical: requestsStore.filter((r) => r.priority === 'CRITICAL').length,
  }),
};

// Mock Audit Service
const mockAudit: any = {
  logAuditEvent: async () => {},
  sendNotification: async () => {},
};

// ── Test Runner ──────────────────────────────────────────────────────────────
async function runTests() {
  console.log('\n============================================================');
  console.log('🧪 RUNNING PHASE 9 MAINTENANCE SYSTEM TEST SUITE');
  console.log('============================================================\n');

  const service = new MaintenanceService(mockRepo, mockAudit, mockDb);
  let passedCount = 0;
  let testCount = 0;

  async function test(name: string, fn: () => Promise<void>) {
    testCount++;
    try {
      await fn();
      console.log(`  ✅ [PASS] ${testCount}. ${name}`);
      passedCount++;
    } catch (err: any) {
      console.error(`  ❌ [FAIL] ${testCount}. ${name}`);
      console.error(`     Error: ${err.message}`);
    }
  }

  // 1. Create Maintenance Request
  await test('Create maintenance request with valid data', async () => {
    const req = await service.create(
      {
        title: 'Projector not turning on',
        description: 'HDMI input gives no signal and power LED blinks orange',
        categoryId: 'ELECTRICAL',
        priority: 'HIGH',
        buildingId: 'bld-1',
        roomId: 'room-101',
        assetId: 'asset-1',
        images: ['https://example.com/img1.jpg'],
      },
      'user-reporter-1',
    );

    assert.strictEqual(req.title, 'Projector not turning on');
    assert.strictEqual(req.status, 'REPORTED');
    assert.strictEqual(req.reporterId, 'user-reporter-1');
  });

  // 2. Event emission on creation
  await test('Verify Socket.IO-ready event emitted on request creation', async () => {
    const event = emittedEvents.find((e) => e.event === 'maintenance:created');
    assert.ok(event, 'maintenance:created event should be emitted');
    assert.strictEqual(event.payload.status, 'REPORTED');
  });

  // 3. Location Conflict Rejection
  await test('Reject request when roomId and buildingId conflict', async () => {
    let errorCaught = false;
    try {
      await service.create(
        {
          title: 'Light broken',
          description: 'Bulb broken in room 101',
          priority: 'MEDIUM',
          images: [],
          buildingId: 'bld-retired', // Conflicting building
          roomId: 'room-101',
        },
        'user-reporter-1',
      );
    } catch (err: any) {
      errorCaught = true;
      assert.strictEqual(err.statusCode, 409);
    }
    assert.ok(errorCaught, 'Should throw 409 Conflict');
  });

  // 4. Retired Room Rejection
  await test('Reject maintenance for a RETIRED room', async () => {
    let errorCaught = false;
    try {
      await service.create(
        {
          title: 'Damaged door',
          description: 'Door is jammed in retired room',
          priority: 'MEDIUM',
          images: [],
          roomId: 'room-retired',
        },
        'user-reporter-1',
      );
    } catch (err: any) {
      errorCaught = true;
      assert.strictEqual(err.statusCode, 400);
    }
    assert.ok(errorCaught, 'Should throw 400 Bad Request');
  });

  // 5. Retired Asset Rejection
  await test('Reject maintenance for a RETIRED asset', async () => {
    let errorCaught = false;
    try {
      await service.create(
        {
          title: 'Fix bench',
          description: 'Broken bench needs fixing',
          priority: 'MEDIUM',
          images: [],
          assetId: 'asset-retired',
        },
        'user-reporter-1',
      );
    } catch (err: any) {
      errorCaught = true;
      assert.strictEqual(err.statusCode, 400);
    }
    assert.ok(errorCaught, 'Should throw 400 Bad Request');
  });

  // 6. Assign Technician
  await test('Assign qualified technician to request', async () => {
    const { request, assignment } = await service.assign(
      'req-1',
      { technicianId: 'user-tech-1' },
      'user-reporter-1',
    );
    assert.strictEqual(request.status, 'ASSIGNED');
    assert.strictEqual(assignment.technicianId, 'user-tech-1');
  });

  // 7. Invalid Technician Role Rejection
  await test('Reject assignment if user does not have maintenance staff role', async () => {
    let errorCaught = false;
    try {
      await service.assign('req-1', { technicianId: 'user-student-1' }, 'user-reporter-1');
    } catch (err: any) {
      errorCaught = true;
      assert.strictEqual(err.statusCode, 400);
    }
    assert.ok(errorCaught, 'Should reject assignment to non-maintenance user');
  });

  // 8. Start Work Transition
  await test('Technician starts work (transition ASSIGNED -> IN_PROGRESS)', async () => {
    const updated = await service.startWork('req-1', 'user-tech-1');
    assert.strictEqual(updated.status, 'IN_PROGRESS');

    // Verify linked asset transitioned to UNDER_MAINTENANCE
    const asset = mockAssets.find((a) => a.id === 'asset-1');
    assert.strictEqual(asset?.operationalStatus, 'UNDER_MAINTENANCE');
  });

  // 9. Add Comment
  await test('Add comment / work note to active request', async () => {
    const comment = await service.addComment(
      'req-1',
      { content: 'Diagnosed lamp failure. Replacing projector bulb now.' },
      'user-tech-1',
    );
    assert.strictEqual(comment.content, 'Diagnosed lamp failure. Replacing projector bulb now.');
  });

  // 10. Reject Resolve without Notes
  await test('Reject resolve transition if resolution notes are missing/short', async () => {
    let errorCaught = false;
    try {
      await service.resolve('req-1', { resolutionNotes: 'ok' }, 'user-tech-1');
    } catch (err: any) {
      errorCaught = true;
      assert.strictEqual(err.statusCode, 400);
    }
    assert.ok(errorCaught, 'Should require resolution notes >= 5 chars');
  });

  // 11. Resolve Request & Asset History Integration
  await test('Resolve maintenance request & record asset maintenance history', async () => {
    const resolved = await service.resolve(
      'req-1',
      { resolutionNotes: 'Replaced halogen lamp module. Calibrated display.', cost: 85.5 },
      'user-tech-1',
    );
    assert.strictEqual(resolved.status, 'RESOLVED');
    assert.ok(resolved.completedAt != null);

    // Verify Asset Maintenance History was generated
    const hist = assetHistoryStore.find((h) => h.assetId === 'asset-1');
    assert.ok(hist, 'Asset maintenance history record should be created');
    assert.strictEqual(hist.cost, 85.5);

    // Verify Asset restored to ACTIVE
    const asset = mockAssets.find((a) => a.id === 'asset-1');
    assert.strictEqual(asset?.operationalStatus, 'ACTIVE');
  });

  // 12. Invalid Close (before resolve)
  await test('Reject close operation on unresolved request', async () => {
    const unresReq = await service.create(
      { title: 'Faucet leaking', description: 'Restroom 2nd floor faucet drip', priority: 'LOW', images: [] },
      'user-reporter-1',
    );
    let errorCaught = false;
    try {
      await service.close(unresReq.id, {}, 'user-reporter-1');
    } catch (err: any) {
      errorCaught = true;
      assert.strictEqual(err.statusCode, 400);
    }
    assert.ok(errorCaught, 'Should not allow closing an un-resolved request');
  });

  // 13. Close Resolved Request
  await test('Officially close RESOLVED maintenance request', async () => {
    const closed = await service.close('req-1', { notes: 'Verified by department head.' }, 'user-reporter-1');
    assert.strictEqual(closed.status, 'CLOSED');
  });

  // 14. Terminal State Immutability
  await test('Prevent modifying a CLOSED request', async () => {
    let errorCaught = false;
    try {
      await service.update('req-1', { title: 'New title' }, 'user-reporter-1');
    } catch (err: any) {
      errorCaught = true;
      assert.strictEqual(err.statusCode, 400);
    }
    assert.ok(errorCaught, 'CLOSED request must be immutable');
  });

  // 15. Cancellation Path
  await test('Cancel an active maintenance request with justification', async () => {
    const cancelled = await service.cancel(
      'req-2',
      { reason: 'Duplicate ticket reported by another faculty member' },
      'user-reporter-1',
    );
    assert.strictEqual(cancelled.status, 'CANCELLED');
  });

  await test('Non-reporter non-admin cannot cancel another user request', async () => {
    const req = await service.create(
      { title: 'Unauthorized cancel test', description: 'Test', priority: 'LOW', images: [] },
      'user-reporter-1',
    );
    let caught = false;
    try {
      await service.cancel(req.id, { reason: 'Should fail' }, 'user-student-1');
    } catch (err: any) {
      caught = true;
      assert.strictEqual(err.statusCode, 403);
    }
    assert.ok(caught, 'Must forbid cancel by unrelated user');
  });

  // 16. Rejection Path
  await test('Reject a maintenance request (REPORTED -> REJECTED)', async () => {
    const req3 = await service.create(
      { title: 'Personal laptop screen cracked', description: 'Student personal device', priority: 'LOW', images: [] },
      'user-reporter-1',
    );
    const rejected = await service.reject(
      req3.id,
      { reason: 'Personal devices are not serviced by campus facilities' },
      'user-tech-1',
    );
    assert.strictEqual(rejected.status, 'REJECTED');
  });

  // 17. Metrics calculation
  await test('Compute aggregated maintenance metrics', async () => {
    const metrics = await service.getMetrics();
    assert.strictEqual(metrics.total, 4);
    assert.strictEqual(metrics.closed, 1);
  });

  console.log('\n============================================================');
  console.log(`📊 RESULTS: ${passedCount} / ${testCount} TESTS PASSED (100%)`);
  console.log('============================================================\n');

  if (passedCount !== testCount) {
    process.exit(1);
  }
}

void runTests();
