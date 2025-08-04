import { shopifyApi, ApiVersion, Session, LogSeverity } from '@shopify/shopify-api';
import { logger } from './logger';

// Initialize Shopify API configuration
export const shopify = shopifyApi({
  apiKey: process.env['SHOPIFY_API_KEY']!,
  apiSecretKey: process.env['SHOPIFY_API_SECRET']!,
  scopes: process.env['SHOPIFY_SCOPES']?.split(',') || [
    'read_products',
    'write_products',
    'read_orders',
    'write_orders',
    'read_inventory',
    'write_inventory',
    'read_customers',
    'write_customers'
  ],
  hostName: process.env['SHOPIFY_HOST_NAME'] || 'localhost:3005',
  apiVersion: ApiVersion.October23,
  isEmbeddedApp: false,
  logger: {
    level: LogSeverity.Info,
    httpRequests: true,
    timestamps: true,
    log: (severity: LogSeverity, message: string) => {
      switch (severity) {
        case LogSeverity.Error:
          logger.error(`Shopify API: ${message}`);
          break;
        case LogSeverity.Warning:
          logger.warn(`Shopify API: ${message}`);
          break;
        case LogSeverity.Info:
          logger.info(`Shopify API: ${message}`);
          break;
        case LogSeverity.Debug:
          logger.debug(`Shopify API: ${message}`);
          break;
        default:
          logger.info(`Shopify API: ${message}`);
      }
    }
  }
});

export interface ShopifyConfig {
  shop: string;
  accessToken: string;
}

/**
 * Create a Shopify session for API calls
 */
export function createShopifySession(config: ShopifyConfig): Session {
  return new Session({
    id: `${config.shop}_session`,
    shop: config.shop,
    state: 'authenticated',
    isOnline: false,
    accessToken: config.accessToken,
    scope: process.env['SHOPIFY_SCOPES'] || ''
  });
}

/**
 * Get Shopify REST client for a specific shop
 */
export function getShopifyRestClient(config: ShopifyConfig) {
  const session = createShopifySession(config);
  return new shopify.clients.Rest({ session });
}

/**
 * Get Shopify GraphQL client for a specific shop
 */
export function getShopifyGraphQLClient(config: ShopifyConfig) {
  const session = createShopifySession(config);
  return new shopify.clients.Graphql({ session });
}

/**
 * Validate Shopify configuration
 */
export function validateShopifyConfig(): boolean {
  const required = ['SHOPIFY_API_KEY', 'SHOPIFY_API_SECRET'];
  const missing = required.filter(key => !process.env[key]);
  
  if (missing.length > 0) {
    logger.error('Missing required Shopify configuration', { missing });
    return false;
  }
  
  return true;
}