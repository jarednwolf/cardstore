import { Router, Request, Response } from 'express';
import { body, validationResult } from 'express-validator';
import { asyncHandler } from '../middleware/errorHandler';
import { authService } from '../services/authService';
import { logger } from '../config/logger';

const router = Router();

// Create tenant with owner signup
router.post('/create-tenant', [
  body('email').isEmail().normalizeEmail(),
  body('password').isLength({ min: 8 }).withMessage('Password must be at least 8 characters'),
  body('fullName').notEmpty().trim().withMessage('Full name is required'),
  body('tenantName').notEmpty().trim().withMessage('Store name is required'),
  body('tenantSubdomain')
    .notEmpty()
    .trim()
    .isLength({ min: 3 })
    .withMessage('Subdomain must be at least 3 characters')
    .matches(/^[a-z0-9-]+$/)
    .withMessage('Subdomain can only contain lowercase letters, numbers, and hyphens')
], asyncHandler(async (req: Request, res: Response) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Invalid input data',
        details: errors.array(),
        timestamp: new Date().toISOString(),
        requestId: req.headers['x-request-id'] || '',
      },
    });
  }

  const { email, password, fullName, tenantName, tenantSubdomain } = req.body;

  // Check if subdomain is available (basic check)
  const reservedSubdomains = ['www', 'api', 'admin', 'app', 'mail', 'ftp', 'demo', 'test'];
  if (reservedSubdomains.includes(tenantSubdomain.toLowerCase())) {
    return res.status(400).json({
      error: {
        code: 'SUBDOMAIN_RESERVED',
        message: 'This subdomain is reserved and cannot be used',
        timestamp: new Date().toISOString(),
        requestId: req.headers['x-request-id'] || '',
      },
    });
  }

  const result = await authService.signUp({
    email,
    password,
    fullName,
    tenantName,
    tenantSubdomain
  });

  if (!result.success) {
    return res.status(400).json({
      error: {
        code: 'TENANT_CREATION_FAILED',
        message: result.error || 'Failed to create tenant and user account',
        timestamp: new Date().toISOString(),
        requestId: req.headers['x-request-id'] || '',
      },
    });
  }

  logger.info('Tenant and owner created successfully', { 
    userId: result.user?.id, 
    email,
    tenantId: result.user?.tenantId,
    tenantSubdomain
  });

  res.status(201).json({
    data: {
      user: result.user,
      session: result.session,
      tenant: {
        subdomain: tenantSubdomain,
        name: tenantName
      },
      message: 'Store created successfully! You can now start managing your inventory.',
      nextSteps: [
        'Set up your store settings',
        'Add your first products',
        'Configure payment methods',
        'Connect to sales channels'
      ]
    }
  });
}));

// Check subdomain availability
router.get('/check-subdomain/:subdomain', asyncHandler(async (req: Request, res: Response) => {
  const { subdomain } = req.params;

  if (!subdomain || subdomain.length < 3) {
    return res.status(400).json({
      error: {
        code: 'INVALID_SUBDOMAIN',
        message: 'Subdomain must be at least 3 characters long',
        timestamp: new Date().toISOString(),
        requestId: req.headers['x-request-id'] || '',
      },
    });
  }

  if (!/^[a-z0-9-]+$/.test(subdomain)) {
    return res.status(400).json({
      error: {
        code: 'INVALID_SUBDOMAIN_FORMAT',
        message: 'Subdomain can only contain lowercase letters, numbers, and hyphens',
        timestamp: new Date().toISOString(),
        requestId: req.headers['x-request-id'] || '',
      },
    });
  }

  // Check reserved subdomains
  const reservedSubdomains = ['www', 'api', 'admin', 'app', 'mail', 'ftp', 'demo', 'test'];
  if (reservedSubdomains.includes(subdomain.toLowerCase())) {
    return res.json({
      data: {
        available: false,
        reason: 'reserved',
        message: 'This subdomain is reserved and cannot be used'
      }
    });
  }

  // TODO: Check database for existing subdomains when Supabase is configured
  // For now, we'll assume it's available if not reserved
  res.json({
    data: {
      available: true,
      subdomain: subdomain,
      message: 'Subdomain is available'
    }
  });
}));

// Invite user to tenant
router.post('/invite-user', [
  body('email').isEmail().normalizeEmail(),
  body('role').isIn(['admin', 'manager', 'staff', 'viewer']).withMessage('Invalid role'),
  body('tenantId').isUUID().withMessage('Valid tenant ID is required')
], asyncHandler(async (req: Request, res: Response) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Invalid input data',
        details: errors.array(),
        timestamp: new Date().toISOString(),
        requestId: req.headers['x-request-id'] || '',
      },
    });
  }

  const { email, role, tenantId } = req.body;
  
  // Get current user from auth middleware
  const invitedBy = (req as any).user?.id || 'system';

  const result = await authService.createTenantInvitation(tenantId, email, role, invitedBy);

  if (!result.success) {
    return res.status(400).json({
      error: {
        code: 'INVITATION_FAILED',
        message: result.error || 'Failed to create invitation',
        timestamp: new Date().toISOString(),
        requestId: req.headers['x-request-id'] || '',
      },
    });
  }

  logger.info('User invitation created', { 
    email,
    role,
    tenantId,
    invitedBy,
    token: result.token
  });

  res.status(201).json({
    data: {
      message: 'Invitation sent successfully',
      email,
      role,
      invitationToken: result.token, // In production, this would be sent via email
      expiresIn: '7 days'
    }
  });
}));

// Accept invitation
router.post('/accept-invitation', [
  body('token').notEmpty().withMessage('Invitation token is required')
], asyncHandler(async (req: Request, res: Response) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Invalid input data',
        details: errors.array(),
        timestamp: new Date().toISOString(),
        requestId: req.headers['x-request-id'] || '',
      },
    });
  }

  const { token } = req.body;

  const result = await authService.acceptInvitation(token);

  if (!result.success) {
    return res.status(400).json({
      error: {
        code: 'INVITATION_ACCEPTANCE_FAILED',
        message: result.error || 'Failed to accept invitation',
        timestamp: new Date().toISOString(),
        requestId: req.headers['x-request-id'] || '',
      },
    });
  }

  logger.info('Invitation accepted successfully', { token });

  res.json({
    data: {
      message: 'Invitation accepted successfully. You now have access to the store.',
      redirectTo: '/dashboard'
    }
  });
}));

// Get onboarding status
router.get('/status', asyncHandler(async (req: Request, res: Response) => {
  // Get current user from auth middleware and check onboarding status
  const userId = (req as any).user?.id;
  const tenantId = (req as any).tenantId;
  
  res.json({
    data: {
      hasCompletedOnboarding: false,
      currentStep: 'create-tenant',
      steps: [
        {
          id: 'create-tenant',
          title: 'Create Your Store',
          description: 'Set up your store name and subdomain',
          completed: false
        },
        {
          id: 'store-settings',
          title: 'Configure Store Settings',
          description: 'Set up your store preferences and contact information',
          completed: false
        },
        {
          id: 'add-products',
          title: 'Add Your First Products',
          description: 'Start building your inventory',
          completed: false
        },
        {
          id: 'connect-channels',
          title: 'Connect Sales Channels',
          description: 'Link your Shopify store or other sales platforms',
          completed: false
        }
      ]
    }
  });
}));

export { router as onboardingRoutes };