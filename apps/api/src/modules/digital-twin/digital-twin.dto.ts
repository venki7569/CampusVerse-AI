import { z } from 'zod';

export const riskLevelSchema = z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']);
export type RiskLevel = z.infer<typeof riskLevelSchema>;

export const recommendationTypeSchema = z.enum([
  'MAINTENANCE',
  'UTILITY',
  'OCCUPANCY',
  'ASSET',
  'PARKING',
  'BUILDING',
  'CAMPUS',
]);

export const recommendationStatusSchema = z.enum(['OPEN', 'ACKNOWLEDGED', 'DISMISSED', 'RESOLVED']);

export const listRecommendationsSchema = z.object({
  query: z.object({
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(20),
    type: recommendationTypeSchema.optional(),
    severity: riskLevelSchema.optional(),
    status: recommendationStatusSchema.optional(),
    entityType: z.string().optional(),
    entityId: z.string().uuid().optional(),
    search: z.string().max(200).optional(),
  }),
});

export const recommendationIdParamSchema = z.object({
  params: z.object({
    id: z.string().min(1),
  }),
});

export const digitalTwinIdParamSchema = z.object({
  params: z.object({
    id: z.string().uuid(),
  }),
});

export interface EvidenceBlock {
  dataWindow?: string;
  baseline?: number | string | null;
  actual?: number | string | null;
  threshold?: number | string | null;
  rule?: string;
  factors?: string[];
  confidence?: 'LOW' | 'MEDIUM' | 'HIGH';
  limitations?: string[];
  sources?: string[];
}

export interface MaintenanceRiskAssessment {
  assetId: string;
  assetTag: string;
  assetName: string;
  maintenanceRiskScore: number;
  riskLevel: RiskLevel;
  riskFactors: string[];
  recommendedAction: string;
  confidence: 'LOW' | 'MEDIUM' | 'HIGH';
  explanation: string;
  evidence: EvidenceBlock;
}

export interface UtilityAnomaly {
  metric: 'electricity' | 'water';
  entityType: 'building' | 'meter' | 'campus';
  entityId: string;
  entityLabel: string;
  baseline: number;
  actual: number;
  deviation: number;
  severity: RiskLevel;
  explanation: string;
  recommendedAction: string;
  evidence: EvidenceBlock;
}

export interface OccupancyInsight {
  scope: 'campus' | 'building' | 'floor' | 'room';
  entityId?: string;
  entityLabel?: string;
  utilizationRate: number | null;
  occupied: number;
  total: number;
  underutilizedRooms: Array<{ roomId: string; roomNumber: string; utilizationHint: string }>;
  heavilyUtilizedRooms: Array<{ roomId: string; roomNumber: string; status: string }>;
  peakPeriods?: Array<{ period: string; occupiedCount: number }>;
  trend?: 'increasing' | 'decreasing' | 'stable' | 'insufficient_data';
  explanation: string;
  evidence: EvidenceBlock;
}

export interface HealthDimension {
  key: string;
  label: string;
  score: number;
  weight: number;
  explanation: string;
  evidence: EvidenceBlock;
}

export interface CampusHealthScore {
  overallScore: number;
  healthLevel: RiskLevel;
  formula: string;
  dimensions: HealthDimension[];
  topRisks: string[];
  recommendedActions: string[];
  calculatedAt: string;
}

export interface DigitalTwinOverview {
  summary: {
    buildings: number;
    floors: number;
    rooms: number;
    assets: number;
    openMaintenance: number;
    openRecommendations: number;
  };
  health: CampusHealthScore;
  occupancy: OccupancyInsight;
  maintenanceRisks: {
    highRiskCount: number;
    topRisks: MaintenanceRiskAssessment[];
  };
  utilityAnomalies: {
    count: number;
    anomalies: UtilityAnomaly[];
  };
  buildings: Array<{
    id: string;
    code: string;
    name: string;
    operationalStatus: string;
    floorCount: number;
    roomCount: number;
    occupancyRate: number | null;
    healthScore: number | null;
  }>;
  alerts: {
    criticalRecommendations: number;
    highRecommendations: number;
  };
  iot: {
    totalDevices: number;
    online: number;
    offline: number;
    stale: number;
    maintenance: number;
    activeAlerts: number;
  };
  lastUpdated: string;
}

export interface RecommendationDto {
  id: string;
  type: string;
  severity: string;
  status: string;
  title: string;
  description: string;
  evidence: EvidenceBlock;
  recommendedAction: string;
  affectedEntity: { type: string; id: string; label: string };
  createdAt: string;
  updatedAt: string;
}

export type ListRecommendationsQuery = z.infer<typeof listRecommendationsSchema>['query'];
