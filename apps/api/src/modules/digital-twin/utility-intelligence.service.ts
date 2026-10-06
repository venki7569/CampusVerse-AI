import { config } from '../../config/env';
import type { DigitalTwinRepository } from './digital-twin.repository';
import type { UtilityAnomaly, RiskLevel, EvidenceBlock } from './digital-twin.dto';

function deviationSeverity(ratio: number): RiskLevel {
  if (ratio >= 3) return 'CRITICAL';
  if (ratio >= 2) return 'HIGH';
  if (ratio >= 1.5) return 'MEDIUM';
  return 'LOW';
}

function avg(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

export class UtilityIntelligenceService {
  constructor(private readonly repo: DigitalTwinRepository) {}

  async detectAnomalies(): Promise<UtilityAnomaly[]> {
    const threshold = config.intelligence.utilityAnomalyThreshold;
    const [electricity, water] = await Promise.all([
      this.detectElectricityAnomalies(threshold),
      this.detectWaterAnomalies(threshold),
    ]);
    return [...electricity, ...water].sort((a, b) => b.deviation - a.deviation);
  }

  private async detectElectricityAnomalies(threshold: number): Promise<UtilityAnomaly[]> {
    const readings = await this.repo.getElectricityReadings(97);
    if (readings.length < 8) {
      return [];
    }

    const recentCutoff = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const byBuilding = new Map<string, { label: string; recent: number[]; baseline: number[] }>();

    for (const r of readings) {
      const buildingId = r.meter.building?.id ?? 'campus';
      const label = r.meter.building?.name ?? r.meter.serialNumber;
      const bucket = byBuilding.get(buildingId) ?? { label, recent: [], baseline: [] };
      if (r.readingTime >= recentCutoff) bucket.recent.push(r.kwhConsumption);
      else bucket.baseline.push(r.kwhConsumption);
      byBuilding.set(buildingId, bucket);
    }

    const anomalies: UtilityAnomaly[] = [];
    for (const [entityId, data] of byBuilding) {
      if (data.baseline.length < 5 || data.recent.length < 2) continue;
      const baseline = avg(data.baseline);
      const actual = avg(data.recent);
      if (baseline <= 0) continue;
      const ratio = actual / baseline;
      if (ratio < threshold) continue;

      const severity = deviationSeverity(ratio);
      const evidence: EvidenceBlock = {
        dataWindow: 'Recent 7 days vs prior 90-day baseline',
        baseline: Math.round(baseline * 100) / 100,
        actual: Math.round(actual * 100) / 100,
        threshold,
        rule: `Flag when recent average > baseline × ${threshold}`,
        confidence: data.baseline.length >= 10 ? 'HIGH' : 'MEDIUM',
        sources: ['ElectricityReading', 'ElectricityMeter'],
        limitations: [],
      };

      anomalies.push({
        metric: 'electricity',
        entityType: entityId === 'campus' ? 'campus' : 'building',
        entityId,
        entityLabel: data.label,
        baseline,
        actual,
        deviation: Math.round((ratio - 1) * 1000) / 10,
        severity,
        explanation: `Electricity consumption was ${ratio.toFixed(1)}× the prior 90-day average (${actual.toFixed(1)} vs ${baseline.toFixed(1)} kWh avg).`,
        recommendedAction: 'Review building load, HVAC schedules, and recent equipment changes.',
        evidence,
      });
    }
    return anomalies;
  }

  private async detectWaterAnomalies(threshold: number): Promise<UtilityAnomaly[]> {
    const readings = await this.repo.getWaterReadings(97);
    if (readings.length < 8) return [];

    const recentCutoff = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const byBuilding = new Map<string, { label: string; recent: number[]; baseline: number[] }>();

    for (const r of readings) {
      const buildingId = r.meter.building?.id ?? 'campus';
      const label = r.meter.building?.name ?? r.meter.serialNumber;
      const bucket = byBuilding.get(buildingId) ?? { label, recent: [], baseline: [] };
      if (r.readingTime >= recentCutoff) bucket.recent.push(r.litersConsumption);
      else bucket.baseline.push(r.litersConsumption);
      byBuilding.set(buildingId, bucket);
    }

    const anomalies: UtilityAnomaly[] = [];
    for (const [entityId, data] of byBuilding) {
      if (data.baseline.length < 5 || data.recent.length < 2) continue;
      const baseline = avg(data.baseline);
      const actual = avg(data.recent);
      if (baseline <= 0) continue;
      const ratio = actual / baseline;
      if (ratio < threshold) continue;

      const severity = deviationSeverity(ratio);
      const evidence: EvidenceBlock = {
        dataWindow: 'Recent 7 days vs prior 90-day baseline',
        baseline: Math.round(baseline),
        actual: Math.round(actual),
        threshold,
        rule: `Flag sustained increase when recent average > baseline × ${threshold}`,
        confidence: data.baseline.length >= 10 ? 'HIGH' : 'MEDIUM',
        sources: ['WaterReading', 'WaterMeter'],
        limitations: ['Pattern may indicate abnormal consumption; physical leak not confirmed without inspection'],
      };

      anomalies.push({
        metric: 'water',
        entityType: entityId === 'campus' ? 'campus' : 'building',
        entityId,
        entityLabel: data.label,
        baseline,
        actual,
        deviation: Math.round((ratio - 1) * 1000) / 10,
        severity,
        explanation: `Possible abnormal water consumption pattern: ${ratio.toFixed(1)}× the prior 90-day average (${Math.round(actual)} vs ${Math.round(baseline)} L avg).`,
        recommendedAction: 'Inspect meters and plumbing for possible leak or abnormal usage pattern.',
        evidence,
      });
    }
    return anomalies;
  }
}
