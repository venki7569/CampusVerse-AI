import { OperationalStatus } from '@prisma/client';
import type { DigitalTwinRepository } from './digital-twin.repository';
import type { MaintenanceRiskService } from './maintenance-risk.service';
import type { UtilityIntelligenceService } from './utility-intelligence.service';
import type { OccupancyIntelligenceService } from './occupancy-intelligence.service';
import type { CampusHealthScore, HealthDimension, RiskLevel } from './digital-twin.dto';

/**
 * Campus health formula (documented):
 * Each dimension scores 0–100. Overall score = arithmetic mean of available dimensions.
 * Each dimension uses an equal weight of 1 in the average (no hidden weighting).
 */
export class CampusHealthService {
  constructor(
    private readonly repo: DigitalTwinRepository,
    private readonly maintenanceRisk: MaintenanceRiskService,
    private readonly utilityIntel: UtilityIntelligenceService,
    private readonly occupancyIntel: OccupancyIntelligenceService,
  ) {}

  async calculate(): Promise<CampusHealthScore> {
    const [
      openMaintenance,
      totalMaintenance,
      buildingRatio,
      assetGroups,
      parking,
      occupancy,
      utilityAnomalies,
      maintenanceRisks,
    ] = await Promise.all([
      this.repo.countOpenMaintenance(),
      this.repo.countAllMaintenanceRequests(),
      this.repo.getActiveBuildingsRatio(),
      this.repo.getAssetStatusGroups(),
      this.repo.getParkingStats(),
      this.occupancyIntel.getCampusInsight(),
      this.utilityIntel.detectAnomalies(),
      this.maintenanceRisk.assessAll(),
    ]);

    const dimensions: HealthDimension[] = [];

    const maintenanceScore = totalMaintenance > 0
      ? Math.max(0, Math.round(100 - (openMaintenance / totalMaintenance) * 100))
      : 100;
    dimensions.push({
      key: 'maintenance',
      label: 'Maintenance',
      score: maintenanceScore,
      weight: 1,
      explanation: `${openMaintenance} open requests of ${totalMaintenance} total in system.`,
      evidence: {
        actual: openMaintenance,
        baseline: totalMaintenance,
        rule: '100 − (open/total × 100)',
        sources: ['MaintenanceRequest'],
      },
    });

    const totalAssets = assetGroups.reduce((a, g) => a + g._count._all, 0);
    const activeAssets = assetGroups.find((g) => g.operationalStatus === OperationalStatus.ACTIVE)?._count._all ?? 0;
    const assetScore = totalAssets > 0 ? Math.round((activeAssets / totalAssets) * 100) : 100;
    dimensions.push({
      key: 'assets',
      label: 'Assets',
      score: assetScore,
      weight: 1,
      explanation: `${activeAssets}/${totalAssets} assets are ACTIVE.`,
      evidence: { rule: 'active assets / total assets × 100', sources: ['Asset'] },
    });

    const buildingScore = buildingRatio.total > 0
      ? Math.round((buildingRatio.active / buildingRatio.total) * 100)
      : 100;
    dimensions.push({
      key: 'buildings',
      label: 'Building Health',
      score: buildingScore,
      weight: 1,
      explanation: `${buildingRatio.active}/${buildingRatio.total} buildings ACTIVE.`,
      evidence: { sources: ['Building'] },
    });

    const utilPenalty = Math.min(40, utilityAnomalies.filter((a) => a.severity === 'HIGH' || a.severity === 'CRITICAL').length * 10);
    const utilityScore = Math.max(0, 100 - utilPenalty);
    dimensions.push({
      key: 'utilities',
      label: 'Utilities',
      score: utilityScore,
      weight: 1,
      explanation: `${utilityAnomalies.length} anomalies detected; penalty ${utilPenalty} points for high-severity items.`,
      evidence: { actual: utilityAnomalies.length, rule: '100 − min(40, highSeverityCount × 10)', sources: ['ElectricityReading', 'WaterReading'] },
    });

    const occScore = occupancy.utilizationRate !== null
      ? Math.max(0, 100 - Math.abs(occupancy.utilizationRate - 70) * 1.5)
      : 50;
    dimensions.push({
      key: 'occupancy',
      label: 'Occupancy Utilization',
      score: Math.round(occScore),
      weight: 1,
      explanation: `Utilization ${occupancy.utilizationRate ?? 'N/A'}%; optimal target ~70%.`,
      evidence: { actual: occupancy.utilizationRate, rule: '100 − |utilization − 70| × 1.5', sources: ['Room'] },
    });

    const parkingScore = parking.total > 0 ? Math.round((parking.available / parking.total) * 100) : 100;
    dimensions.push({
      key: 'parking',
      label: 'Parking Availability',
      score: parkingScore,
      weight: 1,
      explanation: `${parking.available}/${parking.total} parking slots available.`,
      evidence: { sources: ['ParkingSlot'] },
    });

    const highRiskCount = maintenanceRisks.filter((r) => r.riskLevel === 'HIGH' || r.riskLevel === 'CRITICAL').length;
    const riskPenalty = Math.min(30, highRiskCount * 5);
    const assetRiskScore = Math.max(0, assetScore - riskPenalty);
    dimensions.push({
      key: 'maintenance_risk',
      label: 'Predictive Maintenance Risk',
      score: assetRiskScore,
      weight: 1,
      explanation: `${highRiskCount} assets at HIGH/CRITICAL maintenance risk.`,
      evidence: { actual: highRiskCount, rule: 'asset score − min(30, highRiskCount × 5)', sources: ['Asset', 'MaintenanceHistory'] },
    });

    const overallScore = Math.round(
      dimensions.reduce((sum, d) => sum + d.score, 0) / dimensions.length,
    );

    const healthLevel: RiskLevel =
      overallScore >= 85 ? 'LOW' : overallScore >= 70 ? 'MEDIUM' : overallScore >= 50 ? 'HIGH' : 'CRITICAL';

    const topRisks = [
      ...maintenanceRisks.slice(0, 3).map((r) => `${r.assetTag}: ${r.riskFactors[0] ?? 'elevated risk'}`),
      ...utilityAnomalies.slice(0, 2).map((a) => `${a.entityLabel}: ${a.metric} anomaly`),
    ].slice(0, 5);

    const recommendedActions = [
      ...maintenanceRisks.slice(0, 2).map((r) => r.recommendedAction),
      ...utilityAnomalies.slice(0, 1).map((a) => a.recommendedAction),
    ].slice(0, 5);

    return {
      overallScore,
      healthLevel,
      formula: 'overallScore = mean(dimension scores); each dimension weight = 1; no hidden weighting',
      dimensions,
      topRisks,
      recommendedActions,
      calculatedAt: new Date().toISOString(),
    };
  }
}
