import { Router, Request, Response, NextFunction } from 'express';
import { authMiddleware, requireRole, AuthenticatedRequest } from '../middleware/auth';
import { tenantService, CreateTenantRequest, UpdateTenantRequest } from '../services/tenantService';
import { logger } from '../config/logger';
import { BadRequestError, NotFoundError, ForbiddenError } from '../middleware/errorHandler';

const router = Router();

/**
 * @route POST /api/tenants
 * @desc Create a new tenant (system admin only)
 * @access Private (System Admin)
 */
router.post('/', authMiddleware, requireRole(['owner']), async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const createData: CreateTenantRequest = req.body;

    // Validate required fields
    if (!createData.name || !createData.subdomain) {
      throw new BadRequestError('Name and subdomain are required');
    }

    const tenant = await tenantService.createTenant(createData);

    logger.info('Tenant created via API', {
      tenantId: tenant.id,
      createdBy: req.user?.id,
      subdomain: tenant.subdomain
    });

    res.status(201).json({
      success: true,
      data: tenant
    });
  } catch (error) {
    next(error);
  }
});

/**
 * @route GET /api/tenants
 * @desc List all tenants (system admin only)
 * @access Private (System Admin)
 */
router.get('/', authMiddleware, requireRole(['owner']), async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const page = parseInt(req.query['page'] as string) || 1;
    const limit = parseInt(req.query['limit'] as string) || 20;
    const isActiveParam = req.query['isActive'];
    const isActive = isActiveParam ? isActiveParam === 'true' : undefined;
    const search = req.query['search'] as string;
    const plan = req.query['plan'] as string;

    const filters: any = {};
    if (isActive !== undefined) filters.isActive = isActive;
    if (search) filters.search = search;
    if (plan) filters.plan = plan;

    const result = await tenantService.listTenants(page, limit, filters);

    res.json({
      success: true,
      data: result.tenants,
      meta: {
        pagination: {
          page,
          limit,
          total: result.total,
          totalPages: Math.ceil(result.total / limit),
          hasNextPage: page * limit < result.total,
          hasPreviousPage: page > 1
        }
      }
    });
  } catch (error) {
    next(error);
  }
});

/**
 * @route GET /api/tenants/current
 * @desc Get current user's tenant
 * @access Private
 */
router.get('/current', authMiddleware, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    if (!req.user?.tenantId) {
      throw new BadRequestError('No tenant context available');
    }

    const tenant = await tenantService.getTenantById(req.user.tenantId);
    
    if (!tenant) {
      throw new NotFoundError('Tenant not found');
    }

    res.json({
      success: true,
      data: tenant
    });
  } catch (error) {
    next(error);
  }
});

/**
 * @route GET /api/tenants/:id
 * @desc Get tenant by ID
 * @access Private (Tenant Owner or System Admin)
 */
router.get('/:id', authMiddleware, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const tenantId = req.params['id'];
    if (!tenantId) {
      throw new BadRequestError('Tenant ID is required');
    }

    // Check if user can access this tenant
    if (req.user?.tenantId !== tenantId && req.user?.role !== 'owner') {
      throw new ForbiddenError('Access denied to this tenant');
    }

    const tenant = await tenantService.getTenantById(tenantId);
    
    if (!tenant) {
      throw new NotFoundError('Tenant not found');
    }

    res.json({
      success: true,
      data: tenant
    });
  } catch (error) {
    next(error);
  }
});

/**
 * @route PUT /api/tenants/:id
 * @desc Update tenant
 * @access Private (Tenant Owner or System Admin)
 */
router.put('/:id', authMiddleware, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const tenantId = req.params['id'];
    if (!tenantId) {
      throw new BadRequestError('Tenant ID is required');
    }
    const updateData: UpdateTenantRequest = req.body;

    // Check if user can modify this tenant
    if (req.user?.tenantId !== tenantId && req.user?.role !== 'owner') {
      throw new ForbiddenError('Access denied to modify this tenant');
    }

    const tenant = await tenantService.updateTenant(tenantId, updateData);

    logger.info('Tenant updated via API', {
      tenantId,
      updatedBy: req.user?.id,
      changes: updateData
    });

    res.json({
      success: true,
      data: tenant
    });
  } catch (error) {
    next(error);
  }
});

/**
 * @route PUT /api/tenants/:id/settings
 * @desc Update tenant settings
 * @access Private (Tenant Owner or Manager)
 */
router.put('/:id/settings', authMiddleware, requireRole(['owner', 'manager']), async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const tenantId = req.params['id'];
    if (!tenantId) {
      throw new BadRequestError('Tenant ID is required');
    }

    // Check if user can modify this tenant
    if (req.user?.tenantId !== tenantId) {
      throw new ForbiddenError('Access denied to modify this tenant');
    }

    const tenant = await tenantService.updateTenant(tenantId, {
      settings: req.body
    });

    logger.info('Tenant settings updated via API', {
      tenantId,
      updatedBy: req.user?.id,
      settingsKeys: Object.keys(req.body)
    });

    res.json({
      success: true,
      data: tenant
    });
  } catch (error) {
    next(error);
  }
});

/**
 * @route GET /api/tenants/:id/stats
 * @desc Get tenant statistics
 * @access Private (Tenant Owner or Manager)
 */
router.get('/:id/stats', authMiddleware, requireRole(['owner', 'manager']), async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const tenantId = req.params['id'];
    if (!tenantId) {
      throw new BadRequestError('Tenant ID is required');
    }

    // Check if user can access this tenant
    if (req.user?.tenantId !== tenantId) {
      throw new ForbiddenError('Access denied to this tenant');
    }

    const stats = await tenantService.getTenantStats(tenantId);

    res.json({
      success: true,
      data: stats
    });
  } catch (error) {
    next(error);
  }
});

/**
 * @route POST /api/tenants/:id/suspend
 * @desc Suspend tenant (system admin only)
 * @access Private (System Admin)
 */
router.post('/:id/suspend', authMiddleware, requireRole(['owner']), async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const tenantId = req.params['id'];
    if (!tenantId) {
      throw new BadRequestError('Tenant ID is required');
    }
    const { reason } = req.body;

    if (!reason) {
      throw new BadRequestError('Suspension reason is required');
    }

    await tenantService.suspendTenant(tenantId, reason);

    logger.warn('Tenant suspended via API', {
      tenantId,
      suspendedBy: req.user?.id,
      reason
    });

    res.json({
      success: true,
      message: 'Tenant suspended successfully'
    });
  } catch (error) {
    next(error);
  }
});

/**
 * @route POST /api/tenants/:id/reactivate
 * @desc Reactivate tenant (system admin only)
 * @access Private (System Admin)
 */
router.post('/:id/reactivate', authMiddleware, requireRole(['owner']), async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const tenantId = req.params['id'];
    if (!tenantId) {
      throw new BadRequestError('Tenant ID is required');
    }

    await tenantService.reactivateTenant(tenantId);

    logger.info('Tenant reactivated via API', {
      tenantId,
      reactivatedBy: req.user?.id
    });

    res.json({
      success: true,
      message: 'Tenant reactivated successfully'
    });
  } catch (error) {
    next(error);
  }
});

/**
 * @route GET /api/tenants/:id/export
 * @desc Export tenant data
 * @access Private (Tenant Owner)
 */
router.get('/:id/export', authMiddleware, requireRole(['owner']), async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const tenantId = req.params['id'];
    if (!tenantId) {
      throw new BadRequestError('Tenant ID is required');
    }
    const format = (req.query['format'] as 'json' | 'csv') || 'json';

    // Check if user can access this tenant
    if (req.user?.tenantId !== tenantId) {
      throw new ForbiddenError('Access denied to this tenant');
    }

    const exportData = await tenantService.exportTenantData(tenantId, format);

    logger.info('Tenant data exported via API', {
      tenantId,
      exportedBy: req.user?.id,
      format
    });

    if (format === 'json') {
      res.json({
        success: true,
        data: exportData
      });
    } else {
      // For CSV format, we would need to implement CSV conversion
      res.json({
        success: false,
        error: 'CSV export not yet implemented'
      });
    }
  } catch (error) {
    next(error);
  }
});

/**
 * @route DELETE /api/tenants/:id
 * @desc Delete tenant permanently (system admin only)
 * @access Private (System Admin)
 */
router.delete('/:id', authMiddleware, requireRole(['owner']), async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const tenantId = req.params['id'];
    if (!tenantId) {
      throw new BadRequestError('Tenant ID is required');
    }
    const { confirm } = req.body;

    if (confirm !== 'DELETE') {
      throw new BadRequestError('Must confirm deletion by sending "confirm": "DELETE"');
    }

    await tenantService.deleteTenant(tenantId);

    logger.warn('Tenant deleted permanently via API', {
      tenantId,
      deletedBy: req.user?.id
    });

    res.json({
      success: true,
      message: 'Tenant deleted permanently'
    });
  } catch (error) {
    next(error);
  }
});

/**
 * @route GET /api/tenants/subdomain/:subdomain
 * @desc Get tenant by subdomain (public endpoint for tenant resolution)
 * @access Public
 */
router.get('/subdomain/:subdomain', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const subdomain = req.params['subdomain'];
    if (!subdomain) {
      throw new BadRequestError('Subdomain is required');
    }

    const tenant = await tenantService.getTenantBySubdomain(subdomain);
    
    if (!tenant) {
      throw new NotFoundError('Tenant not found');
    }

    // Return limited tenant info for public access
    res.json({
      success: true,
      data: {
        id: tenant.id,
        name: tenant.name,
        subdomain: tenant.subdomain,
        isActive: tenant.isActive,
        branding: tenant.settings['branding'] || {}
      }
    });
  } catch (error) {
    next(error);
  }
});

export default router;