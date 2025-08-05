// Vercel serverless function entry point
// Simplified authentication for immediate deployment

const express = require('express');
const cors = require('cors');

// Create Express app for serverless function
const app = express();

// Basic middleware setup for serverless
app.use(cors({
  origin: [
    'https://cardstore-woad.vercel.app',
    'https://deckstack.com',
    'https://www.deckstack.com',
    'http://localhost:3000',
    'http://localhost:3005'
  ],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Tenant-ID', 'X-Correlation-ID'],
}));

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Simple in-memory auth for development/demo
const users = new Map();
const sessions = new Map();

// Create default admin user with simple password check
const defaultEmail = 'admin@deckstack.com';
const defaultPassword = 'admin123';

// Initialize default user
function initializeDefaultUser() {
  if (!users.has(defaultEmail)) {
    const userId = 'dev-admin-user-id';
    
    users.set(defaultEmail, {
      id: userId,
      email: defaultEmail,
      password: defaultPassword, // Simple password for demo
      full_name: 'Admin User',
      tenant_id: 'default-tenant',
      role: 'admin',
      is_active: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      last_login_at: null
    });
  }
}

// Initialize on startup
initializeDefaultUser();

// Helper function to create simple session
function createSession(user) {
  const sessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  const accessToken = `token_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  const refreshToken = `refresh_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

  const sessionData = {
    user: {
      id: user.id,
      email: user.email,
      role: user.role,
      tenantId: user.tenant_id
    },
    createdAt: new Date()
  };

  sessions.set(accessToken, sessionData);
  sessions.set(refreshToken, sessionData);

  return {
    access_token: accessToken,
    refresh_token: refreshToken,
    expires_in: 86400,
    token_type: 'Bearer'
  };
}

// Helper function to transform user data
function transformUser(user) {
  return {
    id: user.id,
    email: user.email,
    name: user.full_name,
    role: user.role,
    tenantId: user.tenant_id,
    lastLoginAt: new Date(user.last_login_at || user.created_at),
    isActive: user.is_active,
    createdAt: new Date(user.created_at),
    updatedAt: new Date(user.updated_at)
  };
}

// Error handler
function handleError(res, error, statusCode = 500) {
  console.error('API Error:', error);
  res.status(statusCode).json({
    error: {
      code: statusCode === 401 ? 'LOGIN_FAILED' : 'INTERNAL_SERVER_ERROR',
      message: error.message || 'An error occurred',
      timestamp: new Date().toISOString(),
      requestId: Math.random().toString(36).substr(2, 9),
    }
  });
}

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    version: '1.0.0',
    users: users.size,
    sessions: sessions.size
  });
});

// Auth endpoints
app.post('/api/auth/login', async (req, res) => {
  try {
    console.log('Login attempt:', { body: req.body });
    
    const { email, password } = req.body;

    if (!email || !password) {
      return handleError(res, new Error('Email and password are required'), 400);
    }

    // Find user
    const user = users.get(email);
    if (!user) {
      console.log('User not found:', email);
      return handleError(res, new Error('Invalid credentials'), 401);
    }

    // Simple password check
    if (password !== user.password) {
      console.log('Invalid password for user:', email);
      return handleError(res, new Error('Invalid credentials'), 401);
    }

    // Update last login
    user.last_login_at = new Date().toISOString();
    users.set(email, user);

    // Create session
    const session = createSession(user);
    const userResponse = transformUser(user);

    console.log('Login successful for:', email);

    res.json({
      data: {
        user: userResponse,
        session: session,
        message: 'Login successful'
      }
    });

  } catch (error) {
    console.error('Login error:', error);
    handleError(res, error, 500);
  }
});

app.post('/api/auth/signup', async (req, res) => {
  try {
    console.log('Signup attempt:', { body: req.body });
    
    const { email, password, fullName, tenantName } = req.body;

    if (!email || !password) {
      return handleError(res, new Error('Email and password are required'), 400);
    }

    // Check if user already exists
    if (users.has(email)) {
      return handleError(res, new Error('User already exists'), 400);
    }

    const userId = `dev-user-${Date.now()}`;
    const tenantId = tenantName ? `tenant-${Date.now()}` : 'default-tenant';

    // Create user
    const user = {
      id: userId,
      email,
      password: password, // Simple password storage for demo
      full_name: fullName || email,
      tenant_id: tenantId,
      role: 'admin',
      is_active: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      last_login_at: null
    };

    users.set(email, user);

    // Create session
    const session = createSession(user);
    const userResponse = transformUser(user);

    console.log('Signup successful for:', email);

    res.status(201).json({
      data: {
        user: userResponse,
        session: session,
        message: 'Account created successfully'
      }
    });

  } catch (error) {
    console.error('Signup error:', error);
    handleError(res, error, 500);
  }
});

app.post('/api/auth/logout', (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    const token = authHeader?.startsWith('Bearer ') ? authHeader.substring(7) : undefined;

    if (token) {
      sessions.delete(token);
    }

    res.json({
      data: {
        message: 'Logout successful'
      }
    });

  } catch (error) {
    handleError(res, error, 500);
  }
});

app.get('/api/auth/me', (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return handleError(res, new Error('Authorization token required'), 401);
    }

    const token = authHeader.substring(7);
    const sessionData = sessions.get(token);
    
    if (!sessionData) {
      return handleError(res, new Error('Invalid or expired token'), 401);
    }

    const user = users.get(sessionData.user.email);
    
    if (!user) {
      return handleError(res, new Error('User not found'), 401);
    }

    const userResponse = transformUser(user);
    res.json({
      data: {
        user: userResponse
      }
    });

  } catch (error) {
    handleError(res, error, 500);
  }
});

// Debug endpoint to see current state
app.get('/api/debug', (req, res) => {
  res.json({
    users: Array.from(users.keys()),
    sessions: sessions.size,
    timestamp: new Date().toISOString()
  });
});

// Catch-all for other API routes
app.all('/api/*', (req, res) => {
  res.status(404).json({
    error: {
      code: 'NOT_FOUND',
      message: `Route ${req.method} ${req.path} not found`,
      timestamp: new Date().toISOString(),
      requestId: Math.random().toString(36).substr(2, 9),
    }
  });
});

// Default route
app.get('/', (req, res) => {
  res.json({
    message: 'DeckStack API is running',
    timestamp: new Date().toISOString(),
    version: '1.0.0'
  });
});

module.exports = app;