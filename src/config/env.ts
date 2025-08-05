import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

interface EnvironmentConfig {
  // Application
  NODE_ENV: string;
  PORT: number;
  API_VERSION: string;
  
  // Database
  DATABASE_URL: string;
  REDIS_URL: string;
  
  // Supabase
  SUPABASE_URL: string | undefined;
  SUPABASE_ANON_KEY: string | undefined;
  SUPABASE_SERVICE_ROLE_KEY: string | undefined;
  
  // JWT
  JWT_SECRET: string;
  JWT_EXPIRES_IN: string;
  
  // Shopify
  SHOPIFY_WEBHOOK_SECRET: string;
  SHOPIFY_API_KEY: string;
  SHOPIFY_API_SECRET: string;
  SHOPIFY_SCOPES: string;
  
  // External APIs
  TCGPLAYER_API_KEY: string | undefined;
  TCGPLAYER_API_SECRET: string | undefined;
  BINDERPOS_API_URL: string | undefined;
  BINDERPOS_API_KEY: string | undefined;
  
  // eBay
  EBAY_CLIENT_ID: string | undefined;
  EBAY_CLIENT_SECRET: string | undefined;
  EBAY_SANDBOX: boolean;
  
  // ShipStation
  SHIPSTATION_API_KEY: string | undefined;
  SHIPSTATION_API_SECRET: string | undefined;
  
  // NATS
  NATS_URL: string;
  NATS_CLUSTER_ID: string;
  
  // Logging
  LOG_LEVEL: string;
  LOG_FORMAT: string;
  
  // Rate Limiting
  RATE_LIMIT_WINDOW_MS: number;
  RATE_LIMIT_MAX_REQUESTS: number;
  
  // File Upload
  MAX_FILE_SIZE_MB: number;
  UPLOAD_PATH: string;
  
  // Multi-tenancy
  DEFAULT_TENANT_ID: string;
  
  // Monitoring
  PROMETHEUS_PORT: number;
  HEALTH_CHECK_INTERVAL: number;
}

function validateEnv(): EnvironmentConfig {
  const requiredVars = [
    'DATABASE_URL',
    'JWT_SECRET',
    'SHOPIFY_WEBHOOK_SECRET',
    'SHOPIFY_API_KEY',
    'SHOPIFY_API_SECRET',
  ];
  
  const missing = requiredVars.filter(varName => !process.env[varName]);
  
  if (missing.length > 0) {
    throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
  }
  
  return {
    // Application
    NODE_ENV: process.env['NODE_ENV'] || 'development',
    PORT: parseInt(process.env['PORT'] || '3000', 10),
    API_VERSION: process.env['API_VERSION'] || 'v1',
    
    // Database
    DATABASE_URL: process.env['DATABASE_URL']!,
    REDIS_URL: process.env['REDIS_URL'] || 'redis://localhost:6379',
    
    // Supabase
    SUPABASE_URL: process.env['SUPABASE_URL'],
    SUPABASE_ANON_KEY: process.env['SUPABASE_ANON_KEY'],
    SUPABASE_SERVICE_ROLE_KEY: process.env['SUPABASE_SERVICE_ROLE_KEY'],
    
    // JWT
    JWT_SECRET: process.env['JWT_SECRET']!,
    JWT_EXPIRES_IN: process.env['JWT_EXPIRES_IN'] || '24h',
    
    // Shopify
    SHOPIFY_WEBHOOK_SECRET: process.env['SHOPIFY_WEBHOOK_SECRET']!,
    SHOPIFY_API_KEY: process.env['SHOPIFY_API_KEY']!,
    SHOPIFY_API_SECRET: process.env['SHOPIFY_API_SECRET']!,
    SHOPIFY_SCOPES: process.env['SHOPIFY_SCOPES'] || 'read_products,write_products,read_orders,write_orders,read_inventory,write_inventory,read_customers,write_customers',
    
    // External APIs
    TCGPLAYER_API_KEY: process.env['TCGPLAYER_API_KEY'],
    TCGPLAYER_API_SECRET: process.env['TCGPLAYER_API_SECRET'],
    BINDERPOS_API_URL: process.env['BINDERPOS_API_URL'],
    BINDERPOS_API_KEY: process.env['BINDERPOS_API_KEY'],
    
    // eBay
    EBAY_CLIENT_ID: process.env['EBAY_CLIENT_ID'],
    EBAY_CLIENT_SECRET: process.env['EBAY_CLIENT_SECRET'],
    EBAY_SANDBOX: process.env['EBAY_SANDBOX'] === 'true',
    
    // ShipStation
    SHIPSTATION_API_KEY: process.env['SHIPSTATION_API_KEY'],
    SHIPSTATION_API_SECRET: process.env['SHIPSTATION_API_SECRET'],
    
    // NATS
    NATS_URL: process.env['NATS_URL'] || 'nats://localhost:4222',
    NATS_CLUSTER_ID: process.env['NATS_CLUSTER_ID'] || 'cardstore-cluster',
    
    // Logging
    LOG_LEVEL: process.env['LOG_LEVEL'] || 'info',
    LOG_FORMAT: process.env['LOG_FORMAT'] || 'json',
    
    // Rate Limiting
    RATE_LIMIT_WINDOW_MS: parseInt(process.env['RATE_LIMIT_WINDOW_MS'] || '900000', 10),
    RATE_LIMIT_MAX_REQUESTS: parseInt(process.env['RATE_LIMIT_MAX_REQUESTS'] || '100', 10),
    
    // File Upload
    MAX_FILE_SIZE_MB: parseInt(process.env['MAX_FILE_SIZE_MB'] || '10', 10),
    UPLOAD_PATH: process.env['UPLOAD_PATH'] || './uploads',
    
    // Multi-tenancy
    DEFAULT_TENANT_ID: process.env['DEFAULT_TENANT_ID'] || 'default',
    
    // Monitoring
    PROMETHEUS_PORT: parseInt(process.env['PROMETHEUS_PORT'] || '9090', 10),
    HEALTH_CHECK_INTERVAL: parseInt(process.env['HEALTH_CHECK_INTERVAL'] || '30000', 10),
  };
}

export const env = validateEnv();
export default env;