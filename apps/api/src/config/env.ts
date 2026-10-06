import dotenv from 'dotenv';
dotenv.config();


function getEnv(name: string, fallback: string): string {
  return process.env[name] ?? fallback;
}

export const config = {
  port: parseInt(getEnv('PORT', '5000'), 10),
  env: getEnv('NODE_ENV', 'development'),
  isProduction: getEnv('NODE_ENV', 'development') === 'production',

  db: {
    postgresUri: getEnv('POSTGRES_URI', 'postgresql://user:password@localhost:5432/campusverse'),
    mongoUri: getEnv('MONGODB_URI', 'mongodb://localhost:27017/campusverse'),
    redisUri: getEnv('REDIS_URI', 'redis://localhost:6379'),
  },

  jwt: {
    accessSecret: getEnv('JWT_ACCESS_SECRET', 'dev_access_secret_CHANGE_ME'),
    refreshSecret: getEnv('JWT_REFRESH_SECRET', 'dev_refresh_secret_CHANGE_ME'),
    accessExpiresIn: getEnv('JWT_ACCESS_EXPIRES_IN', '15m'),
    refreshExpiresIn: getEnv('JWT_REFRESH_EXPIRES_IN', '7d'),
  },

  cors: {
    origin: getEnv('CORS_ORIGIN', 'http://localhost:5173'),
  },

  rateLimit: {
    windowMs: parseInt(getEnv('RATE_LIMIT_WINDOW_MS', '900000'), 10), // 15 min
    max: parseInt(getEnv('RATE_LIMIT_MAX', '100'), 10),
  },

  pagination: {
    defaultLimit: 20,
    maxLimit: 100,
  },

  occupancySimulation: {
    enabled: getEnv('OCCUPANCY_SIMULATION_ENABLED', 'false') === 'true',
    intervalMs: parseInt(getEnv('OCCUPANCY_SIMULATION_INTERVAL_MS', '30000'), 10),
  },

  seedAdmin: {
    email: getEnv('SEED_ADMIN_EMAIL', 'admin@campusverse.local'),
    password: process.env['SEED_ADMIN_PASSWORD'],
  },

  gemini: {
    apiKey: process.env['GEMINI_API_KEY'] ?? '',
    model: getEnv('GEMINI_MODEL', 'gemini-1.5-flash'),
    maxOutputTokens: parseInt(getEnv('GEMINI_MAX_OUTPUT_TOKENS', '1024'), 10),
    timeoutMs: parseInt(getEnv('GEMINI_TIMEOUT_MS', '30000'), 10),
  },

  ai: {
    maxHistoryMessages: parseInt(getEnv('AI_MAX_HISTORY_MESSAGES', '12'), 10),
    chatRateLimitWindowMs: parseInt(getEnv('AI_CHAT_RATE_LIMIT_WINDOW_MS', '900000'), 10),
    chatRateLimitMax: parseInt(getEnv('AI_CHAT_RATE_LIMIT_MAX', '30'), 10),
  },

  redis: {
    enabled: getEnv('REDIS_ENABLED', 'true') === 'true',
    connectTimeoutMs: parseInt(getEnv('REDIS_CONNECT_TIMEOUT_MS', '3000'), 10),
  },

  socket: {
    enabled: getEnv('SOCKET_ENABLED', 'true') === 'true',
    path: getEnv('SOCKET_PATH', '/socket.io'),
  },

  cache: {
    dashboardTtlSeconds: parseInt(getEnv('CACHE_DASHBOARD_TTL_SECONDS', '30'), 10),
    analyticsTtlSeconds: parseInt(getEnv('CACHE_ANALYTICS_TTL_SECONDS', '60'), 10),
    unreadCountTtlSeconds: parseInt(getEnv('CACHE_UNREAD_COUNT_TTL_SECONDS', '15'), 10),
    digitalTwinTtlSeconds: parseInt(getEnv('CACHE_DIGITAL_TWIN_TTL_SECONDS', '45'), 10),
  },

  intelligence: {
    utilityAnomalyThreshold: parseFloat(getEnv('UTILITY_ANOMALY_THRESHOLD', '1.5')),
    maintenanceRiskWindowDays: parseInt(getEnv('MAINTENANCE_RISK_WINDOW_DAYS', '90'), 10),
    recommendationCooldownHours: parseInt(getEnv('RECOMMENDATION_COOLDOWN_HOURS', '24'), 10),
  },

  iot: {
    staleThresholdMinutes: parseInt(getEnv('IOT_STALE_THRESHOLD_MINUTES', '15'), 10),
    offlineThresholdMinutes: parseInt(getEnv('IOT_OFFLINE_THRESHOLD_MINUTES', '30'), 10),
    maxTelemetryAgeDays: parseInt(getEnv('IOT_MAX_TELEMETRY_AGE_DAYS', '7'), 10),
    dedupTtlSeconds: parseInt(getEnv('IOT_DEDUP_TTL_SECONDS', '86400'), 10),
    deviceStateTtlSeconds: parseInt(getEnv('IOT_DEVICE_STATE_TTL_SECONDS', '300'), 10),
    alertCooldownSeconds: parseInt(getEnv('IOT_ALERT_COOLDOWN_SECONDS', '3600'), 10),
    utilityAnomalyMultiplier: parseFloat(getEnv('IOT_UTILITY_ANOMALY_MULTIPLIER', '2.0')),
    invalidReadingAlertThreshold: parseInt(getEnv('IOT_INVALID_READING_THRESHOLD', '5'), 10),
    temperatureHighC: parseFloat(getEnv('IOT_TEMP_HIGH_C', '30')),
    temperatureLowC: parseFloat(getEnv('IOT_TEMP_LOW_C', '16')),
    humidityHighPercent: parseFloat(getEnv('IOT_HUMIDITY_HIGH', '70')),
    humidityLowPercent: parseFloat(getEnv('IOT_HUMIDITY_LOW', '25')),
    airQualityHighIndex: parseFloat(getEnv('IOT_AQ_HIGH', '150')),
  },

  rateLimitAdmin: {
    windowMs: parseInt(getEnv('ADMIN_RATE_LIMIT_WINDOW_MS', '900000'), 10),
    max: parseInt(getEnv('ADMIN_RATE_LIMIT_MAX', '200'), 10),
  },

  rateLimitNotification: {
    windowMs: parseInt(getEnv('NOTIFICATION_RATE_LIMIT_WINDOW_MS', '900000'), 10),
    max: parseInt(getEnv('NOTIFICATION_RATE_LIMIT_MAX', '120'), 10),
  },
};
