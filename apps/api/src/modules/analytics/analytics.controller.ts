import { Request, Response, NextFunction } from 'express';
import type { PrismaClient } from '@prisma/client';
import { sendSuccess } from '../../utils/apiResponse';
import { toCsv } from '../../utils/csvExport';
import {
  actorFromRequest,
  applyDepartmentQueryFilter,
  resolveDepartmentScope,
} from '../../services/department-scope.service';
import type { AnalyticsService } from './analytics.service';
import type {
  AnalyticsBaseQuery,
  AnalyticsBuildingsQuery,
  AnalyticsDepartmentsQuery,
  AnalyticsExportQuery,
  AnalyticsReportQuery,
  AnalyticsTrendsQuery,
} from './analytics.dto';

export class AnalyticsController {
  constructor(
    private readonly service: AnalyticsService,
    private readonly db: PrismaClient,
  ) {}

  private async scopedQuery<T extends AnalyticsBaseQuery>(req: Request, query: T): Promise<T> {
    if (!req.user) return query;
    const scope = await resolveDepartmentScope(this.db, actorFromRequest(req.user));
    return applyDepartmentQueryFilter(scope, query);
  }

  getOverview = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const query = await this.scopedQuery(req, req.query as unknown as AnalyticsBaseQuery);
      sendSuccess(res, await this.service.getOverview(query, req.user?.sub));
    } catch (err) {
      next(err);
    }
  };

  getTrends = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const query = await this.scopedQuery(req, req.query as unknown as AnalyticsTrendsQuery);
      sendSuccess(res, await this.service.getTrends(query, req.user?.sub));
    } catch (err) {
      next(err);
    }
  };

  getBuildings = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const query = await this.scopedQuery(req, req.query as unknown as AnalyticsBuildingsQuery);
      const result = await this.service.getBuildingAnalytics(query, req.user?.sub);
      sendSuccess(res, result.data, {
        pagination: result.meta.pagination,
        dateRange: result.dateRange,
      });
    } catch (err) {
      next(err);
    }
  };

  getDepartments = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const query = await this.scopedQuery(req, req.query as unknown as AnalyticsDepartmentsQuery);
      const result = await this.service.getDepartmentAnalytics(query, req.user?.sub);
      sendSuccess(res, result.data, { dateRange: result.dateRange });
    } catch (err) {
      next(err);
    }
  };

  getUtilities = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const query = await this.scopedQuery(req, req.query as unknown as AnalyticsBaseQuery);
      sendSuccess(res, await this.service.getUtilityAnalytics(query, req.user?.sub));
    } catch (err) {
      next(err);
    }
  };

  getMaintenance = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const query = await this.scopedQuery(req, req.query as unknown as AnalyticsBaseQuery);
      sendSuccess(res, await this.service.getMaintenanceAnalytics(query, req.user?.sub));
    } catch (err) {
      next(err);
    }
  };

  getAssets = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const query = await this.scopedQuery(req, req.query as unknown as AnalyticsBaseQuery);
      sendSuccess(res, await this.service.getAssetAnalytics(query, req.user?.sub));
    } catch (err) {
      next(err);
    }
  };

  getOccupancy = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const query = await this.scopedQuery(req, req.query as unknown as AnalyticsBaseQuery);
      sendSuccess(res, await this.service.getOccupancyAnalytics(query, req.user?.sub));
    } catch (err) {
      next(err);
    }
  };

  getParking = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const query = await this.scopedQuery(req, req.query as unknown as AnalyticsBaseQuery);
      sendSuccess(res, await this.service.getParkingAnalytics(query, req.user?.sub));
    } catch (err) {
      next(err);
    }
  };

  getReport = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const query = await this.scopedQuery(req, req.query as unknown as AnalyticsReportQuery);
      sendSuccess(res, await this.service.generateReport(query, req.user?.sub));
    } catch (err) {
      next(err);
    }
  };

  exportReport = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const raw = req.query as unknown as AnalyticsExportQuery;
      const query = await this.scopedQuery(req, raw as AnalyticsReportQuery);
      const report = await this.service.generateReport(query as AnalyticsReportQuery, req.user?.sub);
      const format = raw.format ?? 'json';

      if (format === 'csv') {
        const rows = flattenReportForCsv(report);
        const csv = toCsv(rows);
        res.setHeader('Content-Type', 'text/csv; charset=utf-8');
        res.setHeader(
          'Content-Disposition',
          `attachment; filename="analytics-${report.category}-${Date.now()}.csv"`,
        );
        res.status(200).send(csv);
        return;
      }

      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="analytics-${report.category}-${Date.now()}.json"`,
      );
      res.status(200).json(report);
    } catch (err) {
      next(err);
    }
  };
}

function flattenReportForCsv(report: {
  category: string;
  generatedAt: string;
  dateRange: { from: string; to: string; preset?: string };
  data: Record<string, unknown>;
}): Record<string, unknown>[] {
  const base = {
    category: report.category,
    generatedAt: report.generatedAt,
    from: report.dateRange.from,
    to: report.dateRange.to,
    preset: report.dateRange.preset ?? '',
  };

  switch (report.category) {
    case 'building_performance': {
      const buildings = (report.data['buildings'] as { data?: Array<Record<string, unknown>> })?.data ?? [];
      return buildings.map((row) => ({ ...base, ...row }));
    }
    case 'campus_overview': {
      const overview = report.data['overview'] as Record<string, unknown> | undefined;
      const kpis = (overview?.['kpis'] as Record<string, unknown>) ?? {};
      return [{ ...base, ...kpis }];
    }
    default: {
      const section = report.data[report.category] as Record<string, unknown> | undefined;
      if (section && typeof section === 'object') {
        return [{ ...base, ...section }];
      }
      return [base];
    }
  }
}
