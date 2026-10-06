import { Request, Response, NextFunction } from 'express';
import { sendSuccess, sendCreated, sendPaginated } from '../../utils/apiResponse';
import type { AssetService } from './asset.service';
import type { CreateAssetDto, UpdateAssetDto, ListAssetsQuery } from './asset.dto';
import { actorFromRequest } from '../../services/department-scope.service';

export class AssetController {
  constructor(private readonly service: AssetService) {}

  list = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const actor = req.user ? actorFromRequest(req.user) : undefined;
      const result = await this.service.list(req.query as unknown as ListAssetsQuery, actor);
      sendPaginated(res, result.data, result.meta.pagination);
    } catch (err) {
      next(err);
    }
  };

  getById = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const actor = req.user ? actorFromRequest(req.user) : undefined;
      const asset = await this.service.getById(req.params['id'] as string, actor);
      sendSuccess(res, asset);
    } catch (err) {
      next(err);
    }
  };

  create = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const actorId = req.user?.sub;
      const asset = await this.service.create(req.body as CreateAssetDto, actorId);
      sendCreated(res, asset);
    } catch (err) {
      next(err);
    }
  };

  update = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const actorId = req.user?.sub;
      const asset = await this.service.update(
        req.params['id'] as string,
        req.body as UpdateAssetDto,
        actorId,
      );
      sendSuccess(res, asset);
    } catch (err) {
      next(err);
    }
  };

  archive = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const actorId = req.user?.sub;
      const archived = await this.service.archive(req.params['id'] as string, actorId);
      sendSuccess(res, archived);
    } catch (err) {
      next(err);
    }
  };

  getCategories = async (_req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const categories = await this.service.getCategories();
      sendSuccess(res, categories);
    } catch (err) {
      next(err);
    }
  };

  getVendors = async (_req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const vendors = await this.service.getVendors();
      sendSuccess(res, vendors);
    } catch (err) {
      next(err);
    }
  };
}
