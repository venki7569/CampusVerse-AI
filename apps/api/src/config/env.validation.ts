import { config } from './env';
import { createLogger } from '../utils/logger';

const log = createLogger('EnvValidation');

const INSECURE_JWT_MARKERS = ['CHANGE_ME', 'dev_access_secret', 'dev_refresh_secret', 'change_me'];

function isInsecureSecret(value: string): boolean {
  const normalized = value.toLowerCase();
  return INSECURE_JWT_MARKERS.some((marker) => normalized.includes(marker.toLowerCase()));
}

/**
 * Validates required production configuration at startup.
 * Development mode keeps optional services and demo secrets usable.
 */
export function validateEnvironment(): void {
  const errors: string[] = [];

  if (config.isProduction) {
    if (!process.env['POSTGRES_URI']) {
      errors.push('POSTGRES_URI is required in production');
    }
    if (!process.env['MONGODB_URI']) {
      errors.push('MONGODB_URI is required in production');
    }
    if (!process.env['JWT_ACCESS_SECRET'] || config.jwt.accessSecret.length < 32) {
      errors.push('JWT_ACCESS_SECRET must be at least 32 characters in production');
    }
    if (!process.env['JWT_REFRESH_SECRET'] || config.jwt.refreshSecret.length < 32) {
      errors.push('JWT_REFRESH_SECRET must be at least 32 characters in production');
    }
    if (isInsecureSecret(config.jwt.accessSecret) || isInsecureSecret(config.jwt.refreshSecret)) {
      errors.push('JWT secrets must not use default/demo values in production');
    }
    if (!process.env['CORS_ORIGIN']) {
      errors.push('CORS_ORIGIN must be set in production');
    }
  }

  if (errors.length > 0) {
    for (const message of errors) {
      log.error(message);
    }
    throw new Error(`Environment validation failed: ${errors.join('; ')}`);
  }

  if (config.isProduction && !config.gemini.apiKey) {
    log.warn('GEMINI_API_KEY not set — AI assistant will be unavailable');
  }

  if (config.isProduction && !process.env['REDIS_URI']) {
    log.warn('REDIS_URI not set — using in-memory cache and rate limits (single-instance only)');
  }

  if (config.occupancySimulation.enabled && config.isProduction) {
    log.error('OCCUPANCY_SIMULATION_ENABLED must not be true in production');
    throw new Error('Environment validation failed: occupancy simulation enabled in production');
  }

  log.info('Environment validation passed', {
    env: config.env,
    redisEnabled: config.redis.enabled,
    socketEnabled: config.socket.enabled,
    geminiConfigured: Boolean(config.gemini.apiKey),
    jwtFromEnv: Boolean(process.env['JWT_ACCESS_SECRET'] && process.env['JWT_REFRESH_SECRET']),
  });
}
