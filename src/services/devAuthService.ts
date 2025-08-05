import { logger } from '../config/logger';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import {
  AuthResult,
  SignUpData,
  SignInData,
  User,
  AuthServiceInterface,
  AuthSession
} from '../types/auth';

// In-memory storage for development (replace with database in production)
const users: Map<string, any> = new Map();
const sessions: Map<string, any> = new Map();

export class DevAuthService implements AuthServiceInterface {
  private jwtSecret: string;

  constructor() {
    this.jwtSecret = process.env['JWT_SECRET'] || 'dev-secret-key-change-in-production';
    
    // Create a default admin user for development
    this.createDefaultUser();
  }

  private async createDefaultUser() {
    const defaultEmail = 'admin@deckstack.com';
    if (!users.has(defaultEmail)) {
      const hashedPassword = await bcrypt.hash('admin123', 10);
      const userId = 'dev-admin-user-id';
      
      users.set(defaultEmail, {
        id: userId,
        email: defaultEmail,
        password: hashedPassword,
        full_name: 'Admin User',
        tenant_id: 'default-tenant',
        role: 'admin',
        is_active: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        last_login_at: null
      });

      logger.info('Created default development user', { email: defaultEmail });
    }
  }

  /**
   * Sign up a new user
   */
  async signUp(data: SignUpData): Promise<AuthResult> {
    try {
      const { email, password, fullName, tenantName } = data;

      // Check if user already exists
      if (users.has(email)) {
        return { success: false, error: 'User already exists' };
      }

      // Hash password
      const hashedPassword = await bcrypt.hash(password, 10);
      const userId = `dev-user-${Date.now()}`;
      const tenantId = tenantName ? `tenant-${Date.now()}` : 'default-tenant';

      // Create user
      const user = {
        id: userId,
        email,
        password: hashedPassword,
        full_name: fullName || email,
        tenant_id: tenantId,
        role: 'admin', // First user is admin
        is_active: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        last_login_at: null
      };

      users.set(email, user);

      // Create session
      const session = this.createSession(user);

      // Transform to our User type
      const userResponse: User = {
        id: user.id,
        email: user.email,
        name: user.full_name,
        role: user.role as 'owner' | 'manager' | 'staff' | 'fulfillment',
        tenantId: user.tenant_id,
        lastLoginAt: new Date(),
        isActive: user.is_active,
        createdAt: new Date(user.created_at),
        updatedAt: new Date(user.updated_at)
      };

      logger.info('User signed up successfully (dev mode)', { userId, email });

      return {
        success: true,
        user: userResponse,
        session
      };

    } catch (error) {
      logger.error('Dev auth service signup error', { error });
      return { success: false, error: 'Internal server error' };
    }
  }

  /**
   * Sign in an existing user
   */
  async signIn(data: SignInData): Promise<AuthResult> {
    try {
      const { email, password } = data;

      // Find user
      const user = users.get(email);
      if (!user) {
        return { success: false, error: 'Invalid credentials' };
      }

      // Check password
      const isValidPassword = await bcrypt.compare(password, user.password);
      if (!isValidPassword) {
        return { success: false, error: 'Invalid credentials' };
      }

      // Update last login
      user.last_login_at = new Date().toISOString();
      users.set(email, user);

      // Create session
      const session = this.createSession(user);

      // Transform to our User type
      const userResponse: User = {
        id: user.id,
        email: user.email,
        name: user.full_name,
        role: user.role,
        tenantId: user.tenant_id,
        lastLoginAt: new Date(user.last_login_at),
        isActive: user.is_active,
        createdAt: new Date(user.created_at),
        updatedAt: new Date(user.updated_at)
      };

      logger.info('User signed in successfully (dev mode)', { userId: user.id, email });

      return {
        success: true,
        user: userResponse,
        session
      };

    } catch (error) {
      logger.error('Dev auth service signin error', { error });
      return { success: false, error: 'Internal server error' };
    }
  }

  /**
   * Sign out user
   */
  async signOut(accessToken?: string): Promise<{ success: boolean; error?: string }> {
    try {
      if (accessToken) {
        sessions.delete(accessToken);
      }
      return { success: true };
    } catch (error) {
      logger.error('Dev auth service signout error', { error });
      return { success: false, error: 'Internal server error' };
    }
  }

  /**
   * Refresh access token
   */
  async refreshToken(refreshToken: string): Promise<AuthResult> {
    try {
      const session = sessions.get(refreshToken);
      if (!session) {
        return { success: false, error: 'Invalid refresh token' };
      }

      const user = users.get(session.user.email);
      if (!user) {
        return { success: false, error: 'User not found' };
      }

      // Create new session
      const newSession = this.createSession(user);

      // Transform to our User type
      const userResponse: User = {
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

      return {
        success: true,
        user: userResponse,
        session: newSession
      };

    } catch (error) {
      logger.error('Dev auth service refresh error', { error });
      return { success: false, error: 'Internal server error' };
    }
  }

  /**
   * Verify access token and get user
   */
  async verifyToken(accessToken: string): Promise<User | null> {
    try {
      const decoded = jwt.verify(accessToken, this.jwtSecret) as any;
      const user = users.get(decoded.email);
      
      if (!user) {
        return null;
      }

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

    } catch (error) {
      logger.debug('Token verification failed (dev mode)', { error: error instanceof Error ? error.message : 'Unknown error' });
      return null;
    }
  }

  /**
   * Get user by ID
   */
  async getUserById(userId: string): Promise<User | null> {
    try {
      for (const [email, user] of users.entries()) {
        if (user.id === userId) {
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
      }
      return null;
    } catch (error) {
      logger.error('Dev auth service getUserById error', { error, userId });
      return null;
    }
  }

  /**
   * Create session tokens
   */
  private createSession(user: any): AuthSession {
    const payload = {
      id: user.id,
      email: user.email,
      role: user.role,
      tenantId: user.tenant_id
    };

    const accessToken = jwt.sign(payload, this.jwtSecret, { expiresIn: '24h' });
    const refreshToken = jwt.sign(payload, this.jwtSecret, { expiresIn: '7d' });

    // Store session
    sessions.set(accessToken, { user: payload, createdAt: new Date() });
    sessions.set(refreshToken, { user: payload, createdAt: new Date() });

    return {
      access_token: accessToken,
      refresh_token: refreshToken,
      expires_in: 86400, // 24 hours
      token_type: 'Bearer'
    };
  }

  /**
   * Get all users (for development/testing)
   */
  getAllUsers(): any[] {
    return Array.from(users.values()).map(user => ({
      id: user.id,
      email: user.email,
      full_name: user.full_name,
      role: user.role,
      tenant_id: user.tenant_id,
      is_active: user.is_active,
      created_at: user.created_at,
      last_login_at: user.last_login_at
    }));
  }
}

export const devAuthService = new DevAuthService();