/**
 * Configuration Validator
 * Comprehensive runtime configuration validation and type safety
 */

import { logger } from './logger';

// Simple validation types
interface ValidationRule {
  required?: boolean;
  type?: 'string' | 'number' | 'boolean' | 'url';
  min?: number;
  max?: number;
  enum?: string[];
  default?: any;
}

interface ValidationSchema {
  [key: string]: ValidationRule;
}

// Environment-specific schemas
const developmentSchema: ValidationSchema = {
  NODE_ENV: { required: true, enum: ['development'] },
  PORT: { type: 'number', min: 1000, max: 65535, default: 3005 },
  API_VERSION: { type: 'string', default: 'v1' },
  
  // Database (required)
  DATABASE_URL: { required: true, type: 'url' },
  REDIS_URL: { type: 'url' },
  
  // JWT (required)
  JWT_SECRET: { required: true, type: 'string', min: 32 },
  JWT_EXPIRES_IN: { type: 'string', default: '24h' },
  
  // Supabase (optional in development)
  SUPABASE_URL: { type: 'url' },
  SUPABASE_ANON_KEY: { type: 'string' },
  SUPABASE_SERVICE_ROLE_KEY: { type: 'string' },
  
  // External APIs (optional in development)
  SHOPIFY_WEBHOOK_SECRET: { type: 'string' },
  SHOPIFY_API_KEY: { type: 'string' },
  SHOPIFY_API_SECRET: { type: 'string' },
  SHOPIFY_SCOPES: { type: 'string' },
  
  TCGPLAYER_API_KEY: { type: 'string' },
  TCGPLAYER_API_SECRET: { type: 'string' },
  BINDERPOS_API_URL: { type: 'url' },
  BINDERPOS_API_KEY: { type: 'string' },
  
  EBAY_CLIENT_ID: { type: 'string' },
  EBAY_CLIENT_SECRET: { type: 'string' },
  EBAY_SANDBOX: { type: 'boolean', default: true },
  
  SHIPSTATION_API_KEY: { type: 'string' },
  SHIPSTATION_API_SECRET: { type: 'string' },
  
  // NATS
  NATS_URL: { type: 'url', default: 'nats://localhost:4222' },
  NATS_CLUSTER_ID: { type: 'string', default: 'cardstore-cluster' },
  
  // Logging
  LOG_LEVEL: { enum: ['error', 'warn', 'info', 'debug'], default: 'debug' },
  LOG_FORMAT: { enum: ['json', 'console'], default: 'console' },
  
  // Rate Limiting
  RATE_LIMIT_WINDOW_MS: { type: 'number', min: 1000, default: 900000 },
  RATE_LIMIT_MAX_REQUESTS: { type: 'number', min: 1, default: 1000 },
  
  // File Upload
  MAX_FILE_SIZE_MB: { type: 'number', min: 1, max: 100, default: 10 },
  UPLOAD_PATH: { type: 'string', default: './uploads' },
  
  // Multi-tenancy
  DEFAULT_TENANT_ID: { type: 'string', default: 'default' },
  
  // Monitoring
  PROMETHEUS_PORT: { type: 'number', min: 1000, max: 65535, default: 9090 },
  HEALTH_CHECK_INTERVAL: { type: 'number', min: 1000, default: 30000 },
  
  // CORS
  CORS_ORIGIN: { type: 'string' },
};

// Configuration type
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
  TCGPLAYER_API_KEY?: string;
  TCGPLAYER_API_SECRET?: string;
  BINDERPOS_API_URL?: string;
  BINDERPOS_API_KEY?: string;
  EBAY_CLIENT_ID?: string;
  EBAY_CLIENT_SECRET?: string;
  EBAY_SANDBOX: boolean;
  SHIPSTATION_API_KEY?: string;
  SHIPSTATION_API_SECRET?: string;
  NATS_URL: string;
  NATS_CLUSTER_ID: string;
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

// Simple validation function
function validateSchema(env: NodeJS.ProcessEnv, schema: ValidationSchema): ValidatedConfig {
  const result: any = {};
  const errors: string[] = [];

  for (const [key, rule] of Object.entries(schema)) {
    const value = env[key];
    
    // Check required fields
    if (rule.required && (!value || value.trim() === '')) {
      errors.push(`${key} is required`);
      continue;
    }
    
    // Use default if no value provided
    if (!value && rule.default !== undefined) {
      result[key] = rule.default;
      continue;
    }
    
    // Skip validation if value is empty and not required
    if (!value) {
      continue;
    }
    
    // Type validation
    switch (rule.type) {
      case 'number':
        const num = parseInt(value, 10);
        if (isNaN(num)) {
          errors.push(`${key} must be a number`);
          continue;
        }
        if (rule.min !== undefined && num < rule.min) {
          errors.push(`${key} must be at least ${rule.min}`);
          continue;
        }
        if (rule.max !== undefined && num > rule.max) {
          errors.push(`${key} must be at most ${rule.max}`);
          continue;
        }
        result[key] = num;
        break;
        
      case 'boolean':
        result[key] = value.toLowerCase() === 'true';
        break;
        
      case 'url':
        try {
          new URL(value);
          result[key] = value;
        } catch {
          errors.push(`${key} must be a valid URL`);
        }
        break;
        
      case 'string':
      default:
        if (rule.min !== undefined && value.length < rule.min) {
          errors.push(`${key} must be at least ${rule.min} characters`);
          continue;
        }
        if (rule.max !== undefined && value.length > rule.max) {
          errors.push(`${key} must be at most ${rule.max} characters`);
          continue;
        }
        result[key] = value;
        break;
    }
    
    // Enum validation
    if (rule.enum && !rule.enum.includes(result[key])) {
      errors.push(`${key} must be one of: ${rule.enum.join(', ')}`);
    }
  }
  
  if (errors.length > 0) {
    throw new Error(`Configuration validation failed:\n${errors.join('\n')}`);
  }
  
  return result as ValidatedConfig;
}

// Validation function
export function validateConfig(): ValidatedConfig {
  const nodeEnv = process.env['NODE_ENV'] || 'development';
  
  try {
    const config = validateSchema(process.env, developmentSchema);
    
    // Additional validation logic
    validateAdditionalRules(config);
    
    logger.info('Configuration validated successfully', {
      environment: nodeEnv,
      port: config.PORT,
      apiVersion: config.API_VERSION,
      logLevel: config.LOG_LEVEL
    });
    
    return config;
  } catch (error) {
    logger.error('Configuration validation failed', {
      environment: nodeEnv,
      error: error instanceof Error ? error.message : String(error)
    });
    
    throw error;
  }
}

// Additional validation rules
function validateAdditionalRules(config: ValidatedConfig): void {
  // Validate JWT secret strength
  if (config.NODE_ENV === 'production' && config.JWT_SECRET.length < 64) {
    throw new Error('JWT_SECRET must be at least 64 characters in production');
  }

  // Validate database URL format
  if (config.NODE_ENV === 'production' && !config.DATABASE_URL.includes('postgresql://')) {
    throw new Error('DATABASE_URL must be a PostgreSQL connection string in production');
  }

  // Validate CORS origins in production
  if (config.NODE_ENV === 'production' && !config.CORS_ORIGIN) {
    throw new Error('CORS_ORIGIN is required in production');
  }

  // Validate Redis URL in production
  if (config.NODE_ENV === 'production' && !config.REDIS_URL) {
    throw new Error('REDIS_URL is required in production');
  }

  // Validate Supabase configuration in production
  if (config.NODE_ENV === 'production') {
    if (!config.SUPABASE_URL || !config.SUPABASE_ANON_KEY || !config.SUPABASE_SERVICE_ROLE_KEY) {
      throw new Error('Supabase configuration is required in production');
    }
  }

  // Validate port conflicts
  if (config.PORT === config.PROMETHEUS_PORT) {
    throw new Error('PORT and PROMETHEUS_PORT cannot be the same');
  }

  // Validate file upload limits
  if (config.MAX_FILE_SIZE_MB > 100) {
    throw new Error('MAX_FILE_SIZE_MB cannot exceed 100MB');
  }

  // Validate rate limiting
  if (config.RATE_LIMIT_MAX_REQUESTS > 10000) {
    throw new Error('RATE_LIMIT_MAX_REQUESTS cannot exceed 10000');
  }
}

// Configuration hot-reload support
export class ConfigManager {
  private static instance: ConfigManager;
  private config: ValidatedConfig;
  private watchers: Array<(config: ValidatedConfig) => void> = [];

  private constructor() {
    this.config = validateConfig();
  }

  static getInstance(): ConfigManager {
    if (!ConfigManager.instance) {
      ConfigManager.instance = new ConfigManager();
    }
    return ConfigManager.instance;
  }

  getConfig(): ValidatedConfig {
    return this.config;
  }

  reloadConfig(): void {
    try {
      const newConfig = validateConfig();
      this.config = newConfig;

      logger.info('Configuration reloaded successfully');

      // Notify watchers
      this.watchers.forEach(watcher => {
        try {
          watcher(newConfig);
        } catch (error) {
          logger.error('Configuration watcher error', { error });
        }
      });
    } catch (error) {
      logger.error('Configuration reload failed', { error });
      throw error;
    }
  }

  onConfigChange(callback: (config: ValidatedConfig) => void): void {
    this.watchers.push(callback);
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

  getExternalApiConfig() {
    return {
      shopify: {
        webhookSecret: this.config.SHOPIFY_WEBHOOK_SECRET,
        apiKey: this.config.SHOPIFY_API_KEY,
        apiSecret: this.config.SHOPIFY_API_SECRET,
        scopes: this.config.SHOPIFY_SCOPES
      },
      tcgplayer: {
        apiKey: this.config.TCGPLAYER_API_KEY,
        apiSecret: this.config.TCGPLAYER_API_SECRET
      },
      binderpos: {
        apiUrl: this.config.BINDERPOS_API_URL,
        apiKey: this.config.BINDERPOS_API_KEY
      },
      ebay: {
        clientId: this.config.EBAY_CLIENT_ID,
        clientSecret: this.config.EBAY_CLIENT_SECRET,
        sandbox: this.config.EBAY_SANDBOX
      },
      shipstation: {
        apiKey: this.config.SHIPSTATION_API_KEY,
        apiSecret: this.config.SHIPSTATION_API_SECRET
      }
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
export const configManager = ConfigManager.getInstance();
export const config = configManager.getConfig();