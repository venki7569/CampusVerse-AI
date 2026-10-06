import { OperationalAction, type ActionStatus } from './operational-action.schema';
import { AppError } from '../../utils/AppError';
import { buildPaginationMeta } from '../../utils/pagination';
import type { ProposeActionDto } from './iot.dto';
import type { IoTAuditService } from './iot.audit.service';
import { iotEvents } from './iot.events';
import type { PaginatedResult } from '../../types';
import type { PrismaClient } from '@prisma/client';

export class OperationalActionService {
  constructor(
    private readonly db: PrismaClient,
    private readonly audit: IoTAuditService,
  ) {}

  async list(query: { page: number; limit: number; status?: ActionStatus }) {
    const filter = query.status ? { status: query.status } : {};
    const skip = (query.page - 1) * query.limit;
    const [data, total] = await Promise.all([
      OperationalAction.find(filter).sort({ createdAt: -1 }).skip(skip).limit(query.limit).lean(),
      OperationalAction.countDocuments(filter),
    ]);
    return {
      data,
      meta: { pagination: buildPaginationMeta(total, query.page, query.limit) },
    } as PaginatedResult<(typeof data)[0]>;
  }

  async propose(dto: ProposeActionDto, actorId?: string) {
    if (dto.dedupeKey) {
      const existing = await OperationalAction.findOne({
        dedupeKey: dto.dedupeKey,
        status: { $in: ['PROPOSED', 'APPROVED', 'EXECUTING'] },
      }).lean();
      if (existing) return existing;
    }

    const action = await OperationalAction.create({
      ...dto,
      status: 'PROPOSED',
      proposedBy: actorId,
      evidence: dto.evidence ?? {},
    });

    await this.audit.logEvent({
      actorId,
      action: 'actionProposed',
      resourceType: 'operational_action',
      resourceId: String(action._id),
      details: { type: dto.type, affectedEntity: dto.affectedEntity },
    });

    iotEvents.emit('action.proposed', {
      timestamp: new Date().toISOString(),
      actionId: String(action._id),
      metadata: { type: dto.type },
    });

    return action;
  }

  async approve(id: string, actorId: string) {
    const action = await OperationalAction.findById(id);
    if (!action) throw AppError.notFound('Operational action');
    if (action.status !== 'PROPOSED') {
      throw AppError.badRequest(`Cannot approve action in status ${action.status}`);
    }

    action.status = 'APPROVED';
    action.approvedBy = actorId;
    await action.save();

    await this.audit.logEvent({
      actorId,
      action: 'actionApproved',
      resourceType: 'operational_action',
      resourceId: id,
    });

    iotEvents.emit('action.approved', { timestamp: new Date().toISOString(), actionId: id });

    return this.execute(action, actorId);
  }

  async reject(id: string, actorId: string, reason?: string) {
    const action = await OperationalAction.findById(id);
    if (!action) throw AppError.notFound('Operational action');
    if (action.status !== 'PROPOSED') {
      throw AppError.badRequest(`Cannot reject action in status ${action.status}`);
    }

    action.status = 'CANCELLED';
    action.rejectedBy = actorId;
    action.result = reason ?? 'Rejected by operator';
    await action.save();

    await this.audit.logEvent({
      actorId,
      action: 'actionRejected',
      resourceType: 'operational_action',
      resourceId: id,
      details: { reason },
    });

    return action;
  }

  private async execute(action: InstanceType<typeof OperationalAction>, actorId: string) {
    action.status = 'EXECUTING';
    action.executedBy = actorId;
    await action.save();

    try {
      let result = 'Action completed';
      if (action.type === 'CREATE_MAINTENANCE_REQUEST') {
        const req = await this.db.maintenanceRequest.create({
          data: {
            reporterId: actorId,
            title: action.title,
            description: action.description,
            priority: 'MEDIUM',
            status: 'REPORTED',
            ...(action.affectedEntity.type === 'room' ? { roomId: action.affectedEntity.id } : {}),
            ...(action.affectedEntity.type === 'asset' ? { assetId: action.affectedEntity.id } : {}),
          },
        });
        result = `Maintenance request ${req.id} created`;
      } else if (action.type === 'MARK_DEVICE_INSPECTION' && action.affectedEntity.type === 'device') {
        await this.db.ioTDevice.update({
          where: { id: action.affectedEntity.id },
          data: { status: 'MAINTENANCE' },
        });
        result = 'Device marked for inspection';
      }

      action.status = 'COMPLETED';
      action.result = result;
      await action.save();

      await this.audit.logEvent({
        actorId,
        action: 'actionCompleted',
        resourceType: 'operational_action',
        resourceId: String(action._id),
        details: { result },
      });

      iotEvents.emit('action.completed', {
        timestamp: new Date().toISOString(),
        actionId: String(action._id),
      });

      return action;
    } catch (err) {
      action.status = 'FAILED';
      action.result = err instanceof Error ? err.message : 'Execution failed';
      await action.save();
      throw AppError.internal('Action execution failed');
    }
  }
}
