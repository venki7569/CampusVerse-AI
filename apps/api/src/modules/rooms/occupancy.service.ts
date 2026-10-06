import { PrismaClient, RoomOccupancyStatus } from '@prisma/client';
import { RoomRepository } from './room.repository';
import { createLogger } from '../../utils/logger';

const log = createLogger('OccupancySimulation');

const SIMULATED_STATUSES: RoomOccupancyStatus[] = [
  RoomOccupancyStatus.AVAILABLE,
  RoomOccupancyStatus.OCCUPIED,
  RoomOccupancyStatus.RESERVED,
];

/**
 * Development/demo occupancy simulator.
 * Never started unless OCCUPANCY_SIMULATION_ENABLED=true and NODE_ENV !== production.
 */
export class OccupancySimulationService {
  private repo: RoomRepository;
  private intervalId: NodeJS.Timeout | null = null;

  constructor(db: PrismaClient) {
    this.repo = new RoomRepository(db);
  }

  start(intervalMs: number = 30000) {
    if (this.intervalId) return;
    log.warn('Starting occupancy simulation', { intervalMs });
    this.intervalId = setInterval(() => {
      void this.tick();
    }, intervalMs);
  }

  stop() {
    if (this.intervalId) clearInterval(this.intervalId);
    this.intervalId = null;
  }

  private async tick(): Promise<void> {
    try {
      const result = await this.repo.findAll({ page: 1, limit: 100, sortOrder: 'asc' });
      for (const room of result.data) {
        if (room.occupancyStatus === RoomOccupancyStatus.UNDER_MAINTENANCE) {
          continue;
        }
        const randomStatus =
          SIMULATED_STATUSES[Math.floor(Math.random() * SIMULATED_STATUSES.length)];
        if (randomStatus) {
          await this.repo.updateOccupancy(room.id, randomStatus);
        }
      }
    } catch (err) {
      log.warn('Occupancy simulation tick failed', { err });
    }
  }
}
