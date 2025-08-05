import { Router, Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { asyncHandler } from '../middleware/errorHandler';
import { ProductService } from '../services/productService';
import { CreateProductRequest, UpdateProductRequest, ProductSearchQuery } from '../types';

const router = Router();
const prisma = new PrismaClient();
const productService = new ProductService(prisma);

// Get all products with search and filters
router.get('/', asyncHandler(async (req: Request, res: Response) => {
  const tenantId = req.headers['x-tenant-id'] as string;
  if (!tenantId) {
    return res.status(400).json({
      error: {
        code: 'MISSING_TENANT_ID',
        message: 'Tenant ID is required',
        timestamp: new Date().toISOString(),
        requestId: req.headers['x-request-id'] || '',
      },
    });
  }

  const query: ProductSearchQuery = {
    query: req.query['q'] as string,
    category: req.query['category'] as string,
    vendor: req.query['vendor'] as string,
    status: req.query['status'] as string,
    limit: req.query['limit'] ? parseInt(req.query['limit'] as string) : 50,
  };

  const result = await productService.searchProducts(tenantId, query);
  res.json({ data: result.products, pagination: result.pagination });
}));

// Get product by ID
router.get('/:id', asyncHandler(async (req: Request, res: Response) => {
  const tenantId = req.headers['x-tenant-id'] as string;
  if (!tenantId) {
    return res.status(400).json({
      error: {
        code: 'MISSING_TENANT_ID',
        message: 'Tenant ID is required',
        timestamp: new Date().toISOString(),
        requestId: req.headers['x-request-id'] || '',
      },
    });
  }

  const product = await productService.getProduct(tenantId, req.params['id']!);
  if (!product) {
    return res.status(404).json({
      error: {
        code: 'PRODUCT_NOT_FOUND',
        message: 'Product not found',
        timestamp: new Date().toISOString(),
        requestId: req.headers['x-request-id'] || '',
      },
    });
  }

  res.json({ data: product });
}));

// Create new product
router.post('/', asyncHandler(async (req: Request, res: Response) => {
  const tenantId = req.headers['x-tenant-id'] as string;
  if (!tenantId) {
    return res.status(400).json({
      error: {
        code: 'MISSING_TENANT_ID',
        message: 'Tenant ID is required',
        timestamp: new Date().toISOString(),
        requestId: req.headers['x-request-id'] || '',
      },
    });
  }

  const productData: CreateProductRequest = req.body;
  const product = await productService.createProduct(tenantId, productData);
  res.status(201).json({ data: product });
}));

// Update product
router.put('/:id', asyncHandler(async (req: Request, res: Response) => {
  const tenantId = req.headers['x-tenant-id'] as string;
  if (!tenantId) {
    return res.status(400).json({
      error: {
        code: 'MISSING_TENANT_ID',
        message: 'Tenant ID is required',
        timestamp: new Date().toISOString(),
        requestId: req.headers['x-request-id'] || '',
      },
    });
  }

  const updateData: UpdateProductRequest = req.body;
  const product = await productService.updateProduct(tenantId, req.params['id']!, updateData);
  res.json({ data: product });
}));

// Delete product
router.delete('/:id', asyncHandler(async (req: Request, res: Response) => {
  const tenantId = req.headers['x-tenant-id'] as string;
  if (!tenantId) {
    return res.status(400).json({
      error: {
        code: 'MISSING_TENANT_ID',
        message: 'Tenant ID is required',
        timestamp: new Date().toISOString(),
        requestId: req.headers['x-request-id'] || '',
      },
    });
  }

  await productService.deleteProduct(tenantId, req.params['id']!);
  res.status(204).send();
}));

// Bulk operations
router.post('/bulk', asyncHandler(async (req: Request, res: Response) => {
  const tenantId = req.headers['x-tenant-id'] as string;
  if (!tenantId) {
    return res.status(400).json({
      error: {
        code: 'MISSING_TENANT_ID',
        message: 'Tenant ID is required',
        timestamp: new Date().toISOString(),
        requestId: req.headers['x-request-id'] || '',
      },
    });
  }

  const { updates } = req.body;
  const result = await productService.bulkUpdateProducts(tenantId, updates);
  res.json({ data: result });
}));

// Variant routes
router.post('/:productId/variants', asyncHandler(async (req: Request, res: Response) => {
  const tenantId = req.headers['x-tenant-id'] as string;
  if (!tenantId) {
    return res.status(400).json({
      error: {
        code: 'MISSING_TENANT_ID',
        message: 'Tenant ID is required',
        timestamp: new Date().toISOString(),
        requestId: req.headers['x-request-id'] || '',
      },
    });
  }

  const variant = await productService.createVariant(tenantId, req.params['productId']!, req.body);
  res.status(201).json({ data: variant });
}));

router.put('/variants/:variantId', asyncHandler(async (req: Request, res: Response) => {
  const tenantId = req.headers['x-tenant-id'] as string;
  if (!tenantId) {
    return res.status(400).json({
      error: {
        code: 'MISSING_TENANT_ID',
        message: 'Tenant ID is required',
        timestamp: new Date().toISOString(),
        requestId: req.headers['x-request-id'] || '',
      },
    });
  }

  const variant = await productService.updateVariant(tenantId, req.params['variantId']!, req.body);
  res.json({ data: variant });
}));

router.get('/variants/:variantId', asyncHandler(async (req: Request, res: Response) => {
  const tenantId = req.headers['x-tenant-id'] as string;
  if (!tenantId) {
    return res.status(400).json({
      error: {
        code: 'MISSING_TENANT_ID',
        message: 'Tenant ID is required',
        timestamp: new Date().toISOString(),
        requestId: req.headers['x-request-id'] || '',
      },
    });
  }

  const variant = await productService.getVariant(tenantId, req.params['variantId']!);
  if (!variant) {
    return res.status(404).json({
      error: {
        code: 'VARIANT_NOT_FOUND',
        message: 'Variant not found',
        timestamp: new Date().toISOString(),
        requestId: req.headers['x-request-id'] || '',
      },
    });
  }

  res.json({ data: variant });
}));

// TCG attribute routes
router.put('/variants/:variantId/tcg-attributes', asyncHandler(async (req: Request, res: Response) => {
  const tenantId = req.headers['x-tenant-id'] as string;
  if (!tenantId) {
    return res.status(400).json({
      error: {
        code: 'MISSING_TENANT_ID',
        message: 'Tenant ID is required',
        timestamp: new Date().toISOString(),
        requestId: req.headers['x-request-id'] || '',
      },
    });
  }

  const variant = await productService.updateTCGAttributes(tenantId, req.params['variantId']!, req.body);
  res.json({ data: variant });
}));

router.get('/variants/search/tcg', asyncHandler(async (req: Request, res: Response) => {
  const tenantId = req.headers['x-tenant-id'] as string;
  if (!tenantId) {
    return res.status(400).json({
      error: {
        code: 'MISSING_TENANT_ID',
        message: 'Tenant ID is required',
        timestamp: new Date().toISOString(),
        requestId: req.headers['x-request-id'] || '',
      },
    });
  }

  const tcgQuery = {
    set: req.query['set'] as string,
    rarity: req.query['rarity'] as string,
    condition: req.query['condition'] as string,
    foil: req.query['foil'] === 'true',
    language: req.query['language'] as string,
  };

  const variants = await productService.searchVariantsByTCGAttributes(tenantId, tcgQuery);
  res.json({ data: variants });
}));

export { router as productRoutes };