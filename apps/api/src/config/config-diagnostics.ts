import { config } from './env';

export interface IntegrationStatus {
  configured: boolean;
  enabled: boolean;
  note?: string;
}

export interface ConfigDiagnosticsReport {
  timestamp: string;
  environment: string;
  isProduction: boolean;
  integrations: {
    postgres: IntegrationStatus;
    mongodb: IntegrationStatus;
    redis: IntegrationStatus;
    socket: IntegrationStatus;
    gemini: IntegrationStatus;
    googleAuth: IntegrationStatus;
    cloudinary: IntegrationStatus;
  };
  security: {
    jwtSecretsFromEnv: boolean;
    corsFromEnv: boolean;
    occupancySimulation: boolean;
  };
  rateLimits: {
    globalMax: number;
    authMax: number;
    aiChatMax: number;
    adminMax: number;
    notificationMax: number;
  };
}

function isEnvSet(name: string): boolean {
  const value = process.env[name];
  return typeof value === 'string' && value.trim().length > 0;
}

/**
 * Safe configuration summary — never includes secret values.
 */
export function getConfigDiagnostics(): ConfigDiagnosticsReport {
  const googleAuthEnabled =
    !config.isProduction || (isEnvSet('GOOGLE_CLIENT_ID') && isEnvSet('GOOGLE_AUTH_ENABLED'));

  return {
    timestamp: new Date().toISOString(),
    environment: config.env,
    isProduction: config.isProduction,
    integrations: {
      postgres: {
        configured: isEnvSet('POSTGRES_URI'),
        enabled: true,
        note: config.isProduction && !isEnvSet('POSTGRES_URI') ? 'required in production' : undefined,
      },
      mongodb: {
        configured: isEnvSet('MONGODB_URI'),
        enabled: true,
        note: config.isProduction && !isEnvSet('MONGODB_URI') ? 'required in production' : undefined,
      },
      redis: {
        configured: isEnvSet('REDIS_URI'),
        enabled: config.redis.enabled,
        note: config.redis.enabled ? 'optional — graceful degradation when unavailable' : 'disabled via REDIS_ENABLED',
      },
      socket: {
        configured: true,
        enabled: config.socket.enabled,
      },
      gemini: {
        configured: isEnvSet('GEMINI_API_KEY'),
        enabled: Boolean(config.gemini.apiKey),
        note: config.gemini.apiKey ? undefined : 'AI assistant unavailable without GEMINI_API_KEY',
      },
      googleAuth: {
        configured: isEnvSet('GOOGLE_CLIENT_ID'),
        enabled: googleAuthEnabled,
        note: config.isProduction && !googleAuthEnabled
          ? 'mock Google OAuth disabled in production'
          : 'development mock OAuth only',
      },
      cloudinary: {
        configured:
          isEnvSet('CLOUDINARY_CLOUD_NAME') &&
          isEnvSet('CLOUDINARY_API_KEY') &&
          isEnvSet('CLOUDINARY_API_SECRET'),
        enabled: false,
        note: 'not wired — reserved for future file uploads',
      },
    },
    security: {
      jwtSecretsFromEnv: isEnvSet('JWT_ACCESS_SECRET') && isEnvSet('JWT_REFRESH_SECRET'),
      corsFromEnv: isEnvSet('CORS_ORIGIN'),
      occupancySimulation: config.occupancySimulation.enabled && !config.isProduction,
    },
    rateLimits: {
      globalMax: config.rateLimit.max,
      authMax: 10,
      aiChatMax: config.ai.chatRateLimitMax,
      adminMax: config.rateLimitAdmin.max,
      notificationMax: config.rateLimitNotification.max,
    },
  };
}
