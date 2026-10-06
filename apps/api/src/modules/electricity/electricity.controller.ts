import { Request, Response, NextFunction } from 'express';
import { sendSuccess, sendCreated, sendPaginated } from '../../utils/apiResponse';
import type { ElectricityService } from './electricity.service';
import type {
  CreateElectricityMeterDto,
  UpdateElectricityMeterDto,
  ListElectricityMetersQuery,
  CreateElectricityReadingDto,
  ListElectricityReadingsQuery,
  ElectricityAnalyticsQuery,
} from './electricity.dto';
import { actorFromRequest } from '../../services/department-scope.service';

export class ElectricityController {
  constructor(private readonly service: ElectricityService) {}

  listMeters = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const actor = req.user ? actorFromRequest(req.user) : undefined;
      const result = await this.service.listMeters(req.query as unknown as ListElectricityMetersQuery, actor);
      sendPaginated(res, result.data, result.meta.pagination);
    } catch (err) {
      next(err);
    }
  };

  getMeterById = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const actor = req.user ? actorFromRequest(req.user) : undefined;
      const meter = await this.service.getMeterById(req.params['id'] as string, actor);
      sendSuccess(res, meter);
    } catch (err) {
      next(err);
    }
  };

  createMeter = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const actorId = req.user?.sub;
      const meter = await this.service.createMeter(req.body as CreateElectricityMeterDto, actorId);
      sendCreated(res, meter);
    } catch (err) {
      next(err);
    }
  };

  updateMeter = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const actorId = req.user?.sub;
      const meter = await this.service.updateMeter(
        req.params['id'] as string,
        req.body as UpdateElectricityMeterDto,
        actorId
      );
      sendSuccess(res, meter);
    } catch (err) {
      next(err);
    }
  };

  archiveMeter = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const actorId = req.user?.sub;
      const meter = await this.service.archiveMeter(req.params['id'] as string, actorId);
      sendSuccess(res, meter);
    } catch (err) {
      next(err);
    }
  };

  createReading = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const actorId = req.user?.sub;
      const reading = await this.service.createReading(
        req.params['id'] as string,
        req.body as CreateElectricityReadingDto,
        actorId
      );
      sendCreated(res, reading);
    } catch (err) {
      next(err);
    }
  };

  getReadings = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const result = await this.service.getReadings(
        req.params['id'] as string,
        req.query as unknown as ListElectricityReadingsQuery
      );
      sendPaginated(res, result.data, result.meta.pagination);
    } catch (err) {
      next(err);
    }
  };

  getLatestReading = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const reading = await this.service.getLatestReading(req.params['id'] as string);
      sendSuccess(res, reading);
    } catch (err) {
      next(err);
    }
  };

  getConsumptionAnalytics = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const result = await this.service.getConsumptionAnalytics(
        req.query as unknown as ElectricityAnalyticsQuery
      );
      sendSuccess(res, result);
    } catch (err) {
      next(err);
    }
  };
}
