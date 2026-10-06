import { RoomOccupancyStatus } from '@prisma/client';
import type { DigitalTwinRepository } from './digital-twin.repository';
import type { OccupancyInsight, EvidenceBlock } from './digital-twin.dto';

export class OccupancyIntelligenceService {
  constructor(private readonly repo: DigitalTwinRepository) {}

  async getCampusInsight(): Promise<OccupancyInsight> {
    const [groups, rooms] = await Promise.all([
      this.repo.groupRoomsByOccupancy(),
      this.repo.listRoomsWithBuilding(),
    ]);

    let occupied = 0;
    let available = 0;
    let reserved = 0;
    let underMaintenance = 0;
    for (const g of groups) {
      if (g.occupancyStatus === RoomOccupancyStatus.OCCUPIED) occupied = g._count._all;
      if (g.occupancyStatus === RoomOccupancyStatus.AVAILABLE) available = g._count._all;
      if (g.occupancyStatus === RoomOccupancyStatus.RESERVED) reserved = g._count._all;
      if (g.occupancyStatus === RoomOccupancyStatus.UNDER_MAINTENANCE) underMaintenance = g._count._all;
    }
    const total = occupied + available + reserved + underMaintenance;
    const utilizationRate = total > 0 ? Math.round((occupied / total) * 1000) / 10 : null;

    const underutilized = rooms
      .filter((r) => r.occupancyStatus === RoomOccupancyStatus.AVAILABLE && r.capacity > 0)
      .slice(0, 5)
      .map((r) => ({
        roomId: r.id,
        roomNumber: r.roomNumber,
        utilizationHint: 'Currently available — may be underutilized',
      }));

    const heavilyUtilized = rooms
      .filter(
        (r) =>
          r.occupancyStatus === RoomOccupancyStatus.OCCUPIED ||
          r.occupancyStatus === RoomOccupancyStatus.RESERVED,
      )
      .slice(0, 5)
      .map((r) => ({
        roomId: r.id,
        roomNumber: r.roomNumber,
        status: r.occupancyStatus,
      }));

    const buildingUtil = new Map<string, { name: string; occupied: number; total: number }>();
    for (const room of rooms) {
      const bid = room.floor.buildingId;
      const entry = buildingUtil.get(bid) ?? { name: room.floor.building.name, occupied: 0, total: 0 };
      entry.total += 1;
      if (
        room.occupancyStatus === RoomOccupancyStatus.OCCUPIED ||
        room.occupancyStatus === RoomOccupancyStatus.RESERVED
      ) {
        entry.occupied += 1;
      }
      buildingUtil.set(bid, entry);
    }

    const peakPeriods = [...buildingUtil.entries()]
      .map(([buildingId, v]) => ({
        period: v.name,
        occupiedCount: v.occupied,
        buildingId,
      }))
      .sort((a, b) => b.occupiedCount - a.occupiedCount)
      .slice(0, 5);

    const evidence: EvidenceBlock = {
      dataWindow: 'Current room occupancy snapshot',
      actual: utilizationRate,
      rule: 'Utilization = occupied rooms / total rooms × 100',
      sources: ['Room.occupancyStatus'],
      limitations: ['Historical occupancy trends require audit log history'],
    };

    return {
      scope: 'campus',
      utilizationRate,
      occupied,
      total,
      underutilizedRooms: underutilized,
      heavilyUtilizedRooms: heavilyUtilized,
      peakPeriods: peakPeriods.map((p) => ({ period: p.period, occupiedCount: p.occupiedCount })),
      trend: 'insufficient_data',
      explanation:
        total > 0
          ? `Campus utilization is ${utilizationRate}% (${occupied}/${total} rooms occupied or reserved).`
          : 'No rooms available for occupancy analysis.',
      evidence,
    };
  }

  async getBuildingInsight(buildingId: string): Promise<OccupancyInsight | null> {
    const groups = await this.repo.groupRoomsByOccupancy(buildingId);
    const rooms = (await this.repo.listRoomsWithBuilding()).filter((r) => r.floor.buildingId === buildingId);
    if (rooms.length === 0) return null;

    let occupied = 0;
    let total = 0;
    for (const g of groups) {
      total += g._count._all;
      if (
        g.occupancyStatus === RoomOccupancyStatus.OCCUPIED ||
        g.occupancyStatus === RoomOccupancyStatus.RESERVED
      ) {
        occupied += g._count._all;
      }
    }

    const utilizationRate = total > 0 ? Math.round((occupied / total) * 1000) / 10 : null;
    const buildingName = rooms[0]?.floor.building.name ?? 'Building';

    return {
      scope: 'building',
      entityId: buildingId,
      entityLabel: buildingName,
      utilizationRate,
      occupied,
      total,
      underutilizedRooms: rooms
        .filter((r) => r.occupancyStatus === RoomOccupancyStatus.AVAILABLE)
        .slice(0, 5)
        .map((r) => ({ roomId: r.id, roomNumber: r.roomNumber, utilizationHint: 'Available' })),
      heavilyUtilizedRooms: rooms
        .filter((r) => r.occupancyStatus === RoomOccupancyStatus.OCCUPIED)
        .slice(0, 5)
        .map((r) => ({ roomId: r.id, roomNumber: r.roomNumber, status: r.occupancyStatus })),
      trend: 'insufficient_data',
      explanation: `${buildingName} utilization: ${utilizationRate}% (${occupied}/${total} rooms).`,
      evidence: {
        dataWindow: 'Current snapshot',
        sources: ['Room.occupancyStatus'],
        limitations: ['Historical peak periods require occupancy audit history'],
      },
    };
  }
}
