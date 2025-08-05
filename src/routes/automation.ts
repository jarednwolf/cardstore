import { Router, Request, Response } from 'express';
import { authMiddleware } from '../middleware/auth';
import { BinderPOSService } from '../services/binderPOSService';
import { automationService } from '../services/automationService';
import { asyncHandler } from '../utils/asyncHandler';
import { logger } from '../config/logger';

const router = Router();

// Initialize services
const binderPOSService = new BinderPOSService();

// Enable mock mode for development if no API key is configured
if (!process.env['BINDERPOS_API_KEY']) {
  logger.info('BinderPOS API key not found, enabling mock mode for development');
  binderPOSService.enableMockMode();
}

interface AuthenticatedRequest extends Request {
  user?: any;
}

// Automation Status Endpoints
router.get('/status', authMiddleware, asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  try {
    const tenantId = req.user?.tenantId || 'default';
    
    // Get automation status from AutomationService
    const automationStatus = automationService.getAutomationStatus(tenantId);

    // Get BinderPOS connection health
    const binderPOSHealth = await binderPOSService.getConnectionHealth();

    const status = {
      automation: automationStatus,
      binderpos: binderPOSHealth,
      services: {
        binderpos: binderPOSHealth.connected ? 'healthy' : 'unhealthy',
        automation: automationStatus.enabled ? 'enabled' : 'disabled'
      }
    };

    logger.info('Automation status requested', {
      tenantId,
      automationEnabled: automationStatus.enabled,
      binderPOSConnected: binderPOSHealth.connected
    });

    res.json({ success: true, data: status });
  } catch (error: any) {
    logger.error('Failed to get automation status', {
      error: error.message,
      tenantId: req.user?.tenantId
    });
    res.status(500).json({ 
      success: false, 
      error: 'Failed to get automation status',
      details: error.message 
    });
  }
}));

router.post('/start', authMiddleware, asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  try {
    const tenantId = req.user?.tenantId || 'default';
    
    await automationService.startAutomation(tenantId);
    
    logger.info('Automation started', {
      tenantId,
      userId: req.user?.id
    });

    res.json({ 
      success: true, 
      message: 'Automation started successfully',
      timestamp: new Date()
    });
  } catch (error: any) {
    logger.error('Failed to start automation', {
      error: error.message,
      tenantId: req.user?.tenantId,
      userId: req.user?.id
    });
    res.status(500).json({ 
      success: false, 
      error: 'Failed to start automation',
      details: error.message 
    });
  }
}));

router.post('/stop', authMiddleware, asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  try {
    const tenantId = req.user?.tenantId || 'default';
    
    await automationService.stopAutomation(tenantId);
    
    logger.info('Automation stopped', {
      tenantId,
      userId: req.user?.id
    });

    res.json({ 
      success: true, 
      message: 'Automation stopped successfully',
      timestamp: new Date()
    });
  } catch (error: any) {
    logger.error('Failed to stop automation', {
      error: error.message,
      tenantId: req.user?.tenantId,
      userId: req.user?.id
    });
    res.status(500).json({ 
      success: false, 
      error: 'Failed to stop automation',
      details: error.message 
    });
  }
}));

// BinderPOS Integration Endpoints
router.post('/binderpos/test-connection', authMiddleware, asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  try {
    const tenantId = req.user?.tenantId || 'default';
    
    logger.info('Testing BinderPOS connection', { tenantId, userId: req.user?.id });
    
    const result = await binderPOSService.testConnection();
    
    logger.info('BinderPOS connection test completed', {
      tenantId,
      connected: result.connected,
      details: result.details
    });

    res.json({ 
      success: true, 
      connected: result.connected, 
      details: result.details,
      timestamp: new Date()
    });
  } catch (error: any) {
    logger.error('BinderPOS connection test failed', {
      error: error.message,
      tenantId: req.user?.tenantId
    });
    res.status(500).json({ 
      success: false, 
      error: 'Connection test failed',
      details: error.message 
    });
  }
}));

router.post('/binderpos/print-receipt', authMiddleware, asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { orderId, receiptData } = req.body;
    const tenantId = req.user?.tenantId || 'default';

    if (!orderId || !receiptData) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: orderId and receiptData'
      });
    }

    logger.info('Printing receipt via BinderPOS', {
      tenantId,
      orderId,
      userId: req.user?.id
    });

    const printJob = await binderPOSService.printReceipt(orderId, receiptData);

    logger.info('Receipt print job submitted', {
      tenantId,
      orderId,
      printJobId: printJob.id
    });

    res.json({ 
      success: true, 
      printJobId: printJob.id,
      printJob,
      timestamp: new Date()
    });
  } catch (error: any) {
    logger.error('Failed to print receipt', {
      error: error.message,
      orderId: req.body.orderId,
      tenantId: req.user?.tenantId
    });
    res.status(500).json({ 
      success: false, 
      error: 'Failed to print receipt',
      details: error.message 
    });
  }
}));

router.post('/binderpos/sync-inventory', authMiddleware, asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { updates } = req.body;
    const tenantId = req.user?.tenantId || 'default';

    if (!updates || !Array.isArray(updates)) {
      return res.status(400).json({
        success: false,
        error: 'Missing or invalid updates array'
      });
    }

    logger.info('Syncing inventory to BinderPOS', {
      tenantId,
      updateCount: updates.length,
      userId: req.user?.id
    });

    const result = await binderPOSService.syncInventory(updates);

    logger.info('Inventory sync completed', {
      tenantId,
      syncedItems: result.syncedItems,
      conflicts: result.conflicts.length
    });

    res.json({ 
      success: true, 
      syncResult: result,
      timestamp: new Date()
    });
  } catch (error: any) {
    logger.error('Failed to sync inventory', {
      error: error.message,
      updateCount: req.body.updates?.length,
      tenantId: req.user?.tenantId
    });
    res.status(500).json({ 
      success: false, 
      error: 'Failed to sync inventory',
      details: error.message 
    });
  }
}));

router.get('/binderpos/print-status/:printJobId', authMiddleware, asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { printJobId } = req.params;
    const tenantId = req.user?.tenantId || 'default';

    logger.debug('Getting print job status', {
      tenantId,
      printJobId
    });

    if (!printJobId) {
      return res.status(400).json({
        success: false,
        error: 'Print job ID is required'
      });
    }

    const status = await binderPOSService.getPrintStatus(printJobId);

    res.json({ 
      success: true, 
      status,
      timestamp: new Date()
    });
  } catch (error: any) {
    logger.error('Failed to get print status', {
      error: error.message,
      printJobId: req.params['printJobId'],
      tenantId: req.user?.tenantId
    });
    res.status(500).json({ 
      success: false, 
      error: 'Failed to get print status',
      details: error.message 
    });
  }
}));

// Order Pipeline Endpoints (placeholders for AutomationService)
router.get('/orders/pipeline', authMiddleware, asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  try {
    const tenantId = req.user?.tenantId || 'default';
    
    const pipeline = automationService.getOrderPipeline(tenantId);

    logger.debug('Order pipeline requested', { tenantId });

    res.json({ 
      success: true, 
      data: pipeline,
      timestamp: new Date()
    });
  } catch (error: any) {
    logger.error('Failed to get order pipeline', {
      error: error.message,
      tenantId: req.user?.tenantId
    });
    res.status(500).json({ 
      success: false, 
      error: 'Failed to get order pipeline',
      details: error.message 
    });
  }
}));

router.post('/orders/:orderId/retry', authMiddleware, asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { orderId } = req.params;
    const tenantId = req.user?.tenantId || 'default';

    if (!orderId) {
      return res.status(400).json({
        success: false,
        error: 'Order ID is required'
      });
    }

    await automationService.retryOrder(orderId, tenantId);

    logger.info('Order retry initiated', {
      tenantId,
      orderId,
      userId: req.user?.id
    });

    res.json({ 
      success: true, 
      message: 'Order retry initiated',
      orderId,
      timestamp: new Date()
    });
  } catch (error: any) {
    logger.error('Failed to retry order', {
      error: error.message,
      orderId: req.params['orderId'],
      tenantId: req.user?.tenantId
    });
    res.status(500).json({ 
      success: false, 
      error: 'Failed to retry order',
      details: error.message 
    });
  }
}));

// Analytics Endpoints (placeholders)
router.get('/analytics/performance', authMiddleware, asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { timeRange = '24h' } = req.query;
    const tenantId = req.user?.tenantId || 'default';

    const analytics = await automationService.getPerformanceAnalytics(timeRange as string, tenantId);

    logger.debug('Performance analytics requested', {
      tenantId,
      timeRange
    });

    res.json({ 
      success: true, 
      data: analytics,
      timestamp: new Date()
    });
  } catch (error: any) {
    logger.error('Failed to get performance analytics', {
      error: error.message,
      tenantId: req.user?.tenantId
    });
    res.status(500).json({ 
      success: false, 
      error: 'Failed to get analytics',
      details: error.message 
    });
  }
}));

router.get('/analytics/errors', authMiddleware, asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { timeRange = '24h' } = req.query;
    const tenantId = req.user?.tenantId || 'default';

    const errors = await automationService.getErrorAnalytics(timeRange as string, tenantId);

    logger.debug('Error analytics requested', {
      tenantId,
      timeRange
    });

    res.json({ 
      success: true, 
      data: errors,
      timestamp: new Date()
    });
  } catch (error: any) {
    logger.error('Failed to get error analytics', {
      error: error.message,
      tenantId: req.user?.tenantId
    });
    res.status(500).json({ 
      success: false, 
      error: 'Failed to get error analytics',
      details: error.message 
    });
  }
}));

// Health check endpoint
router.get('/health', asyncHandler(async (req: Request, res: Response) => {
  try {
    const binderPOSHealth = await binderPOSService.getConnectionHealth();
    
    const health = {
      status: 'healthy',
      services: {
        binderpos: binderPOSHealth.connected ? 'healthy' : 'unhealthy'
      },
      timestamp: new Date()
    };

    res.json(health);
  } catch (error: any) {
    res.status(503).json({
      status: 'unhealthy',
      error: error.message,
      timestamp: new Date()
    });
  }
}));

export default router;