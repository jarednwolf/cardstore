import { Router, Request, Response } from 'express';
import { marketplaceManagementService } from '../services/marketplaceConnectorFramework';
import { authMiddleware } from '../middleware/auth';
import { tenantScopeMiddleware } from '../middleware/tenantScope';
import { asyncHandler } from '../middleware/errorHandler';
import { logger } from '../config/logger';

const router = Router();

// Apply authentication and tenant scoping to all routes
router.use(authMiddleware);
router.use(tenantScopeMiddleware);

/**
 * Get available marketplaces
 */
router.get('/available', asyncHandler(async (req: Request, res: Response) => {
  const marketplaces = marketplaceManagementService.getAvailableMarketplaces();
  
  res.json({
    success: true,
    data: marketplaces
  });
}));

/**
 * Get marketplace status
 */
router.get('/status', asyncHandler(async (req: Request, res: Response) => {
  const status = await marketplaceManagementService.getMarketplaceStatus();
  
  res.json({
    success: true,
    data: status
  });
}));

/**
 * Initialize marketplace connector
 */
router.post('/:marketplace/initialize', asyncHandler(async (req: Request, res: Response) => {
  const { marketplace } = req.params;
  const { credentials } = req.body;

  if (!marketplace) {
    return res.status(400).json({
      success: false,
      error: 'Marketplace parameter is required'
    });
  }

  if (!credentials) {
    return res.status(400).json({
      success: false,
      error: 'Credentials are required'
    });
  }

  try {
    await marketplaceManagementService.initializeConnector(marketplace, credentials);
    
    res.json({
      success: true,
      message: `${marketplace} connector initialized successfully`
    });
  } catch (error) {
    logger.error('Failed to initialize marketplace connector', {
      marketplace,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
    
    res.status(400).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to initialize connector'
    });
  }
}));

/**
 * Test marketplace connection
 */
router.post('/:marketplace/test', asyncHandler(async (req: Request, res: Response) => {
  const { marketplace } = req.params;
  
  if (!marketplace) {
    return res.status(400).json({
      success: false,
      error: 'Marketplace parameter is required'
    });
  }
  
  const connector = marketplaceManagementService.getConnector(marketplace);
  if (!connector) {
    return res.status(404).json({
      success: false,
      error: 'Marketplace connector not found'
    });
  }

  try {
    const connected = await connector.testConnection();
    
    res.json({
      success: true,
      data: {
        marketplace,
        connected,
        testedAt: new Date().toISOString()
      }
    });
  } catch (error) {
    logger.error('Marketplace connection test failed', {
      marketplace,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
    
    res.json({
      success: true,
      data: {
        marketplace,
        connected: false,
        error: error instanceof Error ? error.message : 'Connection test failed',
        testedAt: new Date().toISOString()
      }
    });
  }
}));

/**
 * Sync product to marketplaces
 */
router.post('/sync/product/:productId', asyncHandler(async (req: Request, res: Response) => {
  const { productId } = req.params;
  const { marketplaces, options = {} } = req.body;
  const tenantId = req.user?.tenantId;

  if (!productId) {
    return res.status(400).json({
      success: false,
      error: 'Product ID is required'
    });
  }

  if (!tenantId) {
    return res.status(400).json({
      success: false,
      error: 'Tenant ID is required'
    });
  }

  if (!marketplaces || !Array.isArray(marketplaces)) {
    return res.status(400).json({
      success: false,
      error: 'Marketplaces array is required'
    });
  }

  try {
    const results = await marketplaceManagementService.syncProductToMarketplaces(
      productId,
      marketplaces,
      { tenantId, ...options }
    );
    
    const successCount = results.filter(r => r.success).length;
    const failureCount = results.filter(r => !r.success).length;
    
    res.json({
      success: true,
      data: {
        results,
        summary: {
          total: results.length,
          successful: successCount,
          failed: failureCount
        }
      }
    });
  } catch (error) {
    logger.error('Failed to sync product to marketplaces', {
      productId,
      marketplaces,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
    
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to sync product'
    });
  }
}));

/**
 * Get marketplace categories
 */
router.get('/:marketplace/categories', asyncHandler(async (req: Request, res: Response) => {
  const { marketplace } = req.params;
  
  if (!marketplace) {
    return res.status(400).json({
      success: false,
      error: 'Marketplace parameter is required'
    });
  }
  
  const connector = marketplaceManagementService.getConnector(marketplace);
  if (!connector) {
    return res.status(404).json({
      success: false,
      error: 'Marketplace connector not found'
    });
  }

  try {
    const categories = await connector.getCategories();
    
    res.json({
      success: true,
      data: categories
    });
  } catch (error) {
    logger.error('Failed to get marketplace categories', {
      marketplace,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
    
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get categories'
    });
  }
}));

/**
 * Update marketplace inventory
 */
router.post('/:marketplace/inventory/update', asyncHandler(async (req: Request, res: Response) => {
  const { marketplace } = req.params;
  const { updates } = req.body;
  
  if (!marketplace) {
    return res.status(400).json({
      success: false,
      error: 'Marketplace parameter is required'
    });
  }
  
  const connector = marketplaceManagementService.getConnector(marketplace);
  if (!connector) {
    return res.status(404).json({
      success: false,
      error: 'Marketplace connector not found'
    });
  }

  if (!updates || !Array.isArray(updates)) {
    return res.status(400).json({
      success: false,
      error: 'Updates array is required'
    });
  }

  try {
    await connector.updateInventory(updates);
    
    res.json({
      success: true,
      message: `Updated inventory for ${updates.length} listings on ${marketplace}`
    });
  } catch (error) {
    logger.error('Failed to update marketplace inventory', {
      marketplace,
      updateCount: updates.length,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
    
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to update inventory'
    });
  }
}));

/**
 * Update marketplace pricing
 */
router.post('/:marketplace/pricing/update', asyncHandler(async (req: Request, res: Response) => {
  const { marketplace } = req.params;
  const { updates } = req.body;
  
  if (!marketplace) {
    return res.status(400).json({
      success: false,
      error: 'Marketplace parameter is required'
    });
  }
  
  const connector = marketplaceManagementService.getConnector(marketplace);
  if (!connector) {
    return res.status(404).json({
      success: false,
      error: 'Marketplace connector not found'
    });
  }

  if (!updates || !Array.isArray(updates)) {
    return res.status(400).json({
      success: false,
      error: 'Updates array is required'
    });
  }

  try {
    await connector.updatePricing(updates);
    
    res.json({
      success: true,
      message: `Updated pricing for ${updates.length} listings on ${marketplace}`
    });
  } catch (error) {
    logger.error('Failed to update marketplace pricing', {
      marketplace,
      updateCount: updates.length,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
    
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to update pricing'
    });
  }
}));

/**
 * Get marketplace orders
 */
router.get('/:marketplace/orders', asyncHandler(async (req: Request, res: Response) => {
  const { marketplace } = req.params;
  const { startDate, endDate } = req.query;
  
  if (!marketplace) {
    return res.status(400).json({
      success: false,
      error: 'Marketplace parameter is required'
    });
  }
  
  const connector = marketplaceManagementService.getConnector(marketplace);
  if (!connector) {
    return res.status(404).json({
      success: false,
      error: 'Marketplace connector not found'
    });
  }

  try {
    const start = startDate ? new Date(startDate as string) : undefined;
    const end = endDate ? new Date(endDate as string) : undefined;
    
    const orders = await connector.getOrders(start, end);
    
    res.json({
      success: true,
      data: orders,
      count: orders.length
    });
  } catch (error) {
    logger.error('Failed to get marketplace orders', {
      marketplace,
      startDate,
      endDate,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
    
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get orders'
    });
  }
}));

/**
 * Update marketplace order status
 */
router.post('/:marketplace/orders/:orderId/status', asyncHandler(async (req: Request, res: Response) => {
  const { marketplace, orderId } = req.params;
  const { status, trackingInfo } = req.body;
  
  if (!marketplace) {
    return res.status(400).json({
      success: false,
      error: 'Marketplace parameter is required'
    });
  }

  if (!orderId) {
    return res.status(400).json({
      success: false,
      error: 'Order ID is required'
    });
  }
  
  const connector = marketplaceManagementService.getConnector(marketplace);
  if (!connector) {
    return res.status(404).json({
      success: false,
      error: 'Marketplace connector not found'
    });
  }

  if (!status) {
    return res.status(400).json({
      success: false,
      error: 'Status is required'
    });
  }

  try {
    await connector.updateOrderStatus(orderId, status, trackingInfo);
    
    res.json({
      success: true,
      message: `Updated order ${orderId} status to ${status} on ${marketplace}`
    });
  } catch (error) {
    logger.error('Failed to update marketplace order status', {
      marketplace,
      orderId,
      status,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
    
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to update order status'
    });
  }
}));

/**
 * Delete marketplace listing
 */
router.delete('/:marketplace/listings/:listingId', asyncHandler(async (req: Request, res: Response) => {
  const { marketplace, listingId } = req.params;
  
  if (!marketplace) {
    return res.status(400).json({
      success: false,
      error: 'Marketplace parameter is required'
    });
  }

  if (!listingId) {
    return res.status(400).json({
      success: false,
      error: 'Listing ID is required'
    });
  }
  
  const connector = marketplaceManagementService.getConnector(marketplace);
  if (!connector) {
    return res.status(404).json({
      success: false,
      error: 'Marketplace connector not found'
    });
  }

  try {
    await connector.deleteListing(listingId);
    
    res.json({
      success: true,
      message: `Deleted listing ${listingId} from ${marketplace}`
    });
  } catch (error) {
    logger.error('Failed to delete marketplace listing', {
      marketplace,
      listingId,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
    
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to delete listing'
    });
  }
}));

export default router;