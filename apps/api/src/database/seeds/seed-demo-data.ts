import {
  PrismaClient,
  MaintenancePriority,
  MaintenanceStatus,
  AnnouncementStatus,
  AnnouncementPriority,
  AnnouncementCategory,
  AnnouncementAudienceType,
  IoTDeviceType,
  IoTDeviceStatus,
} from '@prisma/client';
import mongoose from 'mongoose';
import { Recommendation } from '../../modules/digital-twin/recommendation.schema';
import { Notification } from '../../modules/database/mongodb/schemas/notification.schema';

interface DemoContext {
  buildingId: string;
  scienceBuildingId: string;
  floorId: string;
  roomId: string;
  labRoomId: string;
  csDeptId: string;
  eeDeptId: string;
  userIds: Map<string, string>;
  authorId: string;
}

export async function seedExtendedDemoData(prisma: PrismaClient, ctx: DemoContext): Promise<void> {
  await seedMoreRooms(prisma, ctx);
  await seedMoreAssets(prisma, ctx);
  await seedMaintenanceLifecycle(prisma, ctx);
  await seedUtilityHistory(prisma, ctx);
  await seedParkingDemo(prisma, ctx);
  await seedAnnouncements(prisma, ctx);
  await seedIoTDevices(prisma, ctx);
  await seedMongoExtras(ctx);
}

async function seedMoreRooms(prisma: PrismaClient, ctx: DemoContext): Promise<void> {
  const eeRoom = await prisma.room.findFirst({
    where: { roomNumber: '102', floorId: ctx.floorId },
  });
  if (!eeRoom) {
    await prisma.room.create({
      data: {
        roomNumber: '102',
        floorId: ctx.floorId,
        departmentId: ctx.eeDeptId,
        capacity: 40,
        roomType: 'CLASSROOM',
        occupancyStatus: 'OCCUPIED',
      },
    });
  }

  const storage = await prisma.room.findFirst({
    where: { roomNumber: 'STO-01', floorId: ctx.floorId },
  });
  if (!storage) {
    await prisma.room.create({
      data: {
        roomNumber: 'STO-01',
        floorId: ctx.floorId,
        capacity: 0,
        roomType: 'STORAGE',
        occupancyStatus: 'AVAILABLE',
      },
    });
  }
}

async function seedMoreAssets(prisma: PrismaClient, ctx: DemoContext): Promise<void> {
  const furniture = await prisma.assetCategory.upsert({
    where: { name: 'Furniture' },
    update: {},
    create: { name: 'Furniture', description: 'Desks, chairs, boards' },
  });

  const statuses = [
    { tag: 'AST-DEMO-002', name: 'Lab Workstation', condition: 'Excellent', status: 'ACTIVE' as const },
    { tag: 'AST-DEMO-003', name: 'EE Oscilloscope', condition: 'Fair', status: 'UNDER_MAINTENANCE' as const, dept: ctx.eeDeptId },
    { tag: 'AST-DEMO-004', name: 'Retired Printer', condition: 'Poor', status: 'RETIRED' as const },
  ];

  for (const spec of statuses) {
    await prisma.asset.upsert({
      where: { assetTag: spec.tag },
      update: {},
      create: {
        assetTag: spec.tag,
        name: spec.name,
        categoryId: furniture.id,
        buildingId: ctx.buildingId,
        roomId: spec.dept === ctx.eeDeptId ? undefined : ctx.roomId,
        departmentId: spec.dept ?? ctx.csDeptId,
        condition: spec.condition,
        operationalStatus: spec.status,
      },
    });
  }
}

async function seedMaintenanceLifecycle(prisma: PrismaClient, ctx: DemoContext): Promise<void> {
  const maintUser = ctx.userIds.get('maintenance@campusverse.local') ?? ctx.authorId;
  const faculty = ctx.userIds.get('faculty@campusverse.local') ?? ctx.authorId;

  const tickets: Array<{
    title: string;
    status: MaintenanceStatus;
    priority: MaintenancePriority;
  }> = [
    { title: 'Demo — Assigned ticket', status: 'ASSIGNED', priority: 'HIGH' },
    { title: 'Demo — In progress ticket', status: 'IN_PROGRESS', priority: 'MEDIUM' },
    { title: 'Demo — Resolved ticket', status: 'RESOLVED', priority: 'LOW' },
    { title: 'Demo — Closed ticket', status: 'CLOSED', priority: 'LOW' },
    { title: 'Demo — Cancelled ticket', status: 'CANCELLED', priority: 'LOW' },
  ];

  for (const t of tickets) {
    const existing = await prisma.maintenanceRequest.findFirst({ where: { title: t.title } });
    if (existing) continue;

    const req = await prisma.maintenanceRequest.create({
      data: {
        reporterId: faculty,
        title: t.title,
        description: `Synthetic demo maintenance ticket (${t.status}).`,
        roomId: ctx.roomId,
        priority: t.priority,
        status: t.status,
        completedAt: t.status === 'RESOLVED' || t.status === 'CLOSED' ? new Date() : undefined,
      },
    });

    if (['ASSIGNED', 'IN_PROGRESS', 'RESOLVED', 'CLOSED'].includes(t.status)) {
      await prisma.maintenanceAssignment.create({
        data: { requestId: req.id, technicianId: maintUser },
      });
    }

    await prisma.maintenanceComment.create({
      data: {
        requestId: req.id,
        authorId: maintUser,
        content: `Demo comment for ${t.status} state.`,
      },
    });
  }
}

async function seedUtilityHistory(prisma: PrismaClient, _ctx: DemoContext): Promise<void> {
  const meter = await prisma.electricityMeter.findUnique({ where: { serialNumber: 'ELEC-DEMO-001' } });
  if (!meter) return;

  const count = await prisma.electricityReading.count({ where: { meterId: meter.id } });
  if (count >= 14) return;

  const now = Date.now();
  for (let i = 13; i >= 0; i -= 1) {
    const readingTime = new Date(now - i * 24 * 60 * 60 * 1000);
    const exists = await prisma.electricityReading.findFirst({
      where: { meterId: meter.id, readingTime },
    });
    if (exists) continue;
    await prisma.electricityReading.create({
      data: {
        meterId: meter.id,
        kwhConsumption: 80 + Math.random() * 60,
        readingTime,
      },
    });
  }

  const waterMeter = await prisma.waterMeter.findUnique({ where: { serialNumber: 'WTR-DEMO-001' } });
  if (!waterMeter) return;

  const waterCount = await prisma.waterReading.count({ where: { meterId: waterMeter.id } });
  if (waterCount >= 14) return;

  for (let i = 13; i >= 0; i -= 1) {
    const readingTime = new Date(now - i * 24 * 60 * 60 * 1000);
    await prisma.waterReading.create({
      data: {
        meterId: waterMeter.id,
        litersConsumption: 700 + Math.random() * 400,
        readingTime,
      },
    });
  }
}

async function seedParkingDemo(prisma: PrismaClient, ctx: DemoContext): Promise<void> {
  const area = await prisma.parkingArea.findFirst({ where: { name: 'Main Lot A', buildingId: ctx.buildingId } });
  if (!area) return;

  await prisma.parkingSlot.updateMany({
    where: { areaId: area.id, slotNumber: 'A-02' },
    data: { status: 'OCCUPIED' },
  });
  await prisma.parkingSlot.updateMany({
    where: { areaId: area.id, slotNumber: 'A-03' },
    data: { status: 'UNDER_MAINTENANCE' },
  });

  const slot = await prisma.parkingSlot.findFirst({ where: { areaId: area.id, slotNumber: 'A-02' } });
  const studentId = ctx.userIds.get('student@campusverse.local');
  if (slot && studentId) {
    await prisma.parkingSlot.update({
      where: { id: slot.id },
      data: { status: 'OCCUPIED', reservedForId: studentId },
    });
  }
}

async function seedAnnouncements(prisma: PrismaClient, ctx: DemoContext): Promise<void> {
  const items = [
    {
      title: 'Demo Draft Announcement',
      status: AnnouncementStatus.DRAFT,
      audience: AnnouncementAudienceType.ALL,
    },
    {
      title: 'Demo Scheduled Announcement',
      status: AnnouncementStatus.SCHEDULED,
      audience: AnnouncementAudienceType.DEPARTMENT,
      dept: ctx.csDeptId,
      scheduledAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    },
    {
      title: 'Demo Department Notice',
      status: AnnouncementStatus.PUBLISHED,
      audience: AnnouncementAudienceType.DEPARTMENT,
      dept: ctx.csDeptId,
    },
  ];

  for (const item of items) {
    const existing = await prisma.announcement.findFirst({ where: { title: item.title } });
    if (existing) continue;
    await prisma.announcement.create({
      data: {
        title: item.title,
        content: `Synthetic demo announcement (${item.status}).`,
        authorId: ctx.authorId,
        category: AnnouncementCategory.GENERAL,
        priority: AnnouncementPriority.NORMAL,
        status: item.status,
        audienceType: item.audience,
        targetDepartmentId: item.dept ?? null,
        scheduledAt: item.scheduledAt ?? null,
        publishedAt: item.status === AnnouncementStatus.PUBLISHED ? new Date() : null,
      },
    });
  }
}

async function seedIoTDevices(prisma: PrismaClient, ctx: DemoContext): Promise<void> {
  await prisma.ioTDevice.upsert({
    where: { deviceId: 'demo-occupancy-101' },
    update: { status: IoTDeviceStatus.ONLINE, lastSeenAt: new Date() },
    create: {
      deviceId: 'demo-occupancy-101',
      name: 'Demo Occupancy Sensor — Room 101',
      type: IoTDeviceType.OCCUPANCY_SENSOR,
      buildingId: ctx.buildingId,
      roomId: ctx.roomId,
      status: IoTDeviceStatus.ONLINE,
      lastSeenAt: new Date(),
      metadata: { demo: true, note: 'Synthetic device — not connected to real hardware' },
    },
  });

  await prisma.ioTDevice.upsert({
    where: { deviceId: 'demo-energy-main' },
    update: { status: IoTDeviceStatus.ONLINE, lastSeenAt: new Date() },
    create: {
      deviceId: 'demo-energy-main',
      name: 'Demo Energy Monitor — Main Building',
      type: IoTDeviceType.ELECTRICITY_METER,
      buildingId: ctx.buildingId,
      status: IoTDeviceStatus.ONLINE,
      lastSeenAt: new Date(),
      metadata: { demo: true },
    },
  });
}

async function seedMongoExtras(ctx: DemoContext): Promise<void> {
  if (mongoose.connection.readyState !== 1) return;

  const userId = ctx.userIds.get('faculty@campusverse.local') ?? ctx.authorId;

  const unread = await Notification.findOne({ userId, title: 'Demo unread notification' });
  if (!unread) {
    await Notification.create({
      userId,
      type: 'SYSTEM',
      title: 'Demo unread notification',
      message: 'Unread sample for demo.',
      isRead: false,
      severity: 'INFO',
    });
  }

  const read = await Notification.findOne({ userId, title: 'Demo read notification' });
  if (!read) {
    await Notification.create({
      userId,
      type: 'MAINTENANCE',
      title: 'Demo read notification',
      message: 'Read sample for demo.',
      isRead: true,
      severity: 'INFO',
    });
  }

  const rec = await Recommendation.findOne({ title: 'Demo open recommendation' });
  if (!rec) {
    await Recommendation.create({
      type: 'UTILITY',
      title: 'Demo open recommendation',
      description: 'Review HVAC settings in Room 101 during peak hours.',
      severity: 'MEDIUM',
      status: 'OPEN',
      evidence: { sources: ['demo_seed'], rule: 'Synthetic recommendation for digital twin demo' },
      recommendedAction: 'Review HVAC schedule with facilities team.',
      affectedEntity: { type: 'room', id: ctx.roomId, label: 'Room 101' },
      dedupeKey: 'demo:utility:room-101',
    });
  }
}
