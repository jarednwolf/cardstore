import { Router, Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { asyncHandler } from '../middleware/errorHandler';
import { InventoryService } from '../services/inventoryService';
import { InventoryUpdate, RequestContext } from '../types';
import { logger } from '../config/logger';
import { createRequestContext, AuthenticatedRequest } from '../middleware/auth';
import { TenantRequest } from '../middleware/tenant';
import { getCurrencyFromSettings } from '../utils/currency';

interface InventoryRequest extends TenantRequest {
  context?: RequestContext;
}

const router = Router();
const prisma = new PrismaClient();
const inventoryService = new InventoryService(prisma);

// =============================================================================
// LOCATION MANAGEMENT
// =============================================================================

// Get all inventory locations
router.get('/locations', asyncHandler(async (req: Request, res: Response) => {
  const tenantId = req.tenantId!;
  
  const locations = await inventoryService.getLocations(tenantId);
  
  res.json({
    data: locations,
    meta: {
      total: locations.length,
    },
  });
}));

// Create new inventory location
router.post('/locations', asyncHandler(async (req: Request, res: Response) => {
  const tenantId = req.tenantId!;
  const { name, type, shopifyLocationId, address } = req.body;

  if (!name || !type) {
    return res.status(400).json({
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Name and type are required',
        timestamp: new Date().toISOString(),
        requestId: req.headers['x-request-id'] || '',
      },
    });
  }

  const location = await inventoryService.createLocation(tenantId, {
    name,
    type,
    shopifyLocationId,
    address,
  });

  res.status(201).json({
    data: location,
  });
}));

// Get specific location
router.get('/locations/:locationId', asyncHandler(async (req: Request, res: Response) => {
  const tenantId = req.tenantId!;
  const { locationId } = req.params;

  if (!locationId) {
    return res.status(400).json({
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Location ID is required',
        timestamp: new Date().toISOString(),
        requestId: req.headers['x-request-id'] || '',
      },
    });
  }

  const location = await inventoryService.getLocation(tenantId, locationId);
  
  if (!location) {
    return res.status(404).json({
      error: {
        code: 'LOCATION_NOT_FOUND',
        message: 'Inventory location not found',
        timestamp: new Date().toISOString(),
        requestId: req.headers['x-request-id'] || '',
      },
    });
  }

  res.json({
    data: location,
  });
}));

// =============================================================================
// INVENTORY OPERATIONS
// =============================================================================

// Get inventory for all variants (with optional location filter)
router.get('/', asyncHandler(async (req: Request, res: Response) => {
  const tenantId = req.tenantId!;
  const { locationId } = req.query;

  const inventory = await inventoryService.getAllInventory(
    tenantId, 
    locationId as string
  );

  res.json({
    data: inventory,
    meta: {
      total: inventory.length,
    },
  });
}));

// Get inventory for specific variant
router.get('/:variantId', asyncHandler(async (req: Request, res: Response) => {
  const tenantId = req.tenantId!;
  const { variantId } = req.params;
  const { locationId } = req.query;

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

  const inventory = await inventoryService.getInventory(
    tenantId,
    variantId,
    locationId as string
  );

  res.json({
    data: inventory,
    meta: {
      total: inventory.length,
    },
  });
}));

// Set inventory level for specific variant at location
router.put('/:variantId/locations/:locationId', asyncHandler(async (req: Request, res: Response) => {
  const tenantId = req.tenantId!;
  const { variantId, locationId } = req.params;
  const { quantity, reason = 'manual_adjustment' } = req.body;

  if (!variantId || !locationId) {
    return res.status(400).json({
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Variant ID and Location ID are required',
        timestamp: new Date().toISOString(),
        requestId: req.headers['x-request-id'] || '',
      },
    });
  }

  if (typeof quantity !== 'number' || quantity < 0) {
    return res.status(400).json({
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Quantity must be a non-negative number',
        timestamp: new Date().toISOString(),
        requestId: req.headers['x-request-id'] || '',
      },
    });
  }

  const context = createRequestContext(req as AuthenticatedRequest);
  const inventoryItem = await inventoryService.setInventoryLevel(
    variantId,
    locationId,
    quantity,
    context,
    reason
  );

  res.json({
    data: inventoryItem,
  });
}));

// Update inventory (add/subtract quantities)
router.patch('/:variantId', asyncHandler(async (req: Request, res: Response) => {
  const tenantId = req.tenantId!;
  const { variantId } = req.params;
  const { updates } = req.body;

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

  if (!Array.isArray(updates) || updates.length === 0) {
    return res.status(400).json({
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Updates array is required and must not be empty',
        timestamp: new Date().toISOString(),
        requestId: req.headers['x-request-id'] || '',
      },
    });
  }

  // Validate and prepare updates
  const inventoryUpdates: InventoryUpdate[] = updates.map((update: any) => ({
    variantId,
    locationId: update.locationId,
    quantityChange: update.quantityChange,
    reason: update.reason || 'manual_adjustment',
    reference: update.reference,
  }));

  const context = createRequestContext(req as AuthenticatedRequest);
  await inventoryService.updateInventory(inventoryUpdates, context);

  res.json({
    data: {
      message: 'Inventory updated successfully',
      updatedCount: inventoryUpdates.length,
    },
  });
}));

// Bulk inventory update
router.post('/bulk', asyncHandler(async (req: Request, res: Response) => {
  const tenantId = req.tenantId!;
  const { updates } = req.body;

  if (!Array.isArray(updates) || updates.length === 0) {
    return res.status(400).json({
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Updates array is required and must not be empty',
        timestamp: new Date().toISOString(),
        requestId: req.headers['x-request-id'] || '',
      },
    });
  }

  // Validate updates
  const inventoryUpdates: InventoryUpdate[] = updates.map((update: any, index: number) => {
    if (!update.variantId || !update.locationId || typeof update.quantityChange !== 'number') {
      throw new Error(`Invalid update at index ${index}: variantId, locationId, and quantityChange are required`);
    }
    
    return {
      variantId: update.variantId,
      locationId: update.locationId,
      quantityChange: update.quantityChange,
      reason: update.reason || 'bulk_update',
      reference: update.reference,
    };
  });

  const context = createRequestContext(req as AuthenticatedRequest);
  const result = await inventoryService.bulkUpdateInventory(inventoryUpdates, context);

  res.json({
    data: result,
  });
}));

// =============================================================================
// CHANNEL BUFFER MANAGEMENT
// =============================================================================

// Set channel buffer for variant at location
router.put('/:variantId/locations/:locationId/buffers/:channel', asyncHandler(async (req: Request, res: Response) => {
  const tenantId = req.tenantId!;
  const { variantId, locationId, channel } = req.params;
  const { buffer } = req.body;

  if (!variantId || !locationId || !channel) {
    return res.status(400).json({
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Variant ID, Location ID, and Channel are required',
        timestamp: new Date().toISOString(),
        requestId: req.headers['x-request-id'] || '',
      },
    });
  }

  if (typeof buffer !== 'number' || buffer < 0) {
    return res.status(400).json({
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Buffer must be a non-negative number',
        timestamp: new Date().toISOString(),
        requestId: req.headers['x-request-id'] || '',
      },
    });
  }

  await inventoryService.setChannelBuffer(tenantId, variantId, locationId, channel, buffer);

  res.json({
    data: {
      message: 'Channel buffer set successfully',
      variantId,
      locationId,
      channel,
      buffer,
    },
  });
}));

// Get available to sell for variant on specific channel
router.get('/:variantId/available/:channel', asyncHandler(async (req: Request, res: Response) => {
  const tenantId = req.tenantId!;
  const { variantId, channel } = req.params;
  const { locationId } = req.query;

  if (!variantId || !channel) {
    return res.status(400).json({
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Variant ID and Channel are required',
        timestamp: new Date().toISOString(),
        requestId: req.headers['x-request-id'] || '',
      },
    });
  }

  const availableToSell = await inventoryService.getAvailableToSell(
    tenantId,
    variantId,
    channel,
    locationId as string
  );

  res.json({
    data: {
      variantId,
      channel,
      locationId: locationId || 'all',
      availableToSell,
    },
  });
}));

// =============================================================================
// STOCK MOVEMENTS
// =============================================================================

// Get stock movement history for variant
router.get('/:variantId/movements', asyncHandler(async (req: Request, res: Response) => {
  const tenantId = req.tenantId!;
  const { variantId } = req.params;
  const { locationId, limit = '50' } = req.query;

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

  const movements = await inventoryService.getStockHistory(
    tenantId,
    variantId,
    locationId as string,
    parseInt(limit as string, 10)
  );

  res.json({
    data: movements,
    meta: {
      total: movements.length,
    },
  });
}));

// =============================================================================
// INVENTORY REPORTS
// =============================================================================

// Get low stock report
router.get('/reports/low-stock', asyncHandler(async (req: Request, res: Response) => {
  const tenantId = req.tenantId!;
  const { locationId, threshold = '5' } = req.query;

  const inventory = await inventoryService.getAllInventory(tenantId, locationId as string);
  const lowStockItems = inventory.filter(item => 
    item.available <= parseInt(threshold as string, 10)
  );

  res.json({
    data: lowStockItems,
    meta: {
      total: lowStockItems.length,
      threshold: parseInt(threshold as string, 10),
    },
  });
}));

// Get inventory value report
router.get('/reports/value', asyncHandler(async (req: Request, res: Response) => {
  const tenantId = req.tenantId!;
  const { locationId } = req.query;

  const inventory = await inventoryService.getAllInventory(tenantId, locationId as string);
  
  let totalValue = 0;
  let totalItems = 0;
  
  const valueByLocation: Record<string, { value: number; items: number }> = {};

  for (const item of inventory) {
    const itemValue = item.onHand * (item.variant?.price || 0);
    totalValue += itemValue;
    totalItems += item.onHand;

    if (item.location?.name) {
      const locationName = item.location.name;
      if (!valueByLocation[locationName]) {
        valueByLocation[locationName] = { value: 0, items: 0 };
      }
      valueByLocation[locationName].value += itemValue;
      valueByLocation[locationName].items += item.onHand;
    }
  }

  res.json({
    data: {
      totalValue,
      totalItems,
      valueByLocation,
      currency: getCurrencyFromSettings((req as TenantRequest).tenant?.settings),
    },
  });
}));

export { router as inventoryRoutes };