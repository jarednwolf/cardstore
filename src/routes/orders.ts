import { Router, Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { asyncHandler } from '../middleware/errorHandler';
import { OrderService, UpdateOrderRequest } from '../services/orderService';
import { InventoryService } from '../services/inventoryService';
import {
  CreateOrderRequest,
  OrderSearchQuery,
  APIResponse,
  RequestContext
} from '../types';

const router = Router();
const prisma = new PrismaClient();
const inventoryService = new InventoryService(prisma);
const orderService = new OrderService(prisma, inventoryService);

// Helper function to get request context
function getRequestContext(req: Request): RequestContext {
  return {
    userId: (req as any).user?.id || 'dev-user',
    tenantId: (req as any).tenantId || 'default-tenant',
    correlationId: req.headers['x-correlation-id'] as string || `req-${Date.now()}`,
    userAgent: req.headers['user-agent'] || 'unknown',
    ipAddress: req.ip || 'unknown'
  };
}

// Get all orders
router.get('/', asyncHandler(async (req: Request, res: Response) => {
  const context = getRequestContext(req);
  
  const query: OrderSearchQuery = {
    status: req.query['status'] as any,
    source: req.query['source'] as any,
    customerId: req.query['customerId'] as string,
    limit: req.query['limit'] ? parseInt(req.query['limit'] as string) : 20,
    cursor: req.query['cursor'] as string,
    sortBy: req.query['sortBy'] as string || 'createdAt',
    sortOrder: req.query['sortOrder'] as 'asc' | 'desc' || 'desc'
  };

  if (req.query['dateFrom'] && req.query['dateTo']) {
    query.dateRange = {
      start: new Date(req.query['dateFrom'] as string),
      end: new Date(req.query['dateTo'] as string)
    };
  }

  const result = await orderService.searchOrders(query, context);
  
  const response: APIResponse<typeof result.orders> = {
    data: result.orders,
    meta: {
      pagination: result.pagination,
      total: result.pagination.totalCount || 0
    }
  };

  res.json(response);
}));

// Get order by ID
router.get('/:id', asyncHandler(async (req: Request, res: Response) => {
  const context = getRequestContext(req);
  const orderId = req.params['id'];
  if (!orderId) {
    return res.status(400).json({ error: { message: 'Order ID is required' } });
  }
  const order = await orderService.getOrderById(orderId, context);
  
  const response: APIResponse<typeof order> = {
    data: order
  };

  res.json(response);
}));

// Create new order
router.post('/', asyncHandler(async (req: Request, res: Response) => {
  const context = getRequestContext(req);
  const createRequest: CreateOrderRequest = req.body;
  
  const order = await orderService.createOrder(createRequest, context);
  
  const response: APIResponse<typeof order> = {
    data: order
  };

  res.status(201).json(response);
}));

// Update order
router.put('/:id', asyncHandler(async (req: Request, res: Response) => {
  const context = getRequestContext(req);
  const updateRequest: UpdateOrderRequest = req.body;
  const orderId = req.params['id'];
  if (!orderId) {
    return res.status(400).json({ error: { message: 'Order ID is required' } });
  }
  
  const order = await orderService.updateOrder(orderId, updateRequest, context);
  
  const response: APIResponse<typeof order> = {
    data: order
  };

  res.json(response);
}));

// Process order
router.post('/:id/process', asyncHandler(async (req: Request, res: Response) => {
  const context = getRequestContext(req);
  const orderId = req.params['id'];
  if (!orderId) {
    return res.status(400).json({ error: { message: 'Order ID is required' } });
  }
  const result = await orderService.processOrder(orderId, context);
  
  const response: APIResponse<typeof result> = {
    data: result
  };

  res.json(response);
}));

// Fulfill order
router.post('/:id/fulfill', asyncHandler(async (req: Request, res: Response) => {
  const context = getRequestContext(req);
  const fulfillmentRequest = req.body;
  const orderId = req.params['id'];
  if (!orderId) {
    return res.status(400).json({ error: { message: 'Order ID is required' } });
  }
  
  await orderService.fulfillOrder(orderId, fulfillmentRequest, context);
  
  const response: APIResponse<{ success: boolean }> = {
    data: { success: true }
  };

  res.json(response);
}));

// Cancel order
router.post('/:id/cancel', asyncHandler(async (req: Request, res: Response) => {
  const context = getRequestContext(req);
  const { reason } = req.body;
  const orderId = req.params['id'];
  if (!orderId) {
    return res.status(400).json({ error: { message: 'Order ID is required' } });
  }
  
  await orderService.cancelOrder(orderId, reason, context);
  
  const response: APIResponse<{ success: boolean }> = {
    data: { success: true }
  };

  res.json(response);
}));

// Process return
router.post('/:id/returns', asyncHandler(async (req: Request, res: Response) => {
  const context = getRequestContext(req);
  const returnRequest = req.body;
  const orderId = req.params['id'];
  if (!orderId) {
    return res.status(400).json({ error: { message: 'Order ID is required' } });
  }
  
  await orderService.processReturn(orderId, returnRequest, context);
  
  const response: APIResponse<{ success: boolean }> = {
    data: { success: true }
  };

  res.json(response);
}));

export { router as orderRoutes };