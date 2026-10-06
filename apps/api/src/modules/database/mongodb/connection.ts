import mongoose from 'mongoose';
import { config } from '../../../config/env';
import { logger } from '../../../utils/logger';

export async function initializeMongoConnection(): Promise<void> {
  if (mongoose.connection.readyState === 1) {
    return;
  }

  try {
    await mongoose.connect(config.db.mongoUri, {
      autoIndex: true,
    });
    logger.info('MongoDB connected');
  } catch (err) {
    logger.warn('MongoDB not available. Audit logging will be disabled.', {
      err,
      mongoUri: config.db.mongoUri,
    });
  }
}
