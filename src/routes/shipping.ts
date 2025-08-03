import { Router, Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { asyncHandler } from '../middleware/errorHandler';
import { ShippingService, CreateLabelRequest } from '../services/shippingService';
import { APIResponse, RequestContext } from '../types';

const router = Router();
const prisma = new PrismaClient();
const shippingService = new ShippingService(prisma);

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

// Get shipping rates for an order
router.get('/rates/:orderId', asyncHandler(async (req: Request, res: Response) => {
  const context = getRequestContext(req);
  const orderId = req.params['orderId'];
  
  if (!orderId) {
    return res.status(400).json({ error: { message: 'Order ID is required' } });
  }

  const rates = await shippingService.getShippingRates(orderId, context);
  
  const response: APIResponse<typeof rates> = {
    data: rates
  };

  res.json(response);
}));

// Create shipping label
router.post('/labels', asyncHandler(async (req: Request, res: Response) => {
  const context = getRequestContext(req);
  const createRequest: CreateLabelRequest = req.body;
  
  const label = await shippingService.createShippingLabel(createRequest, context);
  
  const response: APIResponse<typeof label> = {
    data: label
  };

  res.status(201).json(response);
}));

// Batch create shipping labels
router.post('/labels/batch', asyncHandler(async (req: Request, res: Response) => {
  const context = getRequestContext(req);
  const requests: CreateLabelRequest[] = req.body.requests || [];
  
  if (!Array.isArray(requests) || requests.length === 0) {
    return res.status(400).json({ error: { message: 'Requests array is required' } });
  }

  const result = await shippingService.batchCreateLabels(requests, context);
  
  const response: APIResponse<typeof result> = {
    data: result
  };

  res.json(response);
}));

// Print labels
router.post('/labels/print', asyncHandler(async (req: Request, res: Response) => {
  const { labelIds, format = 'pdf' } = req.body;
  
  if (!Array.isArray(labelIds) || labelIds.length === 0) {
    return res.status(400).json({ error: { message: 'Label IDs array is required' } });
  }

  const result = await shippingService.printLabels(labelIds, format);
  
  const response: APIResponse<typeof result> = {
    data: result
  };

  res.json(response);
}));

// Get tracking information
router.get('/tracking/:trackingNumber', asyncHandler(async (req: Request, res: Response) => {
  const trackingNumber = req.params['trackingNumber'];
  const carrier = req.query['carrier'] as string || 'usps';
  
  if (!trackingNumber) {
    return res.status(400).json({ error: { message: 'Tracking number is required' } });
  }

  const trackingInfo = await shippingService.getTrackingInfo(trackingNumber, carrier);
  
  const response: APIResponse<typeof trackingInfo> = {
    data: trackingInfo
  };

  res.json(response);
}));

// Download label (mock endpoint)
router.get('/labels/:trackingNumber/download', asyncHandler(async (req: Request, res: Response) => {
  const trackingNumber = req.params['trackingNumber'];
  
  if (!trackingNumber) {
    return res.status(400).json({ error: { message: 'Tracking number is required' } });
  }

  // In production, this would return the actual label file
  // For now, return a mock PDF response
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="label-${trackingNumber}.pdf"`);
  res.send(Buffer.from(`Mock PDF label for tracking number: ${trackingNumber}`));
}));

// Download print job (mock endpoint)
router.get('/labels/download/:printJobId', asyncHandler(async (req: Request, res: Response) => {
  const printJobId = req.params['printJobId'];
  
  if (!printJobId) {
    return res.status(400).json({ error: { message: 'Print job ID is required' } });
  }

  // In production, this would return the actual combined PDF
  // For now, return a mock PDF response
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="labels-${printJobId}.pdf"`);
  res.send(Buffer.from(`Mock PDF labels for print job: ${printJobId}`));
}));

// Get shipping carriers and services
router.get('/carriers', asyncHandler(async (req: Request, res: Response) => {
  const carriers = [
    {
      code: 'usps',
      name: 'United States Postal Service',
      services: [
        { code: 'first-class', name: 'First-Class Mail', estimatedDays: 3 },
        { code: 'priority', name: 'Priority Mail', estimatedDays: 2 },
        { code: 'express', name: 'Priority Mail Express', estimatedDays: 1 }
      ]
    },
    {
      code: 'ups',
      name: 'United Parcel Service',
      services: [
        { code: 'ground', name: 'UPS Ground', estimatedDays: 3 },
        { code: '2day', name: 'UPS 2nd Day Air', estimatedDays: 2 },
        { code: 'next-day', name: 'UPS Next Day Air', estimatedDays: 1 }
      ]
    },
    {
      code: 'fedex',
      name: 'FedEx',
      services: [
        { code: 'ground', name: 'FedEx Ground', estimatedDays: 3 },
        { code: '2day', name: 'FedEx 2Day', estimatedDays: 2 },
        { code: 'overnight', name: 'FedEx Standard Overnight', estimatedDays: 1 }
      ]
    },
    {
      code: 'dhl',
      name: 'DHL',
      services: [
        { code: 'ground', name: 'DHL Ground', estimatedDays: 3 },
        { code: 'express', name: 'DHL Express', estimatedDays: 2 }
      ]
    }
  ];

  const response: APIResponse<typeof carriers> = {
    data: carriers
  };

  res.json(response);
}));

export { router as shippingRoutes };