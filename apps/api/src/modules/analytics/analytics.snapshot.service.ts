import { createLogger } from '../../utils/logger';
import { AnalyticsSnapshot } from '../database/mongodb/schemas/analyticsSnapshot.schema';
import type { ResolvedDateRange } from './analytics.dto';

const log = createLogger('AnalyticsSnapshotService');

/**
 * Optional MongoDB snapshot persistence for generated reports.
 * Live aggregation remains the primary analytics source; snapshots are written
 * on report generation only to avoid uncontrolled growth.
 */
export class AnalyticsSnapshotService {
  async saveReportSnapshot(
    category: string,
    range: ResolvedDateRange,
    payload: Record<string, unknown>,
  ): Promise<void> {
    try {
      const metricKeys = Object.keys(payload);
      for (const metricName of metricKeys) {
        const value =
          typeof payload[metricName] === 'object' && payload[metricName] !== null
            ? Object.keys(payload[metricName] as object).length
            : 1;
        await AnalyticsSnapshot.findOneAndUpdate(
          {
            metricName: `report.${category}.${metricName}`,
            dimension: 'campus',
            period: 'daily',
            startDate: range.from,
          },
          {
            $set: {
              endDate: range.to,
              value,
              metadata: { category, snapshotAt: new Date().toISOString() },
            },
          },
          { upsert: true },
        );
      }
      log.info(`Saved analytics report snapshot for ${category}`);
    } catch (err) {
      log.warn('Failed to save analytics snapshot (non-fatal)', { err, category });
    }
  }
}
