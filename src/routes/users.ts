import { Router, Request, Response, NextFunction } from 'express';
import { authMiddleware, requireRole, AuthenticatedRequest } from '../middleware/auth';
import { userService, CreateUserRequest, UpdateUserRequest, UserInvitation } from '../services/userService';
import { logger } from '../config/logger';
import { BadRequestError, NotFoundError, ForbiddenError } from '../middleware/errorHandler';

const router = Router();

/**
 * @route GET /api/users/profile
 * @desc Get current user's profile
 * @access Private
 */
router.get('/profile', authMiddleware, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    if (!req.user?.id) {
      throw new BadRequestError('User context not available');
    }

    const profile = await userService.getUserProfile(req.user.id);
    
    if (!profile) {
      throw new NotFoundError('User profile not found');
    }

    res.json({
      success: true,
      data: profile
    });
  } catch (error) {
    next(error);
  }
});

/**
 * @route PUT /api/users/profile
 * @desc Update current user's profile
 * @access Private
 */
router.put('/profile', authMiddleware, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    if (!req.user?.id) {
      throw new BadRequestError('User context not available');
    }

    const updateData: UpdateUserRequest = {
      name: req.body.name
      // Note: Users cannot change their own role or active status
    };

    const user = await userService.updateUser(req.user.id, updateData);

    logger.info('User profile updated', {
      userId: req.user.id,
      changes: updateData
    });

    res.json({
      success: true,
      data: user
    });
  } catch (error) {
    next(error);
  }
});

/**
 * @route GET /api/users/permissions
 * @desc Get current user's permissions
 * @access Private
 */
router.get('/permissions', authMiddleware, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    if (!req.user?.id || !req.user?.tenantId) {
      throw new BadRequestError('User context not available');
    }

    const permissions = await userService.getUserPermissions(req.user.id, req.user.tenantId);

    res.json({
      success: true,
      data: permissions
    });
  } catch (error) {
    next(error);
  }
});

/**
 * @route GET /api/users
 * @desc List users in current tenant
 * @access Private (Manager or Owner)
 */
router.get('/', authMiddleware, requireRole(['owner', 'manager']), async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    if (!req.user?.tenantId) {
      throw new BadRequestError('Tenant context not available');
    }

    const page = parseInt(req.query['page'] as string) || 1;
    const limit = parseInt(req.query['limit'] as string) || 20;
    const role = req.query['role'] as string;
    const isActiveParam = req.query['isActive'];
    const isActive = isActiveParam ? isActiveParam === 'true' : undefined;
    const search = req.query['search'] as string;

    const filters: any = {};
    if (role) filters.role = role;
    if (isActive !== undefined) filters.isActive = isActive;
    if (search) filters.search = search;

    const result = await userService.listTenantUsers(req.user.tenantId, page, limit, filters);

    res.json({
      success: true,
      data: result.users,
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
 * @route POST /api/users
 * @desc Create a new user
 * @access Private (Owner only)
 */
router.post('/', authMiddleware, requireRole(['owner']), async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    if (!req.user?.tenantId) {
      throw new BadRequestError('Tenant context not available');
    }

    const createData: CreateUserRequest = {
      ...req.body,
      tenantId: req.user.tenantId
    };

    // Validate required fields
    if (!createData.email || !createData.role) {
      throw new BadRequestError('Email and role are required');
    }

    const user = await userService.createUser(createData);

    logger.info('User created via API', {
      userId: user.id,
      createdBy: req.user.id,
      tenantId: req.user.tenantId
    });

    res.status(201).json({
      success: true,
      data: user
    });
  } catch (error) {
    next(error);
  }
});

/**
 * @route GET /api/users/:id
 * @desc Get user by ID
 * @access Private (Manager or Owner)
 */
router.get('/:id', authMiddleware, requireRole(['owner', 'manager']), async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.params['id'];
    if (!userId) {
      throw new BadRequestError('User ID is required');
    }

    const user = await userService.getUserById(userId);
    
    if (!user) {
      throw new NotFoundError('User not found');
    }

    // Check if user belongs to same tenant
    if (user.tenantId !== req.user?.tenantId) {
      throw new ForbiddenError('Access denied to this user');
    }

    res.json({
      success: true,
      data: user
    });
  } catch (error) {
    next(error);
  }
});

/**
 * @route PUT /api/users/:id
 * @desc Update user
 * @access Private (Owner only)
 */
router.put('/:id', authMiddleware, requireRole(['owner']), async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.params['id'];
    if (!userId) {
      throw new BadRequestError('User ID is required');
    }

    // Get user to check tenant
    const existingUser = await userService.getUserById(userId);
    if (!existingUser) {
      throw new NotFoundError('User not found');
    }

    // Check if user belongs to same tenant
    if (existingUser.tenantId !== req.user?.tenantId) {
      throw new ForbiddenError('Access denied to this user');
    }

    const updateData: UpdateUserRequest = req.body;
    const user = await userService.updateUser(userId, updateData);

    logger.info('User updated via API', {
      userId,
      updatedBy: req.user?.id,
      changes: updateData
    });

    res.json({
      success: true,
      data: user
    });
  } catch (error) {
    next(error);
  }
});

/**
 * @route DELETE /api/users/:id
 * @desc Delete user (soft delete)
 * @access Private (Owner only)
 */
router.delete('/:id', authMiddleware, requireRole(['owner']), async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.params['id'];
    if (!userId) {
      throw new BadRequestError('User ID is required');
    }

    // Prevent self-deletion
    if (userId === req.user?.id) {
      throw new BadRequestError('Cannot delete your own account');
    }

    // Get user to check tenant
    const existingUser = await userService.getUserById(userId);
    if (!existingUser) {
      throw new NotFoundError('User not found');
    }

    // Check if user belongs to same tenant
    if (existingUser.tenantId !== req.user?.tenantId) {
      throw new ForbiddenError('Access denied to this user');
    }

    await userService.deleteUser(userId);

    logger.info('User deleted via API', {
      userId,
      deletedBy: req.user?.id
    });

    res.json({
      success: true,
      message: 'User deleted successfully'
    });
  } catch (error) {
    next(error);
  }
});

/**
 * @route POST /api/users/invite
 * @desc Send user invitation
 * @access Private (Owner or Manager)
 */
router.post('/invite', authMiddleware, requireRole(['owner', 'manager']), async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    if (!req.user?.tenantId || !req.user?.id) {
      throw new BadRequestError('User context not available');
    }

    const invitation: UserInvitation = {
      ...req.body,
      tenantId: req.user.tenantId,
      invitedBy: req.user.id
    };

    // Validate required fields
    if (!invitation.email || !invitation.role) {
      throw new BadRequestError('Email and role are required');
    }

    const token = await userService.sendUserInvitation(invitation);

    logger.info('User invitation sent via API', {
      email: invitation.email,
      role: invitation.role,
      invitedBy: req.user.id,
      tenantId: req.user.tenantId
    });

    res.json({
      success: true,
      data: {
        token,
        message: 'Invitation sent successfully'
      }
    });
  } catch (error) {
    next(error);
  }
});

/**
 * @route POST /api/users/accept-invitation
 * @desc Accept user invitation
 * @access Public
 */
router.post('/accept-invitation', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { token } = req.body;

    if (!token) {
      throw new BadRequestError('Invitation token is required');
    }

    const result = await userService.acceptInvitation(token);

    if (!result.success) {
      throw new BadRequestError(result.error || 'Failed to accept invitation');
    }

    logger.info('User invitation accepted via API', { token });

    res.json({
      success: true,
      message: 'Invitation accepted successfully'
    });
  } catch (error) {
    next(error);
  }
});

/**
 * @route GET /api/users/:id/permissions
 * @desc Get user permissions
 * @access Private (Owner or Manager)
 */
router.get('/:id/permissions', authMiddleware, requireRole(['owner', 'manager']), async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.params['id'];
    if (!userId) {
      throw new BadRequestError('User ID is required');
    }

    if (!req.user?.tenantId) {
      throw new BadRequestError('Tenant context not available');
    }

    // Get user to check tenant
    const user = await userService.getUserById(userId);
    if (!user) {
      throw new NotFoundError('User not found');
    }

    // Check if user belongs to same tenant
    if (user.tenantId !== req.user.tenantId) {
      throw new ForbiddenError('Access denied to this user');
    }

    const permissions = await userService.getUserPermissions(userId, req.user.tenantId);

    res.json({
      success: true,
      data: permissions
    });
  } catch (error) {
    next(error);
  }
});

/**
 * @route POST /api/users/:id/check-permission
 * @desc Check if user has specific permission
 * @access Private (Owner or Manager)
 */
router.post('/:id/check-permission', authMiddleware, requireRole(['owner', 'manager']), async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.params['id'];
    if (!userId) {
      throw new BadRequestError('User ID is required');
    }

    const { resource, action } = req.body;
    if (!resource || !action) {
      throw new BadRequestError('Resource and action are required');
    }

    if (!req.user?.tenantId) {
      throw new BadRequestError('Tenant context not available');
    }

    const hasPermission = await userService.hasPermission(userId, resource, action, req.user.tenantId);

    res.json({
      success: true,
      data: {
        hasPermission,
        resource,
        action,
        userId
      }
    });
  } catch (error) {
    next(error);
  }
});

export default router;