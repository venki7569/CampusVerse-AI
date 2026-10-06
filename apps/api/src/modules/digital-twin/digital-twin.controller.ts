import { Request, Response, NextFunction } from 'express';
import { sendSuccess, sendPaginated } from '../../utils/apiResponse';
import { buildPaginationMeta } from '../../utils/pagination';
import type { DigitalTwinService } from './digital-twin.service';
import type { RecommendationService } from './recommendation.service';
import type { ListRecommendationsQuery } from './digital-twin.dto';

export class DigitalTwinController {
  constructor(
    private readonly twinService: DigitalTwinService,
    private readonly recommendationService: RecommendationService,
  ) {}

  getOverview = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const overview = await this.twinService.getOverview(req.user?.sub);
      if (req.user?.sub) {
        await this.twinService.logView(req.user.sub, 'overview');
      }
      sendSuccess(res, overview);
    } catch (err) {
      next(err);
    }
  };

  getBuilding = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const data = await this.twinService.getBuildingTwin(req.params['id'] as string);
      if (req.user?.sub) {
        await this.twinService.logView(req.user.sub, 'building', req.params['id'] as string);
      }
      sendSuccess(res, data);
    } catch (err) {
      next(err);
    }
  };

  getRoom = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const data = await this.twinService.getRoomTwin(req.params['id'] as string);
      if (req.user?.sub) {
        await this.twinService.logView(req.user.sub, 'room', req.params['id'] as string);
      }
      sendSuccess(res, data);
    } catch (err) {
      next(err);
    }
  };

  getAsset = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const data = await this.twinService.getAssetTwin(req.params['id'] as string);
      if (req.user?.sub) {
        await this.twinService.logView(req.user.sub, 'asset', req.params['id'] as string);
      }
      sendSuccess(res, data);
    } catch (err) {
      next(err);
    }
  };

  getOccupancy = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const buildingId = req.query['buildingId'] as string | undefined;
      const overview = await this.twinService.getOverview(req.user?.sub);
      sendSuccess(res, buildingId ? { buildingId, insight: overview.occupancy } : overview.occupancy);
    } catch (err) {
      next(err);
    }
  };

  getCampusHealth = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const overview = await this.twinService.getOverview(req.user?.sub);
      sendSuccess(res, overview.health);
    } catch (err) {
      next(err);
    }
  };

  listRecommendations = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const query = req.query as unknown as ListRecommendationsQuery;
      const result = await this.recommendationService.list(query);
      sendPaginated(res, result.data, buildPaginationMeta(result.page, result.limit, result.total));
    } catch (err) {
      next(err);
    }
  };

  syncRecommendations = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const result = await this.recommendationService.syncFromIntelligence(req.user!.sub);
      sendSuccess(res, result);
    } catch (err) {
      next(err);
    }
  };

  acknowledgeRecommendation = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const data = await this.recommendationService.acknowledge(req.params['id'] as string, req.user!.sub);
      sendSuccess(res, data);
    } catch (err) {
      next(err);
    }
  };

  dismissRecommendation = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const data = await this.recommendationService.dismiss(req.params['id'] as string, req.user!.sub);
      sendSuccess(res, data);
    } catch (err) {
      next(err);
    }
  };

  resolveRecommendation = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const data = await this.recommendationService.resolve(req.params['id'] as string, req.user!.sub);
      sendSuccess(res, data);
    } catch (err) {
      next(err);
    }
  };
}
