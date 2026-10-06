import { Request, Response, NextFunction } from 'express';
import { sendCreated, sendSuccess, sendPaginated } from '../../utils/apiResponse';
import type { IoTService } from './iot.service';
import type { OperationalActionService } from './operational-action.service';
import type {
  CreateDeviceDto,
  ListDevicesQuery,
  ProposeActionDto,
  TelemetryPointDto,
  UpdateDeviceDto,
} from './iot.dto';

export class IoTController {
  constructor(
    private readonly service: IoTService,
    private readonly actionService: OperationalActionService,
  ) {}

  listDevices = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const result = await this.service.listDevices(req.query as unknown as ListDevicesQuery);
      sendPaginated(res, result.data, result.meta.pagination);
    } catch (err) {
      next(err);
    }
  };

  getDevice = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const device = await this.service.getDevice(req.params['id'] as string);
      sendSuccess(res, device);
    } catch (err) {
      next(err);
    }
  };

  getDeviceHealth = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const health = await this.service.getDeviceHealth(req.params['id'] as string);
      sendSuccess(res, health);
    } catch (err) {
      next(err);
    }
  };

  createDevice = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const device = await this.service.createDevice(req.body as CreateDeviceDto, req.user?.sub);
      sendCreated(res, device);
    } catch (err) {
      next(err);
    }
  };

  updateDevice = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const device = await this.service.updateDevice(
        req.params['id'] as string,
        req.body as UpdateDeviceDto,
        req.user?.sub,
      );
      sendSuccess(res, device);
    } catch (err) {
      next(err);
    }
  };

  archiveDevice = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const device = await this.service.archiveDevice(req.params['id'] as string, req.user?.sub);
      sendSuccess(res, device);
    } catch (err) {
      next(err);
    }
  };

  getSummary = async (_req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const summary = await this.service.getControlCenterSummary();
      sendSuccess(res, summary);
    } catch (err) {
      next(err);
    }
  };

  ingestTelemetry = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const body = req.body as TelemetryPointDto | { readings: TelemetryPointDto[] };
      const points = 'readings' in body && Array.isArray(body.readings) ? body.readings : [body as TelemetryPointDto];
      const result = await this.service.ingestTelemetry(points, {
        actorId: req.user?.sub,
        ingestKey: req.header('X-Device-Key') ?? undefined,
      });
      sendSuccess(res, result);
    } catch (err) {
      next(err);
    }
  };

  ingestDeviceTelemetry = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const deviceId = req.params['deviceId'] as string;
      const body = req.body as Omit<TelemetryPointDto, 'deviceId'> | { readings: Omit<TelemetryPointDto, 'deviceId'>[] };
      const raw =
        'readings' in body && Array.isArray(body.readings)
          ? body.readings.map((r) => ({ ...r, deviceId }))
          : [{ ...(body as Omit<TelemetryPointDto, 'deviceId'>), deviceId }];
      const result = await this.service.ingestTelemetry(raw, {
        actorId: req.user?.sub,
        deviceIdOverride: deviceId,
        ingestKey: req.header('X-Device-Key') ?? undefined,
      });
      sendSuccess(res, result);
    } catch (err) {
      next(err);
    }
  };

  getRecentTelemetry = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const data = await this.service.getRecentTelemetry(req.params['id'] as string);
      sendSuccess(res, data);
    } catch (err) {
      next(err);
    }
  };

  getOccupancyInsight = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const data = await this.service.getOccupancyInsight(req.params['roomId'] as string);
      sendSuccess(res, data);
    } catch (err) {
      next(err);
    }
  };

  getEnvironmentalSummary = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const data = await this.service.getEnvironmentalSummary(req.params['buildingId'] as string);
      sendSuccess(res, data);
    } catch (err) {
      next(err);
    }
  };

  listActions = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const query = req.query as { page?: string; limit?: string; status?: string };
      const result = await this.actionService.list({
        page: Number(query.page ?? 1),
        limit: Number(query.limit ?? 20),
        status: query.status as import('./operational-action.schema').ActionStatus | undefined,
      });
      sendPaginated(res, result.data, result.meta.pagination);
    } catch (err) {
      next(err);
    }
  };

  proposeAction = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const action = await this.actionService.propose(req.body as ProposeActionDto, req.user?.sub);
      sendCreated(res, action);
    } catch (err) {
      next(err);
    }
  };

  approveAction = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const action = await this.actionService.approve(req.params['id'] as string, req.user!.sub);
      sendSuccess(res, action);
    } catch (err) {
      next(err);
    }
  };

  rejectAction = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const action = await this.actionService.reject(
        req.params['id'] as string,
        req.user!.sub,
        (req.body as { reason?: string }).reason,
      );
      sendSuccess(res, action);
    } catch (err) {
      next(err);
    }
  };
}
