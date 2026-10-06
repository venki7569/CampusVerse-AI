import { PrismaClient, MaintenanceStatus } from '@prisma/client';
import type { RoleName } from '../../types';
import type { DashboardService } from '../dashboard/dashboard.service';
import type { AnalyticsService } from '../analytics/analytics.service';
import type { ParkingService } from '../parking/parking.service';
import type { MaintenanceService } from '../maintenance/maintenance.service';
import type { AnnouncementService } from '../announcements/announcement.service';
import type { DigitalTwinService } from '../digital-twin/digital-twin.service';
import type { MaintenanceRiskService } from '../digital-twin/maintenance-risk.service';
import type { UtilityIntelligenceService } from '../digital-twin/utility-intelligence.service';
import type { CampusHealthService } from '../digital-twin/campus-health.service';
import type { RecommendationService } from '../digital-twin/recommendation.service';
import type { OccupancyIntelligenceService } from '../digital-twin/occupancy-intelligence.service';
import type { IoTService } from '../iot/iot.service';
import type { OperationalActionService } from '../iot/operational-action.service';
import { NotificationRepository } from '../notifications/notification.repository';
import type { AISourceReference } from './ai.dto';

export type ToolContext = {
  userId: string;
  roles: RoleName[];
  permissions: Set<string>;
};

export type ToolExecutionResult = {
  tool: string;
  data: unknown;
  source: AISourceReference;
  denied?: boolean;
};

export type CampusToolName =
  | 'getCampusOverview'
  | 'getBuildings'
  | 'getDepartments'
  | 'getAssets'
  | 'getMaintenanceSummary'
  | 'getElectricitySummary'
  | 'getWaterSummary'
  | 'getParkingAvailability'
  | 'getAnalyticsOverview'
  | 'getRoomOccupancy'
  | 'getAlerts'
  | 'getAnnouncements'
  | 'getDigitalTwinOverview'
  | 'getMaintenanceRisk'
  | 'getUtilityAnomalies'
  | 'getCampusHealth'
  | 'getOccupancyInsights'
  | 'getOperationalRecommendations'
  | 'getDeviceHealthSummary'
  | 'getLiveTelemetrySummary'
  | 'getEnvironmentalConditions'
  | 'getProposedOperationalActions';

const OPEN: MaintenanceStatus[] = [
  MaintenanceStatus.REPORTED,
  MaintenanceStatus.ASSIGNED,
  MaintenanceStatus.IN_PROGRESS,
];

const emptyDashboardQuery = {
  from: undefined,
  to: undefined,
  buildingId: undefined,
  departmentId: undefined,
  floorId: undefined,
} as const;

export function selectTools(message: string): CampusToolName[] {
  const lower = message.toLowerCase();
  const selected = new Set<CampusToolName>();

  if (/alert|notification|anomal/.test(lower)) selected.add('getAlerts');
  if (/announcement|notice|campus news|urgent notice/.test(lower)) selected.add('getAnnouncements');
  if (/maintenance|repair|ticket|issue|work order/.test(lower)) selected.add('getMaintenanceSummary');
  if (/electric|energy|kwh|power/.test(lower)) selected.add('getElectricitySummary');
  if (/water|liter|litre/.test(lower)) selected.add('getWaterSummary');
  if (/parking|slot|park/.test(lower)) selected.add('getParkingAvailability');
  if (/analytics|consumption|utilization|trend|performance/.test(lower)) selected.add('getAnalyticsOverview');
  if (/building|block|facility/.test(lower)) selected.add('getBuildings');
  if (/department|faculty/.test(lower)) selected.add('getDepartments');
  if (/asset|equipment|inventory/.test(lower)) selected.add('getAssets');
  if (/room|occupancy|classroom|laboratory|lab/.test(lower)) selected.add('getRoomOccupancy');
  if (/risk|inspect|predict|failure|overdue/.test(lower)) selected.add('getMaintenanceRisk');
  if (/anomal|spike|leak|abnormal/.test(lower)) selected.add('getUtilityAnomalies');
  if (/health score|campus health|operational health/.test(lower)) selected.add('getCampusHealth');
  if (/digital twin|twin|operational risk/.test(lower)) selected.add('getDigitalTwinOverview');
  if (/underutil|utilization insight|peak period/.test(lower)) selected.add('getOccupancyInsights');
  if (/recommend|action item|top risk/.test(lower)) selected.add('getOperationalRecommendations');
  if (/iot|sensor|device health|telemetry|environmental/.test(lower)) {
    selected.add('getDeviceHealthSummary');
    selected.add('getLiveTelemetrySummary');
  }
  if (/temperature|humidity|air quality|environment/.test(lower)) selected.add('getEnvironmentalConditions');
  if (/approve|proposed action|operational action plan/.test(lower)) selected.add('getProposedOperationalActions');

  if (/summary|overview|campus|status|today/.test(lower)) selected.add('getCampusOverview');

  if (selected.size === 0) selected.add('getCampusOverview');

  return [...selected].slice(0, 5);
}

function hasPerm(ctx: ToolContext, code: string): boolean {
  if (ctx.roles.includes('SUPER_ADMIN')) return true;
  return ctx.permissions.has(code);
}

export class CampusTools {
  private readonly notifications = new NotificationRepository();

  constructor(
    private readonly db: PrismaClient,
    private readonly dashboard: DashboardService,
    private readonly analytics: AnalyticsService,
    private readonly parking: ParkingService,
    private readonly maintenance: MaintenanceService,
    private readonly announcements?: AnnouncementService,
    private readonly intelligence?: {
      twin: DigitalTwinService;
      maintenanceRisk: MaintenanceRiskService;
      utilityIntel: UtilityIntelligenceService;
      campusHealth: CampusHealthService;
      occupancyIntel: OccupancyIntelligenceService;
      recommendations: RecommendationService;
      iot?: IoTService;
      actions?: OperationalActionService;
    },
  ) {}

  async execute(tool: CampusToolName, ctx: ToolContext): Promise<ToolExecutionResult> {
    switch (tool) {
      case 'getCampusOverview':
        return this.getCampusOverview(ctx);
      case 'getBuildings':
        return this.getBuildings(ctx);
      case 'getDepartments':
        return this.getDepartments(ctx);
      case 'getAssets':
        return this.getAssets(ctx);
      case 'getMaintenanceSummary':
        return this.getMaintenanceSummary(ctx);
      case 'getElectricitySummary':
        return this.getElectricitySummary(ctx);
      case 'getWaterSummary':
        return this.getWaterSummary(ctx);
      case 'getParkingAvailability':
        return this.getParkingAvailability(ctx);
      case 'getAnalyticsOverview':
        return this.getAnalyticsOverview(ctx);
      case 'getRoomOccupancy':
        return this.getRoomOccupancy(ctx);
      case 'getAlerts':
        return this.getAlerts(ctx);
      case 'getAnnouncements':
        return this.getAnnouncements(ctx);
      case 'getDigitalTwinOverview':
        return this.getDigitalTwinOverview(ctx);
      case 'getMaintenanceRisk':
        return this.getMaintenanceRisk(ctx);
      case 'getUtilityAnomalies':
        return this.getUtilityAnomalies(ctx);
      case 'getCampusHealth':
        return this.getCampusHealth(ctx);
      case 'getOccupancyInsights':
        return this.getOccupancyInsights(ctx);
      case 'getOperationalRecommendations':
        return this.getOperationalRecommendations(ctx);
      case 'getDeviceHealthSummary':
        return this.getDeviceHealthSummary(ctx);
      case 'getLiveTelemetrySummary':
        return this.getLiveTelemetrySummary(ctx);
      case 'getEnvironmentalConditions':
        return this.getEnvironmentalConditions(ctx);
      case 'getProposedOperationalActions':
        return this.getProposedOperationalActions(ctx);
      default:
        return {
          tool,
          data: null,
          source: { type: 'unknown', label: 'Unknown' },
        };
    }
  }

  async executeMany(tools: CampusToolName[], ctx: ToolContext): Promise<ToolExecutionResult[]> {
    const results: ToolExecutionResult[] = [];
    for (const tool of tools) {
      results.push(await this.execute(tool, ctx));
    }
    return results;
  }

  private denied(tool: string, label: string): ToolExecutionResult {
    return {
      tool,
      data: { message: 'You do not have permission to access this campus data.' },
      source: { type: tool, label },
      denied: true,
    };
  }

  private async getCampusOverview(_ctx: ToolContext): Promise<ToolExecutionResult> {
    const overview = await this.dashboard.getOverview(emptyDashboardQuery);
    return {
      tool: 'getCampusOverview',
      data: {
        kpis: overview.kpis,
        occupancy: overview.occupancy,
        maintenance: {
          open: overview.maintenance.open,
          critical: overview.maintenance.critical,
        },
        parking: overview.parking,
        energy: {
          electricityAvailable: overview.energy.electricity.available,
          electricityMonthlyKwh: overview.energy.electricity.monthly,
          waterAvailable: overview.energy.water.available,
          waterMonthlyLiters: overview.energy.water.monthly,
        },
      },
      source: { type: 'dashboard', label: 'Live Dashboard', period: 'Current snapshot' },
    };
  }

  private async getBuildings(_ctx: ToolContext): Promise<ToolExecutionResult> {
    const buildings = await this.db.building.findMany({
      take: 20,
      orderBy: { name: 'asc' },
      select: {
        id: true,
        code: true,
        name: true,
        operationalStatus: true,
        _count: { select: { floors: true, assets: true } },
      },
    });
    const openMaint = await this.db.maintenanceRequest.groupBy({
      by: ['status'],
      where: { status: { in: OPEN } },
      _count: { _all: true },
    });
    return {
      tool: 'getBuildings',
      data: { buildings, openMaintenanceByStatus: openMaint },
      source: { type: 'buildings', label: 'Building Registry' },
    };
  }

  private async getDepartments(_ctx: ToolContext): Promise<ToolExecutionResult> {
    const departments = await this.db.department.findMany({
      take: 20,
      orderBy: { name: 'asc' },
      select: {
        id: true,
        code: true,
        name: true,
        _count: { select: { rooms: true, assets: true } },
      },
    });
    return {
      tool: 'getDepartments',
      data: { departments },
      source: { type: 'departments', label: 'Department Directory' },
    };
  }

  private async getAssets(_ctx: ToolContext): Promise<ToolExecutionResult> {
    const [total, byStatus] = await Promise.all([
      this.db.asset.count(),
      this.db.asset.groupBy({ by: ['operationalStatus'], _count: { _all: true } }),
    ]);
    const byCategory = await this.db.asset.groupBy({
      by: ['categoryId'],
      _count: { _all: true },
    });
    const topCategories = [...byCategory]
      .sort((a, b) => b._count._all - a._count._all)
      .slice(0, 10);
    const categories = await this.db.assetCategory.findMany({
      where: { id: { in: topCategories.map((c) => c.categoryId) } },
      select: { id: true, name: true },
    });
    const catMap = new Map(categories.map((c) => [c.id, c.name]));
    return {
      tool: 'getAssets',
      data: {
        total,
        byStatus,
        topCategories: topCategories.map((c) => ({
          category: catMap.get(c.categoryId) ?? c.categoryId,
          count: c._count._all,
        })),
      },
      source: { type: 'assets', label: 'Asset Registry' },
    };
  }

  private async getMaintenanceSummary(_ctx: ToolContext): Promise<ToolExecutionResult> {
    const metrics = await this.maintenance.getMetrics();
    const openByBuilding = await this.db.maintenanceRequest.findMany({
      where: { status: { in: OPEN } },
      take: 15,
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        title: true,
        priority: true,
        status: true,
        room: { select: { roomNumber: true, floor: { select: { building: { select: { name: true } } } } } },
      },
    });
    return {
      tool: 'getMaintenanceSummary',
      data: { metrics, openIssues: openByBuilding },
      source: { type: 'maintenance', label: 'Maintenance Records' },
    };
  }

  private async getElectricitySummary(ctx: ToolContext): Promise<ToolExecutionResult> {
    if (!hasPerm(ctx, 'analytics.view')) {
      const overview = await this.dashboard.getOverview(emptyDashboardQuery);
      if (!overview.energy.electricity.available) {
        return this.denied('getElectricitySummary', 'Electricity Analytics');
      }
      return {
        tool: 'getElectricitySummary',
        data: {
          unit: 'kWh',
          daily: overview.energy.electricity.daily,
          weekly: overview.energy.electricity.weekly,
          monthly: overview.energy.electricity.monthly,
          byBuilding: overview.energy.electricity.byBuilding,
        },
        source: { type: 'electricity', label: 'Electricity Dashboard', period: 'Recent readings' },
      };
    }
    const utilities = await this.analytics.getUtilityAnalytics({ preset: 'last30days' }, ctx.userId);
    return {
      tool: 'getElectricitySummary',
      data: utilities.electricity,
      source: { type: 'electricity', label: 'Electricity Analytics', period: 'Last 30 days' },
    };
  }

  private async getWaterSummary(ctx: ToolContext): Promise<ToolExecutionResult> {
    if (!hasPerm(ctx, 'analytics.view')) {
      const overview = await this.dashboard.getOverview(emptyDashboardQuery);
      if (!overview.energy.water.available) {
        return this.denied('getWaterSummary', 'Water Analytics');
      }
      return {
        tool: 'getWaterSummary',
        data: {
          unit: 'L',
          daily: overview.energy.water.daily,
          weekly: overview.energy.water.weekly,
          monthly: overview.energy.water.monthly,
          byBuilding: overview.energy.water.byBuilding,
        },
        source: { type: 'water', label: 'Water Dashboard', period: 'Recent readings' },
      };
    }
    const utilities = await this.analytics.getUtilityAnalytics({ preset: 'last30days' }, ctx.userId);
    return {
      tool: 'getWaterSummary',
      data: utilities.water,
      source: { type: 'water', label: 'Water Analytics', period: 'Last 30 days' },
    };
  }

  private async getParkingAvailability(ctx: ToolContext): Promise<ToolExecutionResult> {
    if (!hasPerm(ctx, 'parking.view')) {
      return this.denied('getParkingAvailability', 'Parking Management');
    }
    const availability = await this.parking.getAvailability({});
    return {
      tool: 'getParkingAvailability',
      data: availability,
      source: { type: 'parking', label: 'Parking Availability', period: 'Current snapshot' },
    };
  }

  private async getAnalyticsOverview(ctx: ToolContext): Promise<ToolExecutionResult> {
    if (!hasPerm(ctx, 'analytics.view')) {
      return this.denied('getAnalyticsOverview', 'Campus Analytics');
    }
    const overview = await this.analytics.getOverview({ preset: 'last30days' }, ctx.userId);
    return {
      tool: 'getAnalyticsOverview',
      data: overview,
      source: { type: 'analytics', label: 'Campus Analytics', period: 'Last 30 days' },
    };
  }

  private async getRoomOccupancy(ctx: ToolContext): Promise<ToolExecutionResult> {
    if (hasPerm(ctx, 'analytics.view')) {
      const occupancy = await this.analytics.getOccupancyAnalytics({}, ctx.userId);
      return {
        tool: 'getRoomOccupancy',
        data: occupancy,
        source: { type: 'occupancy', label: 'Occupancy Analytics', period: 'Current snapshot' },
      };
    }
    const overview = await this.dashboard.getOverview(emptyDashboardQuery);
    return {
      tool: 'getRoomOccupancy',
      data: overview.occupancy,
      source: { type: 'occupancy', label: 'Room Occupancy', period: 'Current snapshot' },
    };
  }

  private async getAlerts(ctx: ToolContext): Promise<ToolExecutionResult> {
    const result = await this.notifications.findForUser(ctx.userId, {
      page: 1,
      limit: 10,
      sortOrder: 'desc',
      unreadOnly: true,
    });
    return {
      tool: 'getAlerts',
      data: {
        unreadCount: result.data.length,
        alerts: result.data.map((n) => ({
          title: n.title,
          message: n.message,
          type: n.type,
          severity: n.severity,
          createdAt: n.createdAt,
        })),
      },
      source: { type: 'notifications', label: 'Notification Center', period: 'Unread alerts' },
    };
  }

  private async getAnnouncements(ctx: ToolContext): Promise<ToolExecutionResult> {
    if (!hasPerm(ctx, 'announcement.view')) {
      return {
        tool: 'getAnnouncements',
        data: { message: 'You do not have permission to access campus announcements.' },
        source: { type: 'announcements', label: 'Campus Announcements' },
        denied: true,
      };
    }
    if (!this.announcements) {
      return {
        tool: 'getAnnouncements',
        data: { announcements: [] },
        source: { type: 'announcements', label: 'Campus Announcements', period: 'Current feed' },
      };
    }
    const user = await this.db.user.findUnique({
      where: { id: ctx.userId },
      select: { departmentId: true },
    });
    const urgentOnly = false;
    const items = await this.announcements.listForAI(
      ctx.userId,
      ctx.roles,
      user?.departmentId ?? null,
      { limit: 10, urgentOnly },
    );
    return {
      tool: 'getAnnouncements',
      data: {
        count: items.length,
        announcements: items.map((a) => ({
          title: a.title,
          category: a.category,
          priority: a.priority,
          publishedAt: a.publishedAt,
          expiresAt: a.expiresAt,
          content: a.content.slice(0, 500),
        })),
      },
      source: { type: 'announcements', label: 'Campus Announcements', period: 'Visible to you' },
    };
  }

  private async getDigitalTwinOverview(ctx: ToolContext): Promise<ToolExecutionResult> {
    if (!hasPerm(ctx, 'digital_twin.view')) {
      return this.denied('getDigitalTwinOverview', 'Digital Twin');
    }
    if (!this.intelligence) {
      return { tool: 'getDigitalTwinOverview', data: { message: 'Digital twin unavailable' }, source: { type: 'digital-twin', label: 'Digital Twin' } };
    }
    const overview = await this.intelligence.twin.getOverview(ctx.userId);
    return {
      tool: 'getDigitalTwinOverview',
      data: overview,
      source: { type: 'digital-twin', label: 'Campus Digital Twin', period: overview.lastUpdated },
    };
  }

  private async getMaintenanceRisk(ctx: ToolContext): Promise<ToolExecutionResult> {
    if (!hasPerm(ctx, 'digital_twin.view')) {
      return this.denied('getMaintenanceRisk', 'Maintenance Risk Intelligence');
    }
    if (!this.intelligence) {
      return { tool: 'getMaintenanceRisk', data: { risks: [] }, source: { type: 'maintenance-risk', label: 'Maintenance Risk' } };
    }
    const risks = await this.intelligence.maintenanceRisk.assessAll();
    return {
      tool: 'getMaintenanceRisk',
      data: { count: risks.length, topRisks: risks.slice(0, 10) },
      source: { type: 'maintenance-risk', label: 'Predictive Maintenance', period: 'Current assessment' },
    };
  }

  private async getUtilityAnomalies(ctx: ToolContext): Promise<ToolExecutionResult> {
    if (!hasPerm(ctx, 'digital_twin.view')) {
      return this.denied('getUtilityAnomalies', 'Utility Intelligence');
    }
    if (!this.intelligence) {
      return { tool: 'getUtilityAnomalies', data: { anomalies: [] }, source: { type: 'utility-intelligence', label: 'Utility Intelligence' } };
    }
    const anomalies = await this.intelligence.utilityIntel.detectAnomalies();
    return {
      tool: 'getUtilityAnomalies',
      data: { count: anomalies.length, anomalies: anomalies.slice(0, 10) },
      source: { type: 'utility-intelligence', label: 'Utility Anomaly Detection', period: '7-day vs 90-day baseline' },
    };
  }

  private async getCampusHealth(ctx: ToolContext): Promise<ToolExecutionResult> {
    if (!hasPerm(ctx, 'digital_twin.view')) {
      return this.denied('getCampusHealth', 'Campus Health Score');
    }
    if (!this.intelligence) {
      return { tool: 'getCampusHealth', data: null, source: { type: 'campus-health', label: 'Campus Health' } };
    }
    const health = await this.intelligence.campusHealth.calculate();
    return {
      tool: 'getCampusHealth',
      data: health,
      source: { type: 'campus-health', label: 'Campus Health Score', period: health.calculatedAt },
    };
  }

  private async getOccupancyInsights(ctx: ToolContext): Promise<ToolExecutionResult> {
    if (!hasPerm(ctx, 'digital_twin.view') && !hasPerm(ctx, 'analytics.view')) {
      return this.denied('getOccupancyInsights', 'Occupancy Intelligence');
    }
    if (!this.intelligence) {
      return { tool: 'getOccupancyInsights', data: { trend: 'insufficient_data' }, source: { type: 'occupancy-insights', label: 'Occupancy Intelligence' } };
    }
    const insight = await this.intelligence.occupancyIntel.getCampusInsight();
    return {
      tool: 'getOccupancyInsights',
      data: insight,
      source: { type: 'occupancy-insights', label: 'Occupancy Intelligence', period: 'Current snapshot' },
    };
  }

  private async getOperationalRecommendations(ctx: ToolContext): Promise<ToolExecutionResult> {
    if (!hasPerm(ctx, 'recommendation.view')) {
      return this.denied('getOperationalRecommendations', 'Operational Recommendations');
    }
    if (!this.intelligence) {
      return { tool: 'getOperationalRecommendations', data: { recommendations: [] }, source: { type: 'recommendations', label: 'Recommendations' } };
    }
    const result = await this.intelligence.recommendations.list({ page: 1, limit: 10, status: 'OPEN' });
    return {
      tool: 'getOperationalRecommendations',
      data: { count: result.total, recommendations: result.data },
      source: { type: 'recommendations', label: 'Operational Recommendations', period: 'Open items' },
    };
  }

  private async getDeviceHealthSummary(ctx: ToolContext): Promise<ToolExecutionResult> {
    if (!hasPerm(ctx, 'iot.view')) {
      return this.denied('getDeviceHealthSummary', 'IoT Device Health');
    }
    if (!this.intelligence?.iot) {
      return { tool: 'getDeviceHealthSummary', data: { devices: [] }, source: { type: 'iot', label: 'Device Health' } };
    }
    const summary = await this.intelligence.iot.getControlCenterSummary();
    return {
      tool: 'getDeviceHealthSummary',
      data: summary,
      source: { type: 'iot', label: 'IoT Device Registry', period: 'Current snapshot' },
    };
  }

  private async getLiveTelemetrySummary(ctx: ToolContext): Promise<ToolExecutionResult> {
    if (!hasPerm(ctx, 'iot.view') && !hasPerm(ctx, 'digital_twin.view')) {
      return this.denied('getLiveTelemetrySummary', 'Live Telemetry');
    }
    if (!this.intelligence?.iot) {
      return { tool: 'getLiveTelemetrySummary', data: null, source: { type: 'iot', label: 'Telemetry' } };
    }
    const devices = await this.intelligence.iot.listDevices({ page: 1, limit: 10, sortBy: 'lastSeenAt', sortOrder: 'desc' });
    return {
      tool: 'getLiveTelemetrySummary',
      data: {
        recentDevices: devices.data.map((d: { id: string; name: string; type: string; status: string; lastSeenAt: Date | null }) => ({
          id: d.id,
          name: d.name,
          type: d.type,
          status: d.status,
          lastSeenAt: d.lastSeenAt,
          note: d.lastSeenAt ? 'LIVE if within stale threshold' : 'No telemetry received',
        })),
      },
      source: { type: 'iot', label: 'Live Telemetry Summary', period: 'Latest device activity' },
    };
  }

  private async getEnvironmentalConditions(ctx: ToolContext): Promise<ToolExecutionResult> {
    if (!hasPerm(ctx, 'iot.view') && !hasPerm(ctx, 'digital_twin.view')) {
      return this.denied('getEnvironmentalConditions', 'Environmental Conditions');
    }
    const building = await this.db.building.findFirst({ select: { id: true, name: true } });
    if (!building || !this.intelligence?.iot) {
      return {
        tool: 'getEnvironmentalConditions',
        data: { status: 'insufficient_data' },
        source: { type: 'iot', label: 'Environmental Sensors' },
      };
    }
    const summary = await this.intelligence.iot.getEnvironmentalSummary(building.id);
    return {
      tool: 'getEnvironmentalConditions',
      data: { building: building.name, ...summary },
      source: { type: 'iot', label: 'Environmental Sensors', period: 'Latest readings' },
    };
  }

  private async getProposedOperationalActions(ctx: ToolContext): Promise<ToolExecutionResult> {
    if (!hasPerm(ctx, 'iot.actions') && !hasPerm(ctx, 'recommendation.view')) {
      return this.denied('getProposedOperationalActions', 'Proposed Actions');
    }
    if (!this.intelligence?.actions) {
      return { tool: 'getProposedOperationalActions', data: { actions: [] }, source: { type: 'actions', label: 'Operational Actions' } };
    }
    const result = await this.intelligence.actions.list({ page: 1, limit: 10, status: 'PROPOSED' });
    return {
      tool: 'getProposedOperationalActions',
      data: {
        actions: result.data,
        note: 'Actions require explicit human approval before execution. AI cannot auto-execute.',
      },
      source: { type: 'actions', label: 'Proposed Operational Actions', period: 'Pending approval' },
    };
  }
}

export function formatToolContext(results: ToolExecutionResult[]): string {
  return JSON.stringify(
    results.map((r) => ({
      tool: r.tool,
      source: r.source,
      data: r.data,
    })),
    null,
    2,
  );
}
