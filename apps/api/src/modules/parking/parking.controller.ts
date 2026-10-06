import { Request, Response, NextFunction } from 'express';
import { sendSuccess, sendCreated, sendPaginated, sendNoContent } from '../../utils/apiResponse';
import type { ParkingService } from './parking.service';
import type {
  AllocateParkingSlotDto,
  CreateParkingAreaDto,
  CreateParkingSlotDto,
  ListParkingAreasQuery,
  ListParkingSlotsQuery,
  ParkingAvailabilityQuery,
  UpdateParkingAreaDto,
  UpdateParkingSlotDto,
} from './parking.dto';

export class ParkingController {
  constructor(private readonly service: ParkingService) {}

  listAreas = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const result = await this.service.listAreas(req.query as unknown as ListParkingAreasQuery);
      sendPaginated(res, result.data, result.meta.pagination);
    } catch (err) {
      next(err);
    }
  };

  getArea = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      sendSuccess(res, await this.service.getArea(req.params['id'] as string));
    } catch (err) {
      next(err);
    }
  };

  createArea = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      sendCreated(res, await this.service.createArea(req.body as CreateParkingAreaDto, req.user?.sub));
    } catch (err) {
      next(err);
    }
  };

  updateArea = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      sendSuccess(
        res,
        await this.service.updateArea(
          req.params['id'] as string,
          req.body as UpdateParkingAreaDto,
          req.user?.sub,
        ),
      );
    } catch (err) {
      next(err);
    }
  };

  deleteArea = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      await this.service.deleteArea(req.params['id'] as string, req.user?.sub);
      sendNoContent(res);
    } catch (err) {
      next(err);
    }
  };

  listSlots = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const result = await this.service.listSlots(req.query as unknown as ListParkingSlotsQuery);
      sendPaginated(res, result.data, result.meta.pagination);
    } catch (err) {
      next(err);
    }
  };

  getSlot = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      sendSuccess(res, await this.service.getSlot(req.params['id'] as string));
    } catch (err) {
      next(err);
    }
  };

  createSlot = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      sendCreated(res, await this.service.createSlot(req.body as CreateParkingSlotDto, req.user?.sub));
    } catch (err) {
      next(err);
    }
  };

  updateSlot = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      sendSuccess(
        res,
        await this.service.updateSlot(
          req.params['id'] as string,
          req.body as UpdateParkingSlotDto,
          req.user?.sub,
        ),
      );
    } catch (err) {
      next(err);
    }
  };

  archiveSlot = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      sendSuccess(res, await this.service.archiveSlot(req.params['id'] as string, req.user?.sub));
    } catch (err) {
      next(err);
    }
  };

  deleteSlot = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      await this.service.deleteSlot(req.params['id'] as string, req.user?.sub);
      sendNoContent(res);
    } catch (err) {
      next(err);
    }
  };

  allocateSlot = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      sendSuccess(
        res,
        await this.service.allocateSlot(
          req.params['id'] as string,
          req.body as AllocateParkingSlotDto,
          req.user?.sub,
        ),
      );
    } catch (err) {
      next(err);
    }
  };

  releaseSlot = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      sendSuccess(res, await this.service.releaseSlot(req.params['id'] as string, req.user?.sub));
    } catch (err) {
      next(err);
    }
  };

  getAvailability = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      sendSuccess(
        res,
        await this.service.getAvailability(req.query as unknown as ParkingAvailabilityQuery),
      );
    } catch (err) {
      next(err);
    }
  };
}
