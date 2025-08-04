import { Router, Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { asyncHandler } from '../middleware/errorHandler';
import { InventoryAnalyticsService } from '../services/inventoryAnalyticsService';
import { logger } from '../config/logger';
import { TenantRequest } from '../middleware/tenant';

const router = Router();
const prisma = new PrismaClient();
const analyticsService = new InventoryAnalyticsService(prisma);

// =============================================================================
// INVENTORY ANALYTICS
// =============================================================================

// Get low stock report
router.get('/low-stock', asyncHandler(async (req: Request, res: Response) => {
  const tenantId = req.tenantId!;
  const { locationId, threshold } = req.query;

  const lowStockItems = await analyticsService.generateLowStockReport(
    tenantId,
    locationId as string,
    threshold ? parseInt(threshold as string, 10) : undefined
  );

  const criticalItems = lowStockItems.filter(item => item.urgency > 0.8);
  const highPriorityItems = lowStockItems.filter(item => item.urgency > 0.6 && item.urgency <= 0.8);

  res.json({
    data: lowStockItems,
    meta: {
      total: lowStockItems.length,
      critical: criticalItems.length,
      highPriority: highPriorityItems.length,
      averageUrgency: lowStockItems.length > 0 ? 
        lowStockItems.reduce((sum, item) => sum + item.urgency, 0) / lowStockItems.length : 0
    },
  });
}));

// Get inventory forecast
router.get('/forecast', asyncHandler(async (req: Request, res: Response) => {
  const tenantId = req.tenantId!;
  const { variantId, locationId, days = '30' } = req.query;

  const forecasts = await analyticsService.generateInventoryForecast(
    tenantId,
    variantId as string,
    locationId as string,
    parseInt(days as string, 10)
  );

  const stockoutRisk = forecasts.filter(f => f.daysUntilStockout <= 14);
  const reorderNeeded = forecasts.filter(f => f.projectedStock <= 0);

  res.json({
    data: forecasts,
    meta: {
      total: forecasts.length,
      stockoutRisk: stockoutRisk.length,
      reorderNeeded: reorderNeeded.length,
      averageConfidence: forecasts.length > 0 ? 
        forecasts.reduce((sum, f) => sum + f.confidence, 0) / forecasts.length : 0
    },
  });
}));

// Get sales velocity analysis
router.get('/velocity/:variantId', asyncHandler(async (req: Request, res: Response) => {
  const tenantId = req.tenantId!;
  const { variantId } = req.params;
  const { locationId, days = '30' } = req.query;

  if (!variantId) {
    return res.status(400).json({
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Variant ID is required',
        timestamp: new Date().toISOString(),
        requestId: req.headers['x-request-id'] || '',
      },
    });
  }

  // If locationId is provided, get for specific location, otherwise get for all locations
  if (locationId) {
    const velocity = await analyticsService.calculateSalesVelocity(
      tenantId,
      variantId,
      locationId as string,
      parseInt(days as string, 10)
    );

    res.json({
      data: velocity,
    });
  } else {
    // Get all locations for this tenant
    const locations = await prisma.inventoryLocation.findMany({
      where: { tenantId, isActive: true }
    });

    const velocities = await Promise.all(
      locations.map(location => 
        analyticsService.calculateSalesVelocity(
          tenantId,
          variantId,
          location.id,
          parseInt(days as string, 10)
        )
      )
    );

    res.json({
      data: velocities,
      meta: {
        total: velocities.length,
      },
    });
  }
}));

// Get inventory valuation report
router.get('/valuation', asyncHandler(async (req: Request, res: Response) => {
  const tenantId = req.tenantId!;
  const { locationId } = req.query;

  const valuation = await analyticsService.generateInventoryValuation(
    tenantId,
    locationId as string
  );

  res.json({
    data: valuation,
  });
}));

// Get inventory aging report
router.get('/aging', asyncHandler(async (req: Request, res: Response) => {
  const tenantId = req.tenantId!;
  const { locationId } = req.query;

  const agingItems = await analyticsService.generateInventoryAging(
    tenantId,
    locationId as string
  );

  const deadStock = agingItems.filter(item => item.agingCategory === 'dead');
  const slowMoving = agingItems.filter(item => item.agingCategory === 'slow');
  const totalDeadValue = deadStock.reduce((sum, item) => sum + item.value, 0);
  const totalSlowValue = slowMoving.reduce((sum, item) => sum + item.value, 0);

  res.json({
    data: agingItems,
    meta: {
      total: agingItems.length,
      deadStock: deadStock.length,
      slowMoving: slowMoving.length,
      deadStockValue: totalDeadValue,
      slowMovingValue: totalSlowValue,
      totalAtRiskValue: totalDeadValue + totalSlowValue
    },
  });
}));

// Get comprehensive dashboard data
router.get('/dashboard', asyncHandler(async (req: Request, res: Response) => {
  const tenantId = req.tenantId!;
  const { locationId } = req.query;

  // Run multiple analytics in parallel
  const [
    lowStockItems,
    forecasts,
    valuation,
    agingItems
  ] = await Promise.all([
    analyticsService.generateLowStockReport(tenantId, locationId as string),
    analyticsService.generateInventoryForecast(tenantId, undefined, locationId as string, 30),
    analyticsService.generateInventoryValuation(tenantId, locationId as string),
    analyticsService.generateInventoryAging(tenantId, locationId as string)
  ]);

  // Calculate key metrics
  const criticalLowStock = lowStockItems.filter(item => item.urgency > 0.8).length;
  const stockoutRisk = forecasts.filter(f => f.daysUntilStockout <= 14).length;
  const deadStockValue = agingItems
    .filter(item => item.agingCategory === 'dead')
    .reduce((sum, item) => sum + item.value, 0);

  const dashboard = {
    summary: {
      totalValue: valuation.totalValue,
      totalItems: valuation.totalItems,
      criticalLowStock,
      stockoutRisk,
      deadStockValue,
      currency: valuation.currency
    },
    lowStock: {
      items: lowStockItems.slice(0, 10), // Top 10 most urgent
      total: lowStockItems.length
    },
    forecast: {
      items: forecasts.slice(0, 10), // Top 10 most urgent
      total: forecasts.length
    },
    valuation: {
      byLocation: valuation.valueByLocation,
      byCategory: valuation.valueByCategory,
      fastVsSlow: {
        fastMoving: valuation.fastMovingValue,
        slowMoving: valuation.slowMovingValue
      }
    },
    aging: {
      summary: {
        dead: agingItems.filter(item => item.agingCategory === 'dead').length,
        slow: agingItems.filter(item => item.agingCategory === 'slow').length,
        fresh: agingItems.filter(item => item.agingCategory === 'fresh').length
      },
      deadStockItems: agingItems
        .filter(item => item.agingCategory === 'dead')
        .slice(0, 5) // Top 5 dead stock items
    }
  };

  res.json({
    data: dashboard,
    meta: {
      generatedAt: new Date().toISOString(),
      locationId: locationId || 'all'
    }
  });
}));

export { router as analyticsRoutes };