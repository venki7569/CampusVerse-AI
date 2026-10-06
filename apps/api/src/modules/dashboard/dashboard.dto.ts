import { z } from 'zod';

const optionalDate = z
  .string()
  .optional()
  .transform((val) => (val ? new Date(val) : undefined))
  .refine((val) => val === undefined || !Number.isNaN(val.getTime()), {
    message: 'Invalid date',
  });

export const dashboardOverviewQuerySchema = z.object({
  query: z.object({
    from: optionalDate,
    to: optionalDate,
    buildingId: z.string().uuid().optional(),
    departmentId: z.string().uuid().optional(),
    floorId: z.string().uuid().optional(),
  }),
});

export type DashboardOverviewQuery = z.infer<typeof dashboardOverviewQuerySchema>['query'];

export type OccupancyBucket = {
  total: number;
  occupied: number;
  available: number;
  reserved: number;
  underMaintenance: number;
};

export type BuildingOccupancyRow = OccupancyBucket & {
  buildingId: string;
  code: string;
  name: string;
  occupancyRate: number | null;
};

export type UtilitySeriesPoint = {
  period: string;
  consumption: number;
};

export type UtilityBuildingPoint = {
  id: string;
  label: string;
  consumption: number;
};

export type UtilityEnergyBlock = {
  available: boolean;
  unit: 'kWh';
  latest: number | null;
  daily: number | null;
  weekly: number | null;
  monthly: number | null;
  trend: UtilitySeriesPoint[];
  byBuilding: UtilityBuildingPoint[];
};

export type UtilityWaterBlock = {
  available: boolean;
  unit: 'L';
  daily: number | null;
  weekly: number | null;
  monthly: number | null;
  trend: UtilitySeriesPoint[];
  byBuilding: UtilityBuildingPoint[];
};

export type MaintenancePriorityItem = {
  id: string;
  title: string;
  priority: string;
  status: string;
  createdAt: string;
  roomNumber: string | null;
  buildingName: string | null;
};

export type AssetDistributionItem = {
  status: string;
  count: number;
  percent: number | null;
};

export type RecentActivityItem = {
  id: string;
  module: string;
  action: string;
  message: string;
  timestamp: string;
  severity: 'INFO' | 'WARNING' | 'CRITICAL';
  entityId?: string;
};

export type DashboardAlertItem = {
  id: string;
  title: string;
  message: string;
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  timestamp: string;
  link?: string;
};

export type DashboardOverview = {
  kpis: {
    buildings: number;
    departments: number;
    rooms: number;
    classrooms: number;
    laboratories: number;
    assets: number;
    openMaintenance: number;
    occupiedRooms: number;
    availableRooms: number;
    occupancyRate: number | null;
    parkingAreas: number;
    parkingSlots: number;
    parkingAvailable: number;
    parkingUtilization: number | null;
  };
  occupancy: OccupancyBucket & {
    occupancyRate: number | null;
    hasData: boolean;
  };
  parking: {
    areas: number;
    activeAreas: number;
    totalSlots: number;
    available: number;
    occupied: number;
    reserved: number;
    underMaintenance: number;
    utilizationPercent: number | null;
  };
  buildingOccupancy: BuildingOccupancyRow[];
  energy: {
    electricity: UtilityEnergyBlock;
    water: UtilityWaterBlock;
  };
  maintenance: {
    total: number;
    reported: number;
    assigned: number;
    inProgress: number;
    resolved: number;
    closed: number;
    cancelled: number;
    rejected: number;
    open: number;
    critical: number;
    averageResolutionHours: number | null;
    highPriorityOpen: MaintenancePriorityItem[];
  };
  assets: {
    total: number;
    active: number;
    inactive: number;
    underMaintenance: number;
    damaged: number;
    retired: number;
    distribution: AssetDistributionItem[];
  };
  buildingPerformance: Array<{
    buildingId: string;
    code: string;
    name: string;
    rooms: number;
    occupancyRate: number | null;
    electricity: number | null;
    water: number | null;
  }>;
  recentActivity: RecentActivityItem[];
  alerts: {
    criticalMaintenance: MaintenancePriorityItem[];
    energyAnomalies: DashboardAlertItem[];
    waterAnomalies: DashboardAlertItem[];
  };
  announcements?: {
    unreadCount: number;
    urgentCount: number;
    latest: Array<{
      id: string;
      title: string;
      category: string;
      priority: string;
      publishedAt: string | null;
      isRead?: boolean;
    }>;
  };
  filtersApplied: {
    from?: string;
    to?: string;
    buildingId?: string;
    departmentId?: string;
    floorId?: string;
  };
};
