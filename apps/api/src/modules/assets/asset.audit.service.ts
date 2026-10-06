import { AuditLog } from '../database/mongodb/schemas/auditLog.schema';
import { createLogger } from '../../utils/logger';

const log = createLogger('AssetAuditService');

export interface AssetAuditEntry {
  actorId?: string;
  assetId: string;
  assetTag: string;
  action: 'createAsset' | 'updateAsset' | 'archiveAsset';
  details?: Record<string, unknown>;
}

export class AssetAuditService {
  async logAssetEvent(entry: AssetAuditEntry): Promise<void> {
    try {
      await AuditLog.create({
        actorId: entry.actorId ?? 'system',
        action: entry.action,
        entityName: 'Asset',
        entityId: entry.assetId,
        metadata: {
          assetTag: entry.assetTag,
          ...entry.details,
        },
      });
    } catch (err) {
      log.warn('Failed to persist asset audit record', { err, assetId: entry.assetId });
    }
  }
}
