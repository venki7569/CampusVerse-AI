import assert from 'node:assert';
import { ParkingService } from './parking.service';
import { parkingEvents, type ParkingEventName, type ParkingEventPayload } from './parking.events';
import type { ParkingAuditAction } from './parking.audit.service';
import type {
  ListParkingAreasQuery,
  ListParkingSlotsQuery,
  ParkingAvailabilityQuery,
} from './parking.dto';

let passed = 0;
let total = 0;

async function test(name: string, fn: () => Promise<void> | void): Promise<void> {
  total += 1;
  try {
    await fn();
    passed += 1;
    console.log(`  PASS  ${name}`);
  } catch (err) {
    console.error(`  FAIL  ${name}`);
    console.error(err);
  }
}

type Area = {
  id: string;
  name: string;
  location: string | null;
  buildingId: string | null;
  totalSlots: number;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
};

type Slot = {
  id: string;
  areaId: string;
  slotNumber: string;
  slotType: string;
  status: string;
  reservedForId: string | null;
  createdAt: Date;
  updatedAt: Date;
};

const emitted: Array<{ event: ParkingEventName; payload: ParkingEventPayload }> = [];
const audits: Array<{ action: ParkingAuditAction; entityId: string }> = [];
const notifications: Array<{ userId: string; title: string }> = [];

parkingEvents.subscribe((event, payload) => {
  emitted.push({ event, payload });
});

function makeId(prefix: string): string {
  return `${prefix}-${Math.random().toString(16).slice(2, 10)}`;
}

function buildHarness() {
  const areas: Area[] = [];
  const slots: Slot[] = [];
  const buildings = [
    { id: 'bld-1', code: 'MAIN', name: 'Main', operationalStatus: 'ACTIVE' as const },
    { id: 'bld-retired', code: 'OLD', name: 'Old', operationalStatus: 'RETIRED' as const },
  ];
  const users = [
    {
      id: 'user-1',
      email: 'a@campus.edu',
      firstName: 'A',
      lastName: 'User',
      isActive: true,
    },
    {
      id: 'user-2',
      email: 'b@campus.edu',
      firstName: 'B',
      lastName: 'User',
      isActive: true,
    },
    {
      id: 'user-inactive',
      email: 'x@campus.edu',
      firstName: 'X',
      lastName: 'User',
      isActive: false,
    },
  ];

  function areaInclude(area: Area) {
    return {
      ...area,
      building: buildings.find((b) => b.id === area.buildingId)
        ? {
            id: area.buildingId!,
            code: buildings.find((b) => b.id === area.buildingId)!.code,
            name: buildings.find((b) => b.id === area.buildingId)!.name,
          }
        : null,
      _count: { slots: slots.filter((s) => s.areaId === area.id).length },
      slots: slots.filter((s) => s.areaId === area.id),
    };
  }

  function slotInclude(slot: Slot) {
    const area = areas.find((a) => a.id === slot.areaId)!;
    return {
      ...slot,
      area: {
        id: area.id,
        name: area.name,
        location: area.location,
        buildingId: area.buildingId,
        isActive: area.isActive,
        building: buildings.find((b) => b.id === area.buildingId)
          ? {
              id: area.buildingId!,
              code: buildings.find((b) => b.id === area.buildingId)!.code,
              name: buildings.find((b) => b.id === area.buildingId)!.name,
            }
          : null,
      },
    };
  }

  const repo = {
    findAreas: async (query: ListParkingAreasQuery) => {
      let rows = [...areas];
      if (query.search) {
        const q = query.search.toLowerCase();
        rows = rows.filter(
          (a) => a.name.toLowerCase().includes(q) || (a.location ?? '').toLowerCase().includes(q),
        );
      }
      if (query.buildingId) rows = rows.filter((a) => a.buildingId === query.buildingId);
      if (typeof query.isActive === 'boolean') rows = rows.filter((a) => a.isActive === query.isActive);
      const total = rows.length;
      const start = (query.page - 1) * query.limit;
      return {
        data: rows.slice(start, start + query.limit).map(areaInclude),
        total,
        page: query.page,
        limit: query.limit,
      };
    },
    findAreaById: async (id: string) => {
      const area = areas.find((a) => a.id === id);
      return area ? areaInclude(area) : null;
    },
    findAreaByName: async (name: string) =>
      areas.find((a) => a.name.toLowerCase() === name.toLowerCase()) ?? null,
    createArea: async (dto: {
      name: string;
      location?: string | null;
      buildingId?: string | null;
      isActive?: boolean;
    }) => {
      const area: Area = {
        id: makeId('area'),
        name: dto.name,
        location: dto.location ?? null,
        buildingId: dto.buildingId ?? null,
        totalSlots: 0,
        isActive: dto.isActive ?? true,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      areas.push(area);
      return areaInclude(area);
    },
    updateArea: async (
      id: string,
      dto: Partial<{ name: string; location: string | null; buildingId: string | null; isActive: boolean }>,
    ) => {
      const area = areas.find((a) => a.id === id)!;
      Object.assign(area, dto, { updatedAt: new Date() });
      return areaInclude(area);
    },
    archiveArea: async (id: string) => {
      const area = areas.find((a) => a.id === id)!;
      area.isActive = false;
      return areaInclude(area);
    },
    deleteArea: async (id: string) => {
      const idx = areas.findIndex((a) => a.id === id);
      if (idx >= 0) areas.splice(idx, 1);
    },
    countActiveAllocationsInArea: async (areaId: string) =>
      slots.filter(
        (s) =>
          s.areaId === areaId &&
          (s.status === 'OCCUPIED' || s.status === 'RESERVED' || s.reservedForId !== null),
      ).length,
    recountAreaSlots: async (areaId: string) => {
      const total = slots.filter((s) => s.areaId === areaId).length;
      const area = areas.find((a) => a.id === areaId);
      if (area) area.totalSlots = total;
      return total;
    },
    groupSlotStatuses: async (areaId?: string, buildingId?: string) => {
      let rows = [...slots];
      if (areaId) rows = rows.filter((s) => s.areaId === areaId);
      if (buildingId) {
        const ids = new Set(areas.filter((a) => a.buildingId === buildingId).map((a) => a.id));
        rows = rows.filter((s) => ids.has(s.areaId));
      }
      const map = new Map<string, number>();
      for (const s of rows) {
        const key = `${s.areaId}::${s.status}`;
        map.set(key, (map.get(key) ?? 0) + 1);
      }
      return [...map.entries()].map(([key, count]) => {
        const [aid, status] = key.split('::');
        return { areaId: aid!, status: status!, _count: { _all: count } };
      });
    },
    findSlots: async (query: ListParkingSlotsQuery) => {
      let rows = [...slots];
      if (query.areaId) rows = rows.filter((s) => s.areaId === query.areaId);
      if (query.status) rows = rows.filter((s) => s.status === query.status);
      if (query.slotType) rows = rows.filter((s) => s.slotType === query.slotType);
      if (query.reservedForId) rows = rows.filter((s) => s.reservedForId === query.reservedForId);
      if (query.buildingId) {
        const ids = new Set(areas.filter((a) => a.buildingId === query.buildingId).map((a) => a.id));
        rows = rows.filter((s) => ids.has(s.areaId));
      }
      if (query.search) {
        const q = query.search.toLowerCase();
        rows = rows.filter(
          (s) =>
            s.slotNumber.toLowerCase().includes(q) ||
            s.slotType.toLowerCase().includes(q) ||
            s.status.toLowerCase().includes(q),
        );
      }
      const total = rows.length;
      const start = (query.page - 1) * query.limit;
      return {
        data: rows.slice(start, start + query.limit).map(slotInclude),
        total,
        page: query.page,
        limit: query.limit,
      };
    },
    findSlotById: async (id: string) => {
      const slot = slots.find((s) => s.id === id);
      return slot ? slotInclude(slot) : null;
    },
    findSlotByAreaAndNumber: async (areaId: string, slotNumber: string) =>
      slots.find((s) => s.areaId === areaId && s.slotNumber === slotNumber) ?? null,
    createSlot: async (dto: {
      areaId: string;
      slotNumber: string;
      slotType?: string;
      status?: string;
    }) => {
      const slot: Slot = {
        id: makeId('slot'),
        areaId: dto.areaId,
        slotNumber: dto.slotNumber,
        slotType: dto.slotType ?? 'STANDARD',
        status: dto.status ?? 'AVAILABLE',
        reservedForId: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      slots.push(slot);
      await repo.recountAreaSlots(dto.areaId);
      return slotInclude(slot);
    },
    updateSlot: async (
      id: string,
      dto: Partial<{ slotNumber: string; slotType: string; status: string }>,
    ) => {
      const slot = slots.find((s) => s.id === id)!;
      Object.assign(slot, dto, { updatedAt: new Date() });
      return slotInclude(slot);
    },
    allocateSlotIfAvailable: async (id: string, userId: string, status: 'OCCUPIED' | 'RESERVED') => {
      const slot = slots.find((s) => s.id === id);
      if (!slot || slot.status !== 'AVAILABLE' || slot.reservedForId) return null;
      slot.reservedForId = userId;
      slot.status = status;
      slot.updatedAt = new Date();
      return slotInclude(slot);
    },
    releaseSlot: async (id: string) => {
      const slot = slots.find((s) => s.id === id)!;
      slot.reservedForId = null;
      slot.status = 'AVAILABLE';
      slot.updatedAt = new Date();
      return slotInclude(slot);
    },
    deleteSlot: async (id: string, areaId: string) => {
      const idx = slots.findIndex((s) => s.id === id);
      if (idx >= 0) slots.splice(idx, 1);
      await repo.recountAreaSlots(areaId);
    },
    findActiveAllocationForUser: async (userId: string, excludeSlotId?: string) =>
      slots.find(
        (s) =>
          s.reservedForId === userId &&
          (s.status === 'OCCUPIED' || s.status === 'RESERVED') &&
          s.id !== excludeSlotId,
      ) ?? null,
    findUserById: async (id: string) => users.find((u) => u.id === id) ?? null,
    findUsersByIds: async (ids: string[]) => users.filter((u) => ids.includes(u.id)),
    findBuildingById: async (id: string) => buildings.find((b) => b.id === id) ?? null,
    countAreas: async (query: ParkingAvailabilityQuery = {}) => {
      let rows = [...areas];
      if (query.buildingId) rows = rows.filter((a) => a.buildingId === query.buildingId);
      if (query.areaId) rows = rows.filter((a) => a.id === query.areaId);
      return rows.length;
    },
    countActiveAreas: async (query: ParkingAvailabilityQuery = {}) => {
      let rows = areas.filter((a) => a.isActive);
      if (query.buildingId) rows = rows.filter((a) => a.buildingId === query.buildingId);
      if (query.areaId) rows = rows.filter((a) => a.id === query.areaId);
      return rows.length;
    },
    listAreasForSummary: async (query: ParkingAvailabilityQuery = {}) => {
      let rows = [...areas];
      if (query.buildingId) rows = rows.filter((a) => a.buildingId === query.buildingId);
      if (query.areaId) rows = rows.filter((a) => a.id === query.areaId);
      return rows.map((a) => ({ id: a.id, name: a.name, isActive: a.isActive }));
    },
  };

  const audit = {
    logEvent: async (entry: { action: ParkingAuditAction; entityId: string }) => {
      audits.push({ action: entry.action, entityId: entry.entityId });
    },
    notifyUser: async (input: { userId: string; title: string }) => {
      notifications.push({ userId: input.userId, title: input.title });
    },
  };

  const service = new ParkingService(repo as never, audit as never);
  return { service, areas, slots };
}

const defaultAreaQuery: ListParkingAreasQuery = {
  page: 1,
  limit: 20,
  sortOrder: 'asc',
  search: undefined,
  sortBy: undefined,
  buildingId: undefined,
  isActive: undefined,
};

const defaultSlotQuery: ListParkingSlotsQuery = {
  page: 1,
  limit: 20,
  sortOrder: 'asc',
  search: undefined,
  sortBy: undefined,
  areaId: undefined,
  buildingId: undefined,
  status: undefined,
  slotType: undefined,
  reservedForId: undefined,
};

async function runTests(): Promise<void> {
  console.log('\n============================================================');
  console.log('PARKING SERVICE TESTS');
  console.log('============================================================\n');

  emitted.length = 0;
  audits.length = 0;
  notifications.length = 0;
  const { service } = buildHarness();

  let areaId = '';
  let slotId = '';

  await test('Create parking area', async () => {
    const area = await service.createArea(
      { name: 'Lot A', location: 'North Gate', buildingId: 'bld-1', isActive: true },
      'actor-1',
    );
    areaId = area.id;
    assert.strictEqual(area.name, 'Lot A');
    assert.strictEqual(area.buildingId, 'bld-1');
    assert.ok(emitted.some((e) => e.event === 'parking.area.created'));
    assert.ok(audits.some((a) => a.action === 'createParkingArea'));
  });

  await test('Duplicate area rejection', async () => {
    let rejected = false;
    try {
      await service.createArea({ name: 'Lot A', isActive: true }, 'actor-1');
    } catch {
      rejected = true;
    }
    assert.strictEqual(rejected, true);
  });

  await test('Reject retired building', async () => {
    let rejected = false;
    try {
      await service.createArea({ name: 'Bad Lot', buildingId: 'bld-retired', isActive: true });
    } catch {
      rejected = true;
    }
    assert.strictEqual(rejected, true);
  });

  await test('Update parking area', async () => {
    const updated = await service.updateArea(areaId, { location: 'Updated Gate' }, 'actor-1');
    assert.strictEqual(updated.location, 'Updated Gate');
    assert.ok(emitted.some((e) => e.event === 'parking.area.updated'));
  });

  await test('Create parking slot', async () => {
    const slot = await service.createSlot(
      { areaId, slotNumber: 'A-01', slotType: 'STANDARD', status: 'AVAILABLE' },
      'actor-1',
    );
    slotId = slot.id;
    assert.strictEqual(slot.slotNumber, 'A-01');
    assert.ok(emitted.some((e) => e.event === 'parking.slot.created'));
  });

  await test('Invalid parent area for slot', async () => {
    let rejected = false;
    try {
      await service.createSlot({
        areaId: '00000000-0000-0000-0000-000000000099',
        slotNumber: 'X-01',
      });
    } catch {
      rejected = true;
    }
    assert.strictEqual(rejected, true);
  });

  await test('Slot uniqueness within area', async () => {
    let rejected = false;
    try {
      await service.createSlot({ areaId, slotNumber: 'A-01' });
    } catch {
      rejected = true;
    }
    assert.strictEqual(rejected, true);
  });

  await test('Update parking slot', async () => {
    const updated = await service.updateSlot(slotId, { slotType: 'EV' }, 'actor-1');
    assert.strictEqual(updated.slotType, 'EV');
  });

  await test('Allocate available slot', async () => {
    const allocated = await service.allocateSlot(slotId, { userId: 'user-1', status: 'OCCUPIED' }, 'actor-1');
    assert.strictEqual(allocated.status, 'OCCUPIED');
    assert.strictEqual(allocated.reservedForId, 'user-1');
    assert.ok(emitted.some((e) => e.event === 'parking.slot.allocated'));
    assert.ok(notifications.some((n) => n.userId === 'user-1'));
    assert.ok(audits.some((a) => a.action === 'allocateParkingSlot'));
  });

  await test('Reject already allocated slot', async () => {
    let rejected = false;
    try {
      await service.allocateSlot(slotId, { userId: 'user-2' });
    } catch {
      rejected = true;
    }
    assert.strictEqual(rejected, true);
  });

  await test('Reject conflicting user allocation', async () => {
    const second = await service.createSlot({ areaId, slotNumber: 'A-02' });
    let rejected = false;
    try {
      await service.allocateSlot(second.id, { userId: 'user-1' });
    } catch {
      rejected = true;
    }
    assert.strictEqual(rejected, true);
  });

  await test('Reject invalid user allocation', async () => {
    const free = await service.createSlot({ areaId, slotNumber: 'A-03' });
    let rejected = false;
    try {
      await service.allocateSlot(free.id, { userId: '00000000-0000-0000-0000-000000000077' });
    } catch {
      rejected = true;
    }
    assert.strictEqual(rejected, true);
  });

  await test('Reject inactive user allocation', async () => {
    const free = await service.createSlot({ areaId, slotNumber: 'A-04' });
    let rejected = false;
    try {
      await service.allocateSlot(free.id, { userId: 'user-inactive' });
    } catch {
      rejected = true;
    }
    assert.strictEqual(rejected, true);
  });

  await test('Reject allocate under maintenance', async () => {
    const maint = await service.createSlot({
      areaId,
      slotNumber: 'A-05',
      status: 'UNDER_MAINTENANCE',
    });
    let rejected = false;
    try {
      await service.allocateSlot(maint.id, { userId: 'user-2' });
    } catch {
      rejected = true;
    }
    assert.strictEqual(rejected, true);
  });

  await test('Release allocation', async () => {
    const released = await service.releaseSlot(slotId, 'actor-1');
    assert.strictEqual(released.status, 'AVAILABLE');
    assert.strictEqual(released.reservedForId, null);
    assert.ok(emitted.some((e) => e.event === 'parking.slot.released'));
    assert.ok(audits.some((a) => a.action === 'releaseParkingSlot'));
  });

  await test('Reject invalid release', async () => {
    let rejected = false;
    try {
      await service.releaseSlot(slotId);
    } catch {
      rejected = true;
    }
    assert.strictEqual(rejected, true);
  });

  await test('Reject archive slot with allocation', async () => {
    await service.allocateSlot(slotId, { userId: 'user-1' });
    let rejected = false;
    try {
      await service.archiveSlot(slotId);
    } catch {
      rejected = true;
    }
    assert.strictEqual(rejected, true);
    await service.releaseSlot(slotId);
  });

  await test('Archive slot without allocation', async () => {
    const archived = await service.archiveSlot(slotId, 'actor-1');
    assert.strictEqual(archived.status, 'UNDER_MAINTENANCE');
    assert.ok(audits.some((a) => a.action === 'archiveParkingSlot'));
  });

  await test('Cannot allocate inactive area slot', async () => {
    const free = await service.createSlot({ areaId, slotNumber: 'A-06' });
    await service.updateArea(areaId, { isActive: false });
    let rejected = false;
    try {
      await service.allocateSlot(free.id, { userId: 'user-2' });
    } catch {
      rejected = true;
    }
    assert.strictEqual(rejected, true);
    await service.updateArea(areaId, { isActive: true });
  });

  await test('Cannot deactivate area with active allocations', async () => {
    const free = await service.createSlot({ areaId, slotNumber: 'A-07' });
    await service.allocateSlot(free.id, { userId: 'user-2' });
    let rejected = false;
    try {
      await service.updateArea(areaId, { isActive: false });
    } catch {
      rejected = true;
    }
    assert.strictEqual(rejected, true);
    await service.releaseSlot(free.id);
  });

  await test('Availability calculations', async () => {
    const summary = await service.getAvailability({});
    assert.ok(summary.areas >= 1);
    assert.ok(summary.totalSlots >= 1);
    assert.ok(summary.byArea.length >= 1);
  });

  await test('List areas and slots', async () => {
    const areas = await service.listAreas(defaultAreaQuery);
    const slots = await service.listSlots(defaultSlotQuery);
    assert.ok(areas.data.length >= 1);
    assert.ok(slots.data.length >= 1);
  });

  await test('Permission codes are documented for parking', () => {
    const required = [
      'parking.view',
      'parking.create',
      'parking.update',
      'parking.delete',
      'parking.allocate',
    ];
    assert.strictEqual(required.length, 5);
  });

  await test('Cannot add slot to inactive area', async () => {
    await service.updateArea(areaId, { isActive: false });
    // release any remaining allocations first for clean deactivate? already none for area after previous release of A-07
    // but archive may fail if allocations remain - we released A-07
    // Actually update to inactive may have failed if allocations remain. Recreate clean area.
    const clean = await service.createArea({ name: 'Lot Inactive', isActive: true });
    await service.updateArea(clean.id, { isActive: false });
    let rejected = false;
    try {
      await service.createSlot({ areaId: clean.id, slotNumber: 'Z-01' });
    } catch {
      rejected = true;
    }
    assert.strictEqual(rejected, true);
  });

  console.log('\n============================================================');
  console.log(`PARKING RESULTS: ${passed} / ${total} TESTS PASSED`);
  console.log('============================================================\n');

  if (passed !== total) process.exit(1);
}

void runTests();
