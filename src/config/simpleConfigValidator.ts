/**
 * Simple Configuration Validator
 * Runtime configuration validation without external dependencies
 */

import { logger } from './logger';

export interface ValidatedConfig {
  NODE_ENV: string;
  PORT: number;
  API_VERSION: string;
  DATABASE_URL: string;
  REDIS_URL?: string;
  JWT_SECRET: string;
  JWT_EXPIRES_IN: string;
  SUPABASE_URL?: string;
  SUPABASE_ANON_KEY?: string;
  SUPABASE_SERVICE_ROLE_KEY?: string;
  SHOPIFY_WEBHOOK_SECRET?: string;
  SHOPIFY_API_KEY?: string;
  SHOPIFY_API_SECRET?: string;
  SHOPIFY_SCOPES?: string;
  LOG_LEVEL: string;
  LOG_FORMAT: string;
  RATE_LIMIT_WINDOW_MS: number;
  RATE_LIMIT_MAX_REQUESTS: number;
  MAX_FILE_SIZE_MB: number;
  UPLOAD_PATH: string;
  DEFAULT_TENANT_ID: string;
  PROMETHEUS_PORT: number;
  HEALTH_CHECK_INTERVAL: number;
  CORS_ORIGIN?: string;
}

class ConfigValidationError extends Error {
  constructor(message: string, public errors: string[]) {
    super(message);
    this.name = 'ConfigValidationError';
  }
}

function validateRequired(value: any, name: string): void {
  if (value === undefined || value === null || value === '') {
    throw new Error(`${name} is required`);
  }
}

function validateNumber(value: any, name: string, min?: number, max?: number): number {
  const num = Number(value);
  if (isNaN(num)) {
    throw new Error(`${name} must be a valid number`);
  }
  if (min !== undefined && num < min) {
    throw new Error(`${name} must be at least ${min}`);
  }
  if (max !== undefined && num > max) {
    throw new Error(`${name} must be at most ${max}`);
  }
  return num;
}

function validateUrl(value: any, name: string): string {
  if (!value) return value;
  try {
    new URL(value);
    return value;
  } catch {
    throw new Error(`${name} must be a valid URL`);
  }
}

function validateEnum(value: any, name: string, allowedValues: string[]): string {
  if (value && !allowedValues.includes(value)) {
    throw new Error(`${name} must be one of: ${allowedValues.join(', ')}`);
  }
  return value;
}

export function validateConfig(): ValidatedConfig {
  const errors: string[] = [];
  const env = process.env;

  try {
    // Required fields
    validateRequired(env['DATABASE_URL'], 'DATABASE_URL');
    validateRequired(env['JWT_SECRET'], 'JWT_SECRET');

    // Validate NODE_ENV
    const nodeEnv = env['NODE_ENV'] || 'development';
    validateEnum(nodeEnv, 'NODE_ENV', ['development', 'test', 'production']);

    // Validate PORT
    const port = validateNumber(env['PORT'] || '3005', 'PORT', 1000, 65535);

    // Validate database URL
    const databaseUrl = validateUrl(env['DATABASE_URL'], 'DATABASE_URL');

    // Validate JWT secret strength
    const jwtSecret = env['JWT_SECRET']!;
    if (nodeEnv === 'production' && jwtSecret.length < 64) {
      errors.push('JWT_SECRET must be at least 64 characters in production');
    } else if (jwtSecret.length < 16) {
      errors.push('JWT_SECRET must be at least 16 characters');
    }

    // Validate optional URLs
    const redisUrl = env['REDIS_URL'] ? validateUrl(env['REDIS_URL'], 'REDIS_URL') : undefined;
    const supabaseUrl = env['SUPABASE_URL'] ? validateUrl(env['SUPABASE_URL'], 'SUPABASE_URL') : undefined;

    // Production-specific validations
    if (nodeEnv === 'production') {
      if (!redisUrl) {
        errors.push('REDIS_URL is required in production');
      }
      if (!supabaseUrl || !env['SUPABASE_ANON_KEY'] || !env['SUPABASE_SERVICE_ROLE_KEY']) {
        errors.push('Supabase configuration is required in production');
      }
      if (!env['CORS_ORIGIN']) {
        errors.push('CORS_ORIGIN is required in production');
      }
    }

    // Validate numeric fields
    const rateLimitWindowMs = validateNumber(env['RATE_LIMIT_WINDOW_MS'] || '900000', 'RATE_LIMIT_WINDOW_MS', 1000);
    const rateLimitMaxRequests = validateNumber(env['RATE_LIMIT_MAX_REQUESTS'] || '100', 'RATE_LIMIT_MAX_REQUESTS', 1, 10000);
    const maxFileSizeMB = validateNumber(env['MAX_FILE_SIZE_MB'] || '10', 'MAX_FILE_SIZE_MB', 1, 100);
    const prometheusPort = validateNumber(env['PROMETHEUS_PORT'] || '9090', 'PROMETHEUS_PORT', 1000, 65535);
    const healthCheckInterval = validateNumber(env['HEALTH_CHECK_INTERVAL'] || '30000', 'HEALTH_CHECK_INTERVAL', 1000);

    // Validate port conflicts
    if (port === prometheusPort) {
      errors.push('PORT and PROMETHEUS_PORT cannot be the same');
    }

    // Validate log level
    const logLevel = validateEnum(env['LOG_LEVEL'] || 'info', 'LOG_LEVEL', ['error', 'warn', 'info', 'debug']);
    const logFormat = validateEnum(env['LOG_FORMAT'] || 'json', 'LOG_FORMAT', ['json', 'console']);

    if (errors.length > 0) {
      throw new ConfigValidationError('Configuration validation failed', errors);
    }

    const config: ValidatedConfig = {
      NODE_ENV: nodeEnv,
      PORT: port,
      API_VERSION: env['API_VERSION'] || 'v1',
      DATABASE_URL: databaseUrl,
      REDIS_URL: redisUrl,
      JWT_SECRET: jwtSecret,
      JWT_EXPIRES_IN: env['JWT_EXPIRES_IN'] || '24h',
      SUPABASE_URL: supabaseUrl,
      SUPABASE_ANON_KEY: env['SUPABASE_ANON_KEY'],
      SUPABASE_SERVICE_ROLE_KEY: env['SUPABASE_SERVICE_ROLE_KEY'],
      SHOPIFY_WEBHOOK_SECRET: env['SHOPIFY_WEBHOOK_SECRET'],
      SHOPIFY_API_KEY: env['SHOPIFY_API_KEY'],
      SHOPIFY_API_SECRET: env['SHOPIFY_API_SECRET'],
      SHOPIFY_SCOPES: env['SHOPIFY_SCOPES'],
      LOG_LEVEL: logLevel,
      LOG_FORMAT: logFormat,
      RATE_LIMIT_WINDOW_MS: rateLimitWindowMs,
      RATE_LIMIT_MAX_REQUESTS: rateLimitMaxRequests,
      MAX_FILE_SIZE_MB: maxFileSizeMB,
      UPLOAD_PATH: env['UPLOAD_PATH'] || './uploads',
      DEFAULT_TENANT_ID: env['DEFAULT_TENANT_ID'] || 'default',
      PROMETHEUS_PORT: prometheusPort,
      HEALTH_CHECK_INTERVAL: healthCheckInterval,
      CORS_ORIGIN: env['CORS_ORIGIN']
    };

    logger.info('Configuration validated successfully', {
      environment: config.NODE_ENV,
      port: config.PORT,
      apiVersion: config.API_VERSION,
      logLevel: config.LOG_LEVEL
    });

    return config;

  } catch (error) {
    if (error instanceof ConfigValidationError) {
      logger.error('Configuration validation failed', {
        errors: error.errors
      });
      throw new Error(`Configuration validation failed:\n${error.errors.join('\n')}`);
    }

    if (error instanceof Error) {
      errors.push(error.message);
    }

    logger.error('Configuration validation failed', { errors });
    throw new Error(`Configuration validation failed:\n${errors.join('\n')}`);
  }
}

// Simple configuration manager
export class SimpleConfigManager {
  private static instance: SimpleConfigManager;
  private config: ValidatedConfig;

  private constructor() {
    this.config = validateConfig();
  }

  static getInstance(): SimpleConfigManager {
    if (!SimpleConfigManager.instance) {
      SimpleConfigManager.instance = new SimpleConfigManager();
    }
    return SimpleConfigManager.instance;
  }

  getConfig(): ValidatedConfig {
    return this.config;
  }

  reloadConfig(): void {
    try {
      this.config = validateConfig();
      logger.info('Configuration reloaded successfully');
    } catch (error) {
      logger.error('Configuration reload failed', { error });
      throw error;
    }
  }

  // Get specific configuration sections
  getDatabaseConfig() {
    return {
      url: this.config.DATABASE_URL,
      redisUrl: this.config.REDIS_URL
    };
  }

  getAuthConfig() {
    return {
      jwtSecret: this.config.JWT_SECRET,
      jwtExpiresIn: this.config.JWT_EXPIRES_IN,
      supabaseUrl: this.config.SUPABASE_URL,
      supabaseAnonKey: this.config.SUPABASE_ANON_KEY,
      supabaseServiceRoleKey: this.config.SUPABASE_SERVICE_ROLE_KEY
    };
  }

  getSecurityConfig() {
    return {
      corsOrigin: this.config.CORS_ORIGIN,
      rateLimitWindowMs: this.config.RATE_LIMIT_WINDOW_MS,
      rateLimitMaxRequests: this.config.RATE_LIMIT_MAX_REQUESTS,
      maxFileSizeMB: this.config.MAX_FILE_SIZE_MB
    };
  }
}

// Export singleton instance
export const configManager = SimpleConfigManager.getInstance();
export const validatedConfig = configManager.getConfig();