import { Router, Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { asyncHandler } from '../middleware/errorHandler';
import { InventoryTransferService, CreateTransferRequest } from '../services/inventoryTransferService';
import { RequestContext } from '../types/index';
import { logger } from '../config/logger';
import { createRequestContext, AuthenticatedRequest } from '../middleware/auth';
import { TenantRequest } from '../middleware/tenant';

const router = Router();
const prisma = new PrismaClient();
const transferService = new InventoryTransferService(prisma);

// =============================================================================
// INVENTORY TRANSFERS
// =============================================================================

// Create new inventory transfer
router.post('/', asyncHandler(async (req: Request, res: Response) => {
  const { variantId, fromLocationId, toLocationId, quantity, reason, reference, notes } = req.body;

  if (!variantId || !fromLocationId || !toLocationId || !quantity || !reason) {
    return res.status(400).json({
      error: {
        code: 'VALIDATION_ERROR',
        message: 'variantId, fromLocationId, toLocationId, quantity, and reason are required',
        timestamp: new Date().toISOString(),
        requestId: req.headers['x-request-id'] || '',
      },
    });
  }

  if (typeof quantity !== 'number' || quantity <= 0) {
    return res.status(400).json({
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Quantity must be a positive number',
        timestamp: new Date().toISOString(),
        requestId: req.headers['x-request-id'] || '',
      },
    });
  }

  const transferRequest: CreateTransferRequest = {
    variantId,
    fromLocationId,
    toLocationId,
    quantity,
    reason,
    reference,
    notes
  };

  const context = createRequestContext(req as AuthenticatedRequest);
  const transfer = await transferService.createTransfer(transferRequest, context);

  res.status(201).json({
    data: transfer,
  });
}));

// Complete inventory transfer
router.post('/:transferId/complete', asyncHandler(async (req: Request, res: Response) => {
  const { transferId } = req.params;

  if (!transferId) {
    return res.status(400).json({
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Transfer ID is required',
        timestamp: new Date().toISOString(),
        requestId: req.headers['x-request-id'] || '',
      },
    });
  }

  const context = createRequestContext(req as AuthenticatedRequest);
  const transfer = await transferService.completeTransfer(transferId, context);

  res.json({
    data: transfer,
  });
}));

// Get transfer history
router.get('/history', asyncHandler(async (req: Request, res: Response) => {
  const tenantId = req.tenantId!;
  const { variantId, locationId, limit = '50' } = req.query;

  const transfers = await transferService.getTransferHistory(
    tenantId,
    variantId as string,
    locationId as string,
    parseInt(limit as string, 10)
  );

  res.json({
    data: transfers,
    meta: {
      total: transfers.length,
    },
  });
}));

// Get transfer suggestions
router.get('/suggestions', asyncHandler(async (req: Request, res: Response) => {
  const tenantId = req.tenantId!;
  const { variantId } = req.query;

  const suggestions = await transferService.getTransferSuggestions(
    tenantId,
    variantId as string
  );

  res.json({
    data: suggestions,
    meta: {
      total: suggestions.length,
    },
  });
}));

// Validate transfer request
router.post('/validate', asyncHandler(async (req: Request, res: Response) => {
  const { variantId, fromLocationId, toLocationId, quantity, reason } = req.body;

  if (!variantId || !fromLocationId || !toLocationId || !quantity || !reason) {
    return res.status(400).json({
      error: {
        code: 'VALIDATION_ERROR',
        message: 'variantId, fromLocationId, toLocationId, quantity, and reason are required',
        timestamp: new Date().toISOString(),
        requestId: req.headers['x-request-id'] || '',
      },
    });
  }

  const transferRequest: CreateTransferRequest = {
    variantId,
    fromLocationId,
    toLocationId,
    quantity,
    reason
  };

  const context = createRequestContext(req as AuthenticatedRequest);
  const validation = await transferService.validateTransfer(transferRequest, context);

  res.json({
    data: validation,
  });
}));

export { router as transferRoutes };