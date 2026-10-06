import { createPrismaClient, disconnectPrismaClient } from '../../database/prisma.client';
import {
  RoleName,
  AnnouncementStatus,
  AnnouncementPriority,
  AnnouncementCategory,
  AnnouncementAudienceType,
  MaintenancePriority,
  MaintenanceStatus,
} from '@prisma/client';
import bcrypt from 'bcryptjs';
import mongoose from 'mongoose';
import {
  DEFAULT_ROLE_PERMISSIONS,
  PERMISSION_CATALOG,
  SYSTEM_ROLE_NAMES,
  toPermissionCode,
} from '../../modules/admin/admin.permissions';
import { Notification } from '../../modules/database/mongodb/schemas/notification.schema';
import { seedExtendedDemoData } from './seed-demo-data';

const prisma = createPrismaClient();

const DEMO_PASSWORD_ENV = 'SEED_DEMO_PASSWORD';

interface DemoUserSpec {
  email: string;
  firstName: string;
  lastName: string;
  role: RoleName;
  departmentCode?: string;
}

const DEMO_USERS: DemoUserSpec[] = [
  { email: 'campus.admin@campusverse.local', firstName: 'Campus', lastName: 'Admin', role: 'CAMPUS_ADMIN' },
  { email: 'dept.admin@campusverse.local', firstName: 'Dept', lastName: 'Admin', role: 'DEPARTMENT_ADMIN', departmentCode: 'CS' },
  { email: 'faculty@campusverse.local', firstName: 'Alex', lastName: 'Faculty', role: 'FACULTY', departmentCode: 'CS' },
  { email: 'maintenance@campusverse.local', firstName: 'Mike', lastName: 'Maint', role: 'MAINTENANCE_STAFF' },
  { email: 'security@campusverse.local', firstName: 'Sam', lastName: 'Security', role: 'SECURITY_STAFF' },
  { email: 'student@campusverse.local', firstName: 'Jamie', lastName: 'Student', role: 'STUDENT', departmentCode: 'CS' },
];

async function seedRoles(): Promise<Map<RoleName, string>> {
  const roleIds = new Map<RoleName, string>();
  for (const name of SYSTEM_ROLE_NAMES) {
    const role = await prisma.role.upsert({
      where: { name },
      update: { description: `${name.replace(/_/g, ' ')} system role` },
      create: { name, description: `${name.replace(/_/g, ' ')} system role` },
    });
    roleIds.set(name, role.id);
  }
  return roleIds;
}

async function seedPermissions(): Promise<Map<string, string>> {
  const permissionIds = new Map<string, string>();
  for (const entry of PERMISSION_CATALOG) {
    const permission = await prisma.permission.upsert({
      where: { action_resource: { action: entry.action, resource: entry.resource } },
      update: { description: entry.description },
      create: {
        action: entry.action,
        resource: entry.resource,
        description: entry.description,
      },
    });
    permissionIds.set(toPermissionCode(entry.resource, entry.action), permission.id);
  }
  return permissionIds;
}

async function seedRolePermissions(
  roleIds: Map<RoleName, string>,
  permissionIds: Map<string, string>,
): Promise<void> {
  for (const [roleName, codes] of Object.entries(DEFAULT_ROLE_PERMISSIONS) as Array<
    [RoleName, string[]]
  >) {
    const roleId = roleIds.get(roleName);
    if (!roleId) continue;
    for (const code of codes) {
      const permissionId = permissionIds.get(code);
      if (!permissionId) continue;
      await prisma.rolePermission.upsert({
        where: { roleId_permissionId: { roleId, permissionId } },
        update: {},
        create: { roleId, permissionId },
      });
    }
  }
}

async function upsertDemoUser(
  spec: DemoUserSpec,
  passwordHash: string,
  roleIds: Map<RoleName, string>,
  departmentIds: Map<string, string>,
): Promise<string> {
  const email = spec.email.toLowerCase();
  const departmentId = spec.departmentCode ? departmentIds.get(spec.departmentCode) : undefined;
  const roleId = roleIds.get(spec.role);
  if (!roleId) throw new Error(`Role missing: ${spec.role}`);

  const existing = await prisma.user.findUnique({ where: { email } });
  const user = existing
    ? await prisma.user.update({
        where: { id: existing.id },
        data: {
          passwordHash,
          firstName: spec.firstName,
          lastName: spec.lastName,
          isActive: true,
          departmentId: departmentId ?? null,
        },
      })
    : await prisma.user.create({
        data: {
          email,
          passwordHash,
          firstName: spec.firstName,
          lastName: spec.lastName,
          isActive: true,
          departmentId,
        },
      });

  await prisma.userRole.deleteMany({ where: { userId: user.id } });
  await prisma.userRole.create({ data: { userId: user.id, roleId } });
  return user.id;
}

async function seedAdminUser(roleIds: Map<RoleName, string>): Promise<string | null> {
  const email = (process.env['SEED_ADMIN_EMAIL'] ?? 'admin@campusverse.local').toLowerCase();
  const password = process.env['SEED_ADMIN_PASSWORD'];
  const isProduction = process.env['NODE_ENV'] === 'production';

  if (!password) {
    if (isProduction) {
      console.log('Skipping admin user seed (SEED_ADMIN_PASSWORD not set in production).');
      return null;
    }
    console.log('Skipping admin user seed (set SEED_ADMIN_PASSWORD to create a development admin).');
    return null;
  }

  if (isProduction && password.length < 12) {
    throw new Error('SEED_ADMIN_PASSWORD must be at least 12 characters in production');
  }

  const superAdminRoleId = roleIds.get('SUPER_ADMIN');
  if (!superAdminRoleId) throw new Error('SUPER_ADMIN role missing');

  const passwordHash = await bcrypt.hash(password, 10);
  const userId = await upsertDemoUser(
    { email, firstName: 'Campus', lastName: 'Admin', role: 'SUPER_ADMIN' },
    passwordHash,
    roleIds,
    new Map(),
  );
  console.log(`Seed admin user ready: ${email}`);
  return userId;
}

async function seedDemoUsers(
  roleIds: Map<RoleName, string>,
  departmentIds: Map<string, string>,
): Promise<Map<string, string>> {
  const demoPassword = process.env[DEMO_PASSWORD_ENV];
  if (!demoPassword) {
    console.log(`Skipping demo users (set ${DEMO_PASSWORD_ENV} to create role-based demo accounts).`);
    return new Map();
  }

  const passwordHash = await bcrypt.hash(demoPassword, 10);
  const userIds = new Map<string, string>();
  for (const spec of DEMO_USERS) {
    const id = await upsertDemoUser(spec, passwordHash, roleIds, departmentIds);
    userIds.set(spec.email, id);
  }
  console.log(`Demo users seeded (${DEMO_USERS.length}) — demo-only credentials from env`);
  return userIds;
}

async function seedFacilities(): Promise<{
  departmentIds: Map<string, string>;
  buildingId: string;
  scienceBuildingId: string;
  floorId: string;
  roomId: string;
  labRoomId: string;
}> {
  const csDept = await prisma.department.upsert({
    where: { code: 'CS' },
    update: { name: 'Computer Science', headName: 'Dr. Alan Turing' },
    create: { code: 'CS', name: 'Computer Science', headName: 'Dr. Alan Turing' },
  });
  const eeDept = await prisma.department.upsert({
    where: { code: 'EE' },
    update: { name: 'Electrical Engineering' },
    create: { code: 'EE', name: 'Electrical Engineering', headName: 'Dr. Nikola Tesla' },
  });

  const mainBuilding = await prisma.building.upsert({
    where: { code: 'BLD-MAIN' },
    update: { name: 'Main Campus Building', location: 'Central Campus' },
    create: { code: 'BLD-MAIN', name: 'Main Campus Building', location: 'Central Campus' },
  });
  const scienceBuilding = await prisma.building.upsert({
    where: { code: 'BLD-SCI' },
    update: { name: 'Science Block' },
    create: { code: 'BLD-SCI', name: 'Science Block', location: 'North Campus' },
  });

  const floor1 = await prisma.floor.upsert({
    where: { level_buildingId: { level: '1', buildingId: mainBuilding.id } },
    update: {},
    create: { level: '1', buildingId: mainBuilding.id },
  });
  await prisma.floor.upsert({
    where: { level_buildingId: { level: '2', buildingId: mainBuilding.id } },
    update: {},
    create: { level: '2', buildingId: mainBuilding.id },
  });
  await prisma.floor.upsert({
    where: { level_buildingId: { level: '1', buildingId: scienceBuilding.id } },
    update: {},
    create: { level: '1', buildingId: scienceBuilding.id },
  });

  let room = await prisma.room.findFirst({ where: { roomNumber: '101', floorId: floor1.id } });
  if (!room) {
    room = await prisma.room.create({
      data: {
        roomNumber: '101',
        floorId: floor1.id,
        departmentId: csDept.id,
        capacity: 50,
        roomType: 'CLASSROOM',
      },
    });
  }

  const lab = await prisma.room.findFirst({ where: { roomNumber: 'LAB-201', floorId: floor1.id } });
  if (!lab) {
    await prisma.room.create({
      data: {
        roomNumber: 'LAB-201',
        floorId: floor1.id,
        departmentId: csDept.id,
        capacity: 30,
        roomType: 'LABORATORY',
      },
    });
  }
  const labRoom = (await prisma.room.findFirst({ where: { roomNumber: 'LAB-201', floorId: floor1.id } }))!;

  return {
    departmentIds: new Map([
      ['CS', csDept.id],
      ['EE', eeDept.id],
    ]),
    buildingId: mainBuilding.id,
    scienceBuildingId: scienceBuilding.id,
    floorId: floor1.id,
    roomId: room.id,
    labRoomId: labRoom.id,
  };
}

async function seedAssets(buildingId: string, roomId: string, departmentId: string, authorId: string): Promise<void> {
  const category = await prisma.assetCategory.upsert({
    where: { name: 'IT Equipment' },
    update: {},
    create: { name: 'IT Equipment', description: 'Computers, projectors, networking' },
  });
  const vendorExisting = await prisma.vendor.findFirst({ where: { name: 'Campus Supplies Co.' } });
  const vendor =
    vendorExisting ??
    (await prisma.vendor.create({
      data: {
        name: 'Campus Supplies Co.',
        email: 'orders@campussupplies.example',
      },
    }));

  await prisma.asset.upsert({
    where: { assetTag: 'AST-DEMO-001' },
    update: {},
    create: {
      assetTag: 'AST-DEMO-001',
      name: 'Demo Projector',
      categoryId: category.id,
      vendorId: vendor.id,
      buildingId,
      roomId,
      departmentId,
      condition: 'Good',
    },
  });

  const meter = await prisma.electricityMeter.upsert({
    where: { serialNumber: 'ELEC-DEMO-001' },
    update: {},
    create: { serialNumber: 'ELEC-DEMO-001', buildingId, departmentId, isActive: true },
  });
  const existingReading = await prisma.electricityReading.findFirst({ where: { meterId: meter.id } });
  if (!existingReading) {
    await prisma.electricityReading.create({
      data: { meterId: meter.id, kwhConsumption: 125.5, readingTime: new Date() },
    });
  }

  const waterMeter = await prisma.waterMeter.upsert({
    where: { serialNumber: 'WTR-DEMO-001' },
    update: {},
    create: { serialNumber: 'WTR-DEMO-001', buildingId, isActive: true },
  });
  const waterReading = await prisma.waterReading.findFirst({ where: { meterId: waterMeter.id } });
  if (!waterReading) {
    await prisma.waterReading.create({
      data: { meterId: waterMeter.id, litersConsumption: 980, readingTime: new Date() },
    });
  }

  const parkingArea = await prisma.parkingArea.findFirst({ where: { name: 'Main Lot A', buildingId } });
  const area =
    parkingArea ??
    (await prisma.parkingArea.create({
      data: { name: 'Main Lot A', buildingId, location: 'East side', totalSlots: 4, isActive: true },
    }));

  for (const slotNumber of ['A-01', 'A-02', 'A-03', 'A-04']) {
    await prisma.parkingSlot.upsert({
      where: { areaId_slotNumber: { areaId: area.id, slotNumber } },
      update: {},
      create: { areaId: area.id, slotNumber, slotType: 'STANDARD', status: 'AVAILABLE' },
    });
  }

  const existingMaintenance = await prisma.maintenanceRequest.findFirst({
    where: { title: 'Demo HVAC inspection' },
  });
  if (!existingMaintenance) {
    await prisma.maintenanceRequest.create({
      data: {
        reporterId: authorId,
        title: 'Demo HVAC inspection',
        description: 'Quarterly HVAC inspection for room 101',
        roomId,
        priority: MaintenancePriority.MEDIUM,
        status: MaintenanceStatus.REPORTED,
      },
    });
  }

  const existingAnnouncement = await prisma.announcement.findFirst({
    where: { title: 'Welcome to CampusVerse Demo' },
  });
  if (!existingAnnouncement) {
    await prisma.announcement.create({
      data: {
        title: 'Welcome to CampusVerse Demo',
        content: 'This is demo seed data for development and staging environments only.',
        authorId,
        category: AnnouncementCategory.GENERAL,
        priority: AnnouncementPriority.NORMAL,
        status: AnnouncementStatus.PUBLISHED,
        audienceType: AnnouncementAudienceType.ALL,
        publishedAt: new Date(),
      },
    });
  }
}

async function seedMongoNotifications(userIds: string[]): Promise<void> {
  if (mongoose.connection.readyState !== 1 || userIds.length === 0) return;

  for (const userId of userIds.slice(0, 3)) {
    const existing = await Notification.findOne({ userId, title: 'Demo campus notification' });
    if (existing) continue;
    await Notification.create({
      userId,
      type: 'SYSTEM',
      title: 'Demo campus notification',
      message: 'Sample notification from development seed.',
      isRead: false,
      severity: 'INFO',
    });
  }
}

async function main(): Promise<void> {
  console.log('Starting CampusVerse demo seed (idempotent)...');

  const roleIds = await seedRoles();
  const permissionIds = await seedPermissions();
  await seedRolePermissions(roleIds, permissionIds);

  const facilities = await seedFacilities();
  const adminId = await seedAdminUser(roleIds);
  const demoUserIds = await seedDemoUsers(roleIds, facilities.departmentIds);

  const authorId = adminId ?? demoUserIds.values().next().value;
  if (authorId) {
    await seedAssets(
      facilities.buildingId,
      facilities.roomId,
      facilities.departmentIds.get('CS')!,
      authorId,
    );
    await seedExtendedDemoData(prisma, {
      buildingId: facilities.buildingId,
      scienceBuildingId: facilities.scienceBuildingId,
      floorId: facilities.floorId,
      roomId: facilities.roomId,
      labRoomId: facilities.labRoomId,
      csDeptId: facilities.departmentIds.get('CS')!,
      eeDeptId: facilities.departmentIds.get('EE')!,
      userIds: demoUserIds,
      authorId,
    });
  }

  const mongoUri = process.env['MONGODB_URI'];
  if (mongoUri) {
    try {
      if (mongoose.connection.readyState !== 1) {
        await mongoose.connect(mongoUri);
      }
      await seedMongoNotifications([...(adminId ? [adminId] : []), ...demoUserIds.values()]);
    } catch (err) {
      console.warn('MongoDB seed skipped', err);
    }
  }

  console.log('Seed completed successfully!');
  console.log('Roles:', SYSTEM_ROLE_NAMES.join(', '));
  console.log('Permissions:', permissionIds.size);
  console.log('NOTE: Demo data is for development/staging only.');
  console.log('Demo credentials: set SEED_ADMIN_PASSWORD and SEED_DEMO_PASSWORD in env (see .env.example).');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await disconnectPrismaClient(prisma);
    if (mongoose.connection.readyState !== 0) {
      await mongoose.disconnect();
    }
  });
