import { z } from 'zod';
import { AppError } from '../../utils/AppError';
import { paginationSchema } from '../../utils/pagination';

export const ANALYTICS_DATE_PRESETS = [
  'today',
  'yesterday',
  'last7days',
  'last30days',
  'last90days',
  'currentMonth',
  'previousMonth',
  'custom',
] as const;

export type AnalyticsDatePreset = (typeof ANALYTICS_DATE_PRESETS)[number];

const optionalDate = z
  .string()
  .optional()
  .transform((val) => (val ? new Date(val) : undefined))
  .refine((val) => val === undefined || !Number.isNaN(val.getTime()), {
    message: 'Invalid date',
  });

export const analyticsBaseQuerySchema = z.object({
  query: z
    .object({
      preset: z.enum(ANALYTICS_DATE_PRESETS).optional(),
      from: optionalDate,
      to: optionalDate,
      buildingId: z.string().uuid().optional(),
      departmentId: z.string().uuid().optional(),
      floorId: z.string().uuid().optional(),
    })
    .superRefine((val, ctx) => {
      if (val.from && val.to && val.from > val.to) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'from must be before or equal to to',
          path: ['from'],
        });
      }
    }),
});

export type AnalyticsBaseQuery = {
  preset?: AnalyticsDatePreset;
  from?: Date;
  to?: Date;
  buildingId?: string;
  departmentId?: string;
  floorId?: string;
};

export type AnalyticsTrendsQuery = AnalyticsBaseQuery & {
  granularity?: 'daily' | 'weekly' | 'monthly';
};

export type AnalyticsBuildingsQuery = AnalyticsBaseQuery & {
  page: number;
  limit: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
  search?: string;
};

export type AnalyticsDepartmentsQuery = AnalyticsBuildingsQuery;

export type AnalyticsReportQuery = AnalyticsBaseQuery & {
  category:
    | 'campus_overview'
    | 'utilities'
    | 'maintenance'
    | 'assets'
    | 'occupancy'
    | 'parking'
    | 'building_performance';
};

export const analyticsExportSchema = z.object({
  query: z
    .object({
      preset: z.enum(ANALYTICS_DATE_PRESETS).optional(),
      from: optionalDate,
      to: optionalDate,
      buildingId: z.string().uuid().optional(),
      departmentId: z.string().uuid().optional(),
      floorId: z.string().uuid().optional(),
      category: z.enum([
        'campus_overview',
        'utilities',
        'maintenance',
        'assets',
        'occupancy',
        'parking',
        'building_performance',
      ]),
      format: z.enum(['json', 'csv']).optional().default('json'),
    })
    .superRefine((val, ctx) => {
      if (val.from && val.to && val.from > val.to) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'from must be before or equal to to',
          path: ['from'],
        });
      }
    }),
});

export type AnalyticsExportQuery = z.infer<typeof analyticsExportSchema>['query'];

export const analyticsTrendsQuerySchema = analyticsBaseQuerySchema.extend({
  query: analyticsBaseQuerySchema.shape.query.extend({
    granularity: z.enum(['daily', 'weekly', 'monthly']).optional().default('daily'),
  }),
});

export const analyticsBuildingsQuerySchema = analyticsBaseQuerySchema.extend({
  query: paginationSchema
    .extend({
      preset: z.enum(ANALYTICS_DATE_PRESETS).optional(),
      from: optionalDate,
      to: optionalDate,
      buildingId: z.string().uuid().optional(),
      departmentId: z.string().uuid().optional(),
      floorId: z.string().uuid().optional(),
    })
    .superRefine((val, ctx) => {
      if (val.from && val.to && val.from > val.to) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'from must be before or equal to to',
          path: ['from'],
        });
      }
    }),
});

export const analyticsDepartmentsQuerySchema = analyticsBuildingsQuerySchema;

export const analyticsReportQuerySchema = analyticsBaseQuerySchema.extend({
  query: analyticsBaseQuerySchema.shape.query.extend({
    category: z.enum([
      'campus_overview',
      'utilities',
      'maintenance',
      'assets',
      'occupancy',
      'parking',
      'building_performance',
    ]),
  }),
});

export type ResolvedDateRange = {
  from: Date;
  to: Date;
  preset: AnalyticsDatePreset | 'default';
};

export function startOfDay(d: Date): Date {
  const copy = new Date(d);
  copy.setHours(0, 0, 0, 0);
  return copy;
}

export function endOfDay(d: Date): Date {
  const copy = new Date(d);
  copy.setHours(23, 59, 59, 999);
  return copy;
}

export function resolveAnalyticsDateRange(query: AnalyticsBaseQuery): ResolvedDateRange {
  const now = new Date();
  const preset = query.preset ?? (query.from || query.to ? 'custom' : 'last30days');

  if (preset === 'custom') {
    if (!query.from && !query.to) {
      throw AppError.badRequest('Custom range requires from and/or to');
    }
    const from = startOfDay(query.from ?? new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000));
    const to = endOfDay(query.to ?? now);
    if (from > to) throw AppError.badRequest('from must be before or equal to to');
    return { from, to, preset: 'custom' };
  }

  switch (preset) {
    case 'today':
      return { from: startOfDay(now), to: endOfDay(now), preset };
    case 'yesterday': {
      const y = new Date(now);
      y.setDate(y.getDate() - 1);
      return { from: startOfDay(y), to: endOfDay(y), preset };
    }
    case 'last7days':
      return {
        from: startOfDay(new Date(now.getTime() - 6 * 24 * 60 * 60 * 1000)),
        to: endOfDay(now),
        preset,
      };
    case 'last30days':
      return {
        from: startOfDay(new Date(now.getTime() - 29 * 24 * 60 * 60 * 1000)),
        to: endOfDay(now),
        preset,
      };
    case 'last90days':
      return {
        from: startOfDay(new Date(now.getTime() - 89 * 24 * 60 * 60 * 1000)),
        to: endOfDay(now),
        preset,
      };
    case 'currentMonth': {
      const from = new Date(now.getFullYear(), now.getMonth(), 1);
      return { from: startOfDay(from), to: endOfDay(now), preset };
    }
    case 'previousMonth': {
      const from = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const to = new Date(now.getFullYear(), now.getMonth(), 0);
      return { from: startOfDay(from), to: endOfDay(to), preset };
    }
    default:
      return {
        from: startOfDay(new Date(now.getTime() - 29 * 24 * 60 * 60 * 1000)),
        to: endOfDay(now),
        preset: 'default',
      };
  }
}

export type AnalyticsOverview = {
  kpis: {
    buildings: number;
    activeBuildings: number;
    floors: number;
    rooms: number;
    availableRooms: number;
    occupiedRooms: number;
    reservedRooms: number;
    roomsUnderMaintenance: number;
    occupancyRate: number | null;
    assets: number;
    activeAssets: number;
    assetsUnderMaintenance: number;
    openMaintenance: number;
    resolvedMaintenance: number;
    electricityConsumptionKwh: number | null;
    waterConsumptionLiters: number | null;
    parkingCapacity: number;
    parkingAvailable: number;
    parkingAllocated: number;
    parkingUtilization: number | null;
    unreadAlerts: number;
  };
  dateRange: { from: string; to: string; preset: string };
  filtersApplied: {
    buildingId?: string;
    departmentId?: string;
    floorId?: string;
  };
};

export type TrendSeriesPoint = { period: string; value: number };

export type AnalyticsTrends = {
  electricity: { unit: 'kWh'; daily: TrendSeriesPoint[]; weekly: TrendSeriesPoint[]; monthly: TrendSeriesPoint[] };
  water: { unit: 'L'; daily: TrendSeriesPoint[]; weekly: TrendSeriesPoint[]; monthly: TrendSeriesPoint[] };
  maintenance: Array<{
    period: string;
    reported: number;
    assigned: number;
    inProgress: number;
    resolved: number;
    closed: number;
    cancelled: number;
    rejected: number;
  }>;
  occupancy: Array<{
    period: string;
    available: number;
    occupied: number;
    reserved: number;
    underMaintenance: number;
  }>;
  parking: Array<{
    period: string;
    totalCapacity: number;
    available: number;
    allocated: number;
    utilizationPercent: number | null;
  }>;
  dateRange: { from: string; to: string; preset: string };
};

export type BuildingAnalyticsRow = {
  buildingId: string;
  code: string;
  name: string;
  rooms: number;
  occupiedRooms: number;
  occupancyRate: number | null;
  assets: number;
  maintenanceIssues: number;
  electricityKwh: number | null;
  waterLiters: number | null;
  parkingCapacity: number;
  parkingUtilization: number | null;
};

export type DepartmentAnalyticsRow = {
  departmentId: string;
  code: string;
  name: string;
  rooms: number;
  assets: number;
  maintenanceIssues: number;
  electricityMeters: number;
  electricityKwh: number | null;
  openMaintenance: number;
};

export type AssetAnalytics = {
  total: number;
  byCategory: Array<{ categoryId: string; name: string; count: number }>;
  byCondition: Array<{ condition: string; count: number }>;
  byOperationalStatus: Array<{ status: string; count: number }>;
  byBuilding: Array<{ buildingId: string; name: string; count: number }>;
  byDepartment: Array<{ departmentId: string; name: string; count: number }>;
  underMaintenance: number;
  retired: number;
  warrantyExpiringSoon: number;
};

export type MaintenanceAnalytics = {
  total: number;
  reported: number;
  assigned: number;
  inProgress: number;
  resolved: number;
  closed: number;
  cancelled: number;
  rejected: number;
  averageResolutionHours: number | null;
  byCategory: Array<{ categoryId: string; count: number }>;
  byPriority: Array<{ priority: string; count: number }>;
  byBuilding: Array<{ buildingId: string; name: string; count: number }>;
  byDepartment: Array<{ departmentId: string; name: string; count: number }>;
  assetRelated: number;
  technicianWorkload: Array<{ technicianId: string; name: string; assignments: number }>;
};

export type OccupancyAnalytics = {
  total: number;
  available: number;
  occupied: number;
  reserved: number;
  underMaintenance: number;
  occupancyRate: number | null;
  byBuilding: Array<{
    buildingId: string;
    code: string;
    name: string;
    total: number;
    occupied: number;
    occupancyRate: number | null;
  }>;
  byFloor: Array<{
    floorId: string;
    level: string;
    buildingName: string;
    total: number;
    occupied: number;
    occupancyRate: number | null;
  }>;
};

export type ParkingAnalytics = {
  areas: number;
  activeAreas: number;
  totalSlots: number;
  available: number;
  allocated: number;
  utilizationPercent: number | null;
  byType: Array<{ slotType: string; count: number }>;
  byStatus: Array<{ status: string; count: number }>;
  byBuilding: Array<{
    buildingId: string;
    name: string;
    total: number;
    available: number;
    allocated: number;
    utilizationPercent: number | null;
  }>;
};

export type UtilityAnalytics = {
  electricity: {
    unit: 'kWh';
    total: number | null;
    byBuilding: Array<{ buildingId: string; name: string; consumption: number }>;
    byDepartment: Array<{ departmentId: string; name: string; consumption: number }>;
    dailyTrend: TrendSeriesPoint[];
    monthlyTrend: TrendSeriesPoint[];
    anomalyCount: number;
  };
  water: {
    unit: 'L';
    total: number | null;
    byBuilding: Array<{ buildingId: string; name: string; consumption: number }>;
    dailyTrend: TrendSeriesPoint[];
    monthlyTrend: TrendSeriesPoint[];
    anomalyCount: number;
  };
  dateRange: { from: string; to: string; preset: string };
};

export type AnalyticsReport = {
  category: AnalyticsReportQuery['category'];
  generatedAt: string;
  dateRange: { from: string; to: string; preset: string };
  data: Record<string, unknown>;
};
