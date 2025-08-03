import { Router, Request, Response } from 'express';
import crypto from 'crypto';
import { PrismaClient } from '@prisma/client';
import { env } from '../config/env';
import { logger } from '../config/logger';
import { asyncHandler } from '../middleware/errorHandler';
import { ProductService } from '../services/productService';

const router = Router();
const prisma = new PrismaClient();
const productService = new ProductService(prisma);

// Helper function to extract tenant ID from shop domain
const extractTenantFromShopDomain = (shopDomain: string): string | null => {
  if (!shopDomain) return null;
  
  // For development, we'll use a simple mapping
  // In production, this would query the database to find the tenant by shop domain
  const domainToTenant: Record<string, string> = {
    'test-shop.myshopify.com': 'test-tenant',
    'demo-shop.myshopify.com': 'demo-tenant',
  };
  
  return domainToTenant[shopDomain] || null;
};

// Middleware to verify Shopify webhook signature
const verifyShopifyWebhook = (req: Request, res: Response, next: any) => {
  // Development bypass
  if (env.NODE_ENV === 'development' && req.get('X-Shopify-Hmac-Sha256') === 'dev-bypass') {
    logger.debug('Development webhook signature bypass');
    return next();
  }

  const hmac = req.get('X-Shopify-Hmac-Sha256');
  const body = JSON.stringify(req.body);
  const hash = crypto
    .createHmac('sha256', env.SHOPIFY_WEBHOOK_SECRET)
    .update(body, 'utf8')
    .digest('base64');

  if (hash !== hmac) {
    logger.warn('Invalid Shopify webhook signature', {
      receivedHmac: hmac,
      calculatedHash: hash,
    });
    return res.status(401).json({
      error: {
        code: 'INVALID_SIGNATURE',
        message: 'Invalid webhook signature',
        timestamp: new Date().toISOString(),
        requestId: req.headers['x-request-id'] || '',
      },
    });
  }

  next();
};

// Shopify product webhooks
router.post('/shopify/products/create', verifyShopifyWebhook, asyncHandler(async (req: Request, res: Response) => {
  const shopifyProduct = req.body;
  logger.info('Shopify product created webhook received', { productId: shopifyProduct.id });

  try {
    // Extract tenant ID from shop domain or use default
    const tenantId = extractTenantFromShopDomain(req.headers['x-shopify-shop-domain'] as string) || 'test-tenant';
    
    // Sync product from Shopify
    const product = await productService.syncFromShopify(tenantId, shopifyProduct.id.toString(), shopifyProduct);
    
    logger.info('Shopify product synced successfully', {
      productId: product.id,
      shopifyProductId: shopifyProduct.id,
      tenantId
    });
    
    res.status(200).json({ received: true, productId: product.id });
  } catch (error) {
    logger.error('Failed to sync Shopify product', {
      error,
      shopifyProductId: shopifyProduct.id
    });
    res.status(500).json({ error: 'Failed to sync product' });
  }
}));

router.post('/shopify/products/update', verifyShopifyWebhook, asyncHandler(async (req: Request, res: Response) => {
  const shopifyProduct = req.body;
  logger.info('Shopify product updated webhook received', { productId: shopifyProduct.id });

  try {
    // Extract tenant ID from shop domain or use default
    const tenantId = extractTenantFromShopDomain(req.headers['x-shopify-shop-domain'] as string) || 'test-tenant';
    
    // Sync updated product from Shopify
    const product = await productService.syncFromShopify(tenantId, shopifyProduct.id.toString(), shopifyProduct);
    
    logger.info('Shopify product updated successfully', {
      productId: product.id,
      shopifyProductId: shopifyProduct.id,
      tenantId
    });
    
    res.status(200).json({ received: true, productId: product.id });
  } catch (error) {
    logger.error('Failed to update Shopify product', {
      error,
      shopifyProductId: shopifyProduct.id
    });
    res.status(500).json({ error: 'Failed to update product' });
  }
}));

router.post('/shopify/products/delete', verifyShopifyWebhook, asyncHandler(async (req: Request, res: Response) => {
  const shopifyProduct = req.body;
  logger.info('Shopify product deleted webhook received', { productId: shopifyProduct.id });

  try {
    // Extract tenant ID from shop domain or use default
    const tenantId = extractTenantFromShopDomain(req.headers['x-shopify-shop-domain'] as string) || 'test-tenant';
    
    // Find and delete the product
    const existingProduct = await prisma.product.findFirst({
      where: {
        tenantId,
        shopifyProductId: shopifyProduct.id.toString()
      }
    });

    if (existingProduct) {
      await productService.deleteProduct(tenantId, existingProduct.id);
      logger.info('Shopify product deleted successfully', {
        productId: existingProduct.id,
        shopifyProductId: shopifyProduct.id,
        tenantId
      });
    } else {
      logger.warn('Shopify product not found for deletion', {
        shopifyProductId: shopifyProduct.id,
        tenantId
      });
    }
    
    res.status(200).json({ received: true });
  } catch (error) {
    logger.error('Failed to delete Shopify product', {
      error,
      shopifyProductId: shopifyProduct.id
    });
    res.status(500).json({ error: 'Failed to delete product' });
  }
}));

// Shopify order webhooks
router.post('/shopify/orders/create', verifyShopifyWebhook, asyncHandler(async (req: Request, res: Response) => {
  // TODO: Implement Shopify order creation webhook
  logger.info('Shopify order created webhook received', { orderId: req.body.id });
  res.status(200).json({ received: true });
}));

router.post('/shopify/orders/update', verifyShopifyWebhook, asyncHandler(async (req: Request, res: Response) => {
  // TODO: Implement Shopify order update webhook
  logger.info('Shopify order updated webhook received', { orderId: req.body.id });
  res.status(200).json({ received: true });
}));

router.post('/shopify/orders/paid', verifyShopifyWebhook, asyncHandler(async (req: Request, res: Response) => {
  // TODO: Implement Shopify order paid webhook
  logger.info('Shopify order paid webhook received', { orderId: req.body.id });
  res.status(200).json({ received: true });
}));

router.post('/shopify/orders/cancelled', verifyShopifyWebhook, asyncHandler(async (req: Request, res: Response) => {
  // TODO: Implement Shopify order cancelled webhook
  logger.info('Shopify order cancelled webhook received', { orderId: req.body.id });
  res.status(200).json({ received: true });
}));

// Shopify inventory webhooks
router.post('/shopify/inventory_levels/update', verifyShopifyWebhook, asyncHandler(async (req: Request, res: Response) => {
  // TODO: Implement Shopify inventory level update webhook
  logger.info('Shopify inventory level updated webhook received', { 
    inventoryItemId: req.body.inventory_item_id,
    locationId: req.body.location_id,
    available: req.body.available 
  });
  res.status(200).json({ received: true });
}));

// Shopify customer webhooks
router.post('/shopify/customers/create', verifyShopifyWebhook, asyncHandler(async (req: Request, res: Response) => {
  // TODO: Implement Shopify customer creation webhook
  logger.info('Shopify customer created webhook received', { customerId: req.body.id });
  res.status(200).json({ received: true });
}));

router.post('/shopify/customers/update', verifyShopifyWebhook, asyncHandler(async (req: Request, res: Response) => {
  // TODO: Implement Shopify customer update webhook
  logger.info('Shopify customer updated webhook received', { customerId: req.body.id });
  res.status(200).json({ received: true });
}));

// eBay webhooks (for future implementation)
router.post('/ebay/notification', asyncHandler(async (req: Request, res: Response) => {
  // TODO: Implement eBay notification webhook
  logger.info('eBay notification webhook received', { body: req.body });
  res.status(200).json({ received: true });
}));

// TCGplayer webhooks (for future implementation)
router.post('/tcgplayer/notification', asyncHandler(async (req: Request, res: Response) => {
  // TODO: Implement TCGplayer notification webhook
  logger.info('TCGplayer notification webhook received', { body: req.body });
  res.status(200).json({ received: true });
}));

export { router as webhookRoutes };