import { config } from '../../config/env';
import { cacheService } from '../../services/cache.service';
import { AppError } from '../../utils/AppError';
import type { DigitalTwinRepository } from './digital-twin.repository';
import type { MaintenanceRiskService } from './maintenance-risk.service';
import type { UtilityIntelligenceService } from './utility-intelligence.service';
import type { OccupancyIntelligenceService } from './occupancy-intelligence.service';
import type { CampusHealthService } from './campus-health.service';
import type { RecommendationRepository } from './recommendation.repository';
import type { DigitalTwinOverview } from './digital-twin.dto';
import { digitalTwinEvents } from './digital-twin.events';
import type { DigitalTwinAuditService } from './digital-twin.audit.service';

export class DigitalTwinService {
  constructor(
    private readonly repo: DigitalTwinRepository,
    private readonly maintenanceRisk: MaintenanceRiskService,
    private readonly utilityIntel: UtilityIntelligenceService,
    private readonly occupancyIntel: OccupancyIntelligenceService,
    private readonly campusHealth: CampusHealthService,
    private readonly recommendationRepo: RecommendationRepository,
    private readonly audit: DigitalTwinAuditService,
  ) {}

  async getOverview(actorId?: string): Promise<DigitalTwinOverview> {
    return cacheService.getOrSet(
      'digital-twin:overview',
      async () => {
        const overview = await this.buildOverview();
        digitalTwinEvents.emit('digitalTwin.updated', {
          timestamp: new Date().toISOString(),
          actorId,
        });
        return overview;
      },
      { ttlSeconds: config.cache.digitalTwinTtlSeconds, prefix: 'cv' },
    );
  }

  private async buildOverview(): Promise<DigitalTwinOverview> {
    const [
      buildings,
      floors,
      rooms,
      assets,
      openMaintenance,
      buildingSummaries,
      health,
      occupancy,
      maintenanceRisks,
      utilityAnomalies,
      recCounts,
      iotSummary,
    ] = await Promise.all([
      this.repo.countBuildings(),
      this.repo.countFloors(),
      this.repo.countRooms(),
      this.repo.countAssets(),
      this.repo.countOpenMaintenance(),
      this.repo.listBuildingsSummary(),
      this.campusHealth.calculate(),
      this.occupancyIntel.getCampusInsight(),
      this.maintenanceRisk.assessAll(),
      this.utilityIntel.detectAnomalies(),
      this.recommendationRepo.countOpenBySeverity(),
      this.repo.getIoTSummary(),
    ]);

    return {
      summary: {
        buildings,
        floors,
        rooms,
        assets,
        openMaintenance,
        openRecommendations: recCounts.total,
      },
      health,
      occupancy,
      maintenanceRisks: {
        highRiskCount: maintenanceRisks.filter((r) => r.riskLevel === 'HIGH' || r.riskLevel === 'CRITICAL').length,
        topRisks: maintenanceRisks.slice(0, 10),
      },
      utilityAnomalies: {
        count: utilityAnomalies.length,
        anomalies: utilityAnomalies.slice(0, 10),
      },
      buildings: buildingSummaries,
      alerts: {
        criticalRecommendations: recCounts.critical,
        highRecommendations: recCounts.high,
      },
      iot: {
        totalDevices: iotSummary.total,
        online: iotSummary.online,
        offline: iotSummary.offline,
        stale: iotSummary.stale,
        maintenance: iotSummary.maintenance,
        activeAlerts: iotSummary.offline + iotSummary.stale,
      },
      lastUpdated: new Date().toISOString(),
    };
  }

  async getBuildingTwin(buildingId: string) {
    const building = await this.repo.getBuildingDetail(buildingId);
    if (!building) throw AppError.notFound('Building not found');

    const [occupancy, risks, anomalies] = await Promise.all([
      this.occupancyIntel.getBuildingInsight(buildingId),
      this.maintenanceRisk.assessAll(),
      this.utilityIntel.detectAnomalies(),
    ]);

    const buildingRisks = risks.filter((r) => r.evidence.sources?.includes('Asset'));
    const buildingAnomalies = anomalies.filter((a) => a.entityId === buildingId);

    return {
      building: {
        id: building.id,
        code: building.code,
        name: building.name,
        location: building.location,
        operationalStatus: building.operationalStatus,
      },
      floors: building.floors.map((f) => ({
        id: f.id,
        level: f.level,
        roomCount: f.rooms.length,
        rooms: f.rooms.map((r) => ({
          id: r.id,
          roomNumber: r.roomNumber,
          roomType: r.roomType,
          occupancyStatus: r.occupancyStatus,
          capacity: r.capacity,
          assetCount: r.assets.length,
        })),
      })),
      utilities: {
        electricityMeters: building.electricityMeters.length,
        waterMeters: building.waterMeters.length,
      },
      parking: building.parkingAreas.map((a) => ({
        id: a.id,
        name: a.name,
        totalSlots: a.slots.length,
        available: a.slots.filter((s) => s.status === 'AVAILABLE').length,
      })),
      occupancy,
      maintenanceRisks: buildingRisks.slice(0, 10),
      utilityAnomalies: buildingAnomalies,
      assetCount: building.assets.length,
    };
  }

  async getRoomTwin(roomId: string) {
    const room = await this.repo.getRoomDetail(roomId);
    if (!room) throw AppError.notFound('Room not found');

    const auditEvents = await this.repo.getOccupancyAuditEvents(roomId, 30);
    const hasHistory = auditEvents.length > 0;

    return {
      room: {
        id: room.id,
        roomNumber: room.roomNumber,
        roomType: room.roomType,
        occupancyStatus: room.occupancyStatus,
        capacity: room.capacity,
        operationalStatus: room.operationalStatus,
      },
      building: room.floor.building,
      department: room.department,
      assets: room.assets,
      maintenanceRequests: room.maintenanceRequests,
      occupancyHistory: hasHistory
        ? auditEvents.map((e) => ({
            timestamp: e.createdAt,
            action: e.action,
            metadata: e.metadata,
          }))
        : [],
      historicalData: hasHistory ? 'available' : 'insufficient_data',
    };
  }

  async getAssetTwin(assetId: string) {
    const asset = await this.repo.getAssetDetail(assetId);
    if (!asset) throw AppError.notFound('Asset not found');

    const risk = await this.maintenanceRisk.assessAssetById(assetId);

    return {
      asset,
      maintenanceRisk: risk,
    };
  }

  async logView(actorId: string, section: string, entityId?: string): Promise<void> {
    await this.audit.logEvent({
      actorId,
      action: 'digitalTwinViewed',
      metadata: { section, entityId },
    });
  }
}
