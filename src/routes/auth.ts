import { Router, Request, Response } from 'express';
import { body, validationResult } from 'express-validator';
import { asyncHandler } from '../middleware/errorHandler';
import { authService } from '../services/authService';
import { logger } from '../config/logger';

const router = Router();

// Sign up endpoint
router.post('/signup', [
  body('email').isEmail().normalizeEmail(),
  body('password').isLength({ min: 8 }).withMessage('Password must be at least 8 characters'),
  body('fullName').optional().trim(),
  body('tenantName').optional().trim(),
  body('tenantSubdomain').optional().trim().isLength({ min: 3 }).withMessage('Subdomain must be at least 3 characters')
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
        code: 'SIGNUP_FAILED',
        message: result.error || 'Sign up failed',
        timestamp: new Date().toISOString(),
        requestId: req.headers['x-request-id'] || '',
      },
    });
  }

  logger.info('User signed up successfully', {
    userId: result.user?.id,
    email,
    tenantId: result.user?.tenantId
  });

  res.status(201).json({
    data: {
      user: result.user,
      session: result.session,
      message: 'Account created successfully'
    }
  });
}));

// Login endpoint
router.post('/login', [
  body('email').isEmail().normalizeEmail(),
  body('password').notEmpty().withMessage('Password is required')
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

  const { email, password } = req.body;

  const result = await authService.signIn({ email, password });

  if (!result.success) {
    return res.status(401).json({
      error: {
        code: 'LOGIN_FAILED',
        message: result.error || 'Invalid credentials',
        timestamp: new Date().toISOString(),
        requestId: req.headers['x-request-id'] || '',
      },
    });
  }

  logger.info('User logged in successfully', {
    userId: result.user?.id,
    email,
    tenantId: result.user?.tenantId
  });

  res.json({
    data: {
      user: result.user,
      session: result.session,
      message: 'Login successful'
    }
  });
}));

// Logout endpoint
router.post('/logout', asyncHandler(async (req: Request, res: Response) => {
  const authHeader = req.headers.authorization;
  const token = authHeader?.startsWith('Bearer ') ? authHeader.substring(7) : undefined;

  const result = await authService.signOut(token);

  if (!result.success) {
    return res.status(400).json({
      error: {
        code: 'LOGOUT_FAILED',
        message: result.error || 'Logout failed',
        timestamp: new Date().toISOString(),
        requestId: req.headers['x-request-id'] || '',
      },
    });
  }

  logger.info('User logged out successfully');

  res.json({
    data: {
      message: 'Logout successful'
    }
  });
}));

// Refresh token endpoint
router.post('/refresh', [
  body('refreshToken').notEmpty().withMessage('Refresh token is required')
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

  const { refreshToken } = req.body;

  const result = await authService.refreshToken(refreshToken);

  if (!result.success) {
    return res.status(401).json({
      error: {
        code: 'TOKEN_REFRESH_FAILED',
        message: result.error || 'Token refresh failed',
        timestamp: new Date().toISOString(),
        requestId: req.headers['x-request-id'] || '',
      },
    });
  }

  logger.info('Token refreshed successfully', { userId: result.user?.id });

  res.json({
    data: {
      user: result.user,
      session: result.session,
      message: 'Token refreshed successfully'
    }
  });
}));

// Get current user endpoint
router.get('/me', asyncHandler(async (req: Request, res: Response) => {
  const authHeader = req.headers.authorization;
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({
      error: {
        code: 'MISSING_TOKEN',
        message: 'Authorization token required',
        timestamp: new Date().toISOString(),
        requestId: req.headers['x-request-id'] || '',
      },
    });
  }

  const token = authHeader.substring(7);
  const user = await authService.verifyToken(token);

  if (!user) {
    return res.status(401).json({
      error: {
        code: 'INVALID_TOKEN',
        message: 'Invalid or expired token',
        timestamp: new Date().toISOString(),
        requestId: req.headers['x-request-id'] || '',
      },
    });
  }

  res.json({
    data: {
      user
    }
  });
}));

export { router as authRoutes };