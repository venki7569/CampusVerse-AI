import { Prisma, PrismaClient, IoTDevice } from '@prisma/client';
import type { CreateDeviceDto, ListDevicesQuery, UpdateDeviceDto } from './iot.dto';

export class IoTRepository {
  constructor(private readonly db: PrismaClient) {}

  async findAll(query: ListDevicesQuery) {
    const { page, limit, sortBy, sortOrder, type, status, buildingId, roomId, isActive } = query;
    const where: Prisma.IoTDeviceWhereInput = {
      ...(type ? { type } : {}),
      ...(status ? { status } : {}),
      ...(buildingId ? { buildingId } : {}),
      ...(roomId ? { roomId } : {}),
      ...(isActive !== undefined ? { isActive } : {}),
    };
    const skip = (page - 1) * limit;
    const orderBy = { [sortBy ?? 'createdAt']: sortOrder ?? 'desc' } as Prisma.IoTDeviceOrderByWithRelationInput;

    const [data, total] = await Promise.all([
      this.db.ioTDevice.findMany({
        where,
        skip,
        take: limit,
        orderBy,
        include: {
          building: { select: { id: true, name: true, code: true } },
          room: { select: { id: true, roomNumber: true } },
          asset: { select: { id: true, assetTag: true, name: true } },
          electricityMeter: { select: { id: true, serialNumber: true } },
          waterMeter: { select: { id: true, serialNumber: true } },
        },
      }),
      this.db.ioTDevice.count({ where }),
    ]);
    return { data, total, page, limit };
  }

  async findById(id: string) {
    return this.db.ioTDevice.findUnique({
      where: { id },
      include: {
        building: { select: { id: true, name: true, code: true } },
        floor: { select: { id: true, level: true } },
        room: { select: { id: true, roomNumber: true, capacity: true } },
        asset: { select: { id: true, assetTag: true, name: true } },
        electricityMeter: true,
        waterMeter: true,
      },
    });
  }

  async findByDeviceId(deviceId: string) {
    return this.db.ioTDevice.findUnique({
      where: { deviceId },
      include: {
        building: true,
        room: true,
        electricityMeter: true,
        waterMeter: true,
      },
    });
  }

  async create(dto: CreateDeviceDto, ingestKeyHash?: string): Promise<IoTDevice> {
    return this.db.ioTDevice.create({
      data: {
        deviceId: dto.deviceId,
        name: dto.name,
        type: dto.type,
        manufacturer: dto.manufacturer,
        model: dto.model,
        serialNumber: dto.serialNumber,
        buildingId: dto.buildingId ?? undefined,
        floorId: dto.floorId ?? undefined,
        roomId: dto.roomId ?? undefined,
        assetId: dto.assetId ?? undefined,
        electricityMeterId: dto.electricityMeterId ?? undefined,
        waterMeterId: dto.waterMeterId ?? undefined,
        metadata: dto.metadata as Prisma.InputJsonValue | undefined,
        ingestKeyHash,
      },
    });
  }

  async update(id: string, dto: UpdateDeviceDto): Promise<IoTDevice> {
    return this.db.ioTDevice.update({
      where: { id },
      data: {
        ...(dto.name !== undefined ? { name: dto.name } : {}),
        ...(dto.manufacturer !== undefined ? { manufacturer: dto.manufacturer } : {}),
        ...(dto.model !== undefined ? { model: dto.model } : {}),
        ...(dto.serialNumber !== undefined ? { serialNumber: dto.serialNumber } : {}),
        ...(dto.buildingId !== undefined ? { buildingId: dto.buildingId } : {}),
        ...(dto.floorId !== undefined ? { floorId: dto.floorId } : {}),
        ...(dto.roomId !== undefined ? { roomId: dto.roomId } : {}),
        ...(dto.assetId !== undefined ? { assetId: dto.assetId } : {}),
        ...(dto.status !== undefined ? { status: dto.status } : {}),
        ...(dto.metadata !== undefined ? { metadata: dto.metadata as Prisma.InputJsonValue } : {}),
        ...(dto.isActive !== undefined ? { isActive: dto.isActive } : {}),
      },
    });
  }

  async archive(id: string): Promise<IoTDevice> {
    return this.db.ioTDevice.update({
      where: { id },
      data: { isActive: false, status: 'ARCHIVED' },
    });
  }

  async updateLastSeen(id: string, status: IoTDevice['status'], lastSeenAt: Date) {
    return this.db.ioTDevice.update({
      where: { id },
      data: { lastSeenAt, status },
    });
  }

  async countByStatus() {
    const groups = await this.db.ioTDevice.groupBy({
      by: ['status'],
      where: { isActive: true },
      _count: { _all: true },
    });
    return groups;
  }

  async countActive() {
    return this.db.ioTDevice.count({ where: { isActive: true } });
  }

  async findStaleDevices(threshold: Date) {
    return this.db.ioTDevice.findMany({
      where: {
        isActive: true,
        status: { not: 'ARCHIVED' },
        OR: [{ lastSeenAt: null }, { lastSeenAt: { lt: threshold } }],
      },
      take: 100,
    });
  }
}
