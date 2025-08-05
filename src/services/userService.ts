import { PrismaClient } from '@prisma/client';
import { logger } from '../config/logger';
import { User, RequestContext } from '../types';
import { authService } from './authService';

const prisma = new PrismaClient();

export interface CreateUserRequest {
  email: string;
  name?: string;
  role: 'owner' | 'manager' | 'staff' | 'fulfillment';
  tenantId: string;
  password?: string;
  sendInvitation?: boolean;
}

export interface UpdateUserRequest {
  name?: string;
  role?: 'owner' | 'manager' | 'staff' | 'fulfillment';
  isActive?: boolean;
}

export interface UserInvitation {
  email: string;
  role: 'owner' | 'manager' | 'staff' | 'fulfillment';
  tenantId: string;
  invitedBy: string;
  message?: string;
}

export interface UserProfile {
  id: string;
  email: string;
  name: string | undefined;
  role: string;
  tenantId: string;
  isActive: boolean;
  lastLoginAt: Date | undefined;
  createdAt: Date;
  updatedAt: Date;
  permissions: string[];
  tenants: Array<{
    id: string;
    name: string;
    subdomain: string;
    role: string;
  }>;
}

export interface UserPermissions {
  resources: Record<string, string[]>; // resource -> actions
  roles: string[];
  tenantId: string;
}

export class UserService {
  /**
   * Create a new user
   */
  async createUser(data: CreateUserRequest): Promise<User> {
    try {
      // Check if user already exists
      const existingUser = await prisma.user.findUnique({
        where: { email: data.email }
      });

      if (existingUser) {
        throw new Error(`User with email '${data.email}' already exists`);
      }

      // Validate tenant exists
      const tenant = await prisma.tenant.findUnique({
        where: { id: data.tenantId }
      });

      if (!tenant) {
        throw new Error('Tenant not found');
      }

      // Create user
      const user = await prisma.user.create({
        data: {
          email: data.email,
          name: data.name || data.email,
          role: data.role,
          tenantId: data.tenantId,
          isActive: true
        }
      });

      // Send invitation if requested
      if (data.sendInvitation) {
        await this.sendUserInvitation({
          email: data.email,
          role: data.role,
          tenantId: data.tenantId,
          invitedBy: 'system'
        });
      }

      logger.info('User created successfully', {
        userId: user.id,
        email: user.email,
        tenantId: user.tenantId,
        role: user.role
      });

      return this.transformUser(user);
    } catch (error) {
      logger.error('Failed to create user', { error, data });
      throw error;
    }
  }

  /**
   * Get user by ID
   */
  async getUserById(userId: string): Promise<User | null> {
    try {
      const user = await prisma.user.findUnique({
        where: { id: userId }
      });

      return user ? this.transformUser(user) : null;
    } catch (error) {
      logger.error('Failed to get user', { error, userId });
      throw error;
    }
  }

  /**
   * Get user by email
   */
  async getUserByEmail(email: string): Promise<User | null> {
    try {
      const user = await prisma.user.findUnique({
        where: { email }
      });

      return user ? this.transformUser(user) : null;
    } catch (error) {
      logger.error('Failed to get user by email', { error, email });
      throw error;
    }
  }

  /**
   * Get user profile with permissions and tenants
   */
  async getUserProfile(userId: string): Promise<UserProfile | null> {
    try {
      const user = await prisma.user.findUnique({
        where: { id: userId },
        include: {
          tenant: true
        }
      });

      if (!user) {
        return null;
      }

      // Get user permissions
      const permissions = await this.getUserPermissions(userId, user.tenantId);

      // For now, user belongs to single tenant
      // TODO: Implement multi-tenant user support
      const tenants = [{
        id: user.tenant.id,
        name: user.tenant.name,
        subdomain: user.tenant.subdomain,
        role: user.role
      }];

      return {
        id: user.id,
        email: user.email,
        name: user.name || undefined,
        role: user.role,
        tenantId: user.tenantId,
        isActive: user.isActive,
        lastLoginAt: user.lastLoginAt || undefined,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
        permissions: permissions.roles,
        tenants
      };
    } catch (error) {
      logger.error('Failed to get user profile', { error, userId });
      throw error;
    }
  }

  /**
   * Update user
   */
  async updateUser(userId: string, data: UpdateUserRequest): Promise<User> {
    try {
      const user = await prisma.user.update({
        where: { id: userId },
        data: {
          ...(data.name && { name: data.name }),
          ...(data.role && { role: data.role }),
          ...(data.isActive !== undefined && { isActive: data.isActive }),
          updatedAt: new Date()
        }
      });

      logger.info('User updated successfully', { userId, changes: data });

      return this.transformUser(user);
    } catch (error) {
      logger.error('Failed to update user', { error, userId, data });
      throw error;
    }
  }

  /**
   * List users for a tenant
   */
  async listTenantUsers(
    tenantId: string,
    page: number = 1,
    limit: number = 20,
    filters?: {
      role?: string;
      isActive?: boolean;
      search?: string;
    }
  ): Promise<{ users: User[]; total: number }> {
    try {
      const where: any = { tenantId };

      if (filters?.role) {
        where.role = filters.role;
      }

      if (filters?.isActive !== undefined) {
        where.isActive = filters.isActive;
      }

      if (filters?.search) {
        where.OR = [
          { name: { contains: filters.search, mode: 'insensitive' } },
          { email: { contains: filters.search, mode: 'insensitive' } }
        ];
      }

      const [users, total] = await Promise.all([
        prisma.user.findMany({
          where,
          skip: (page - 1) * limit,
          take: limit,
          orderBy: { createdAt: 'desc' }
        }),
        prisma.user.count({ where })
      ]);

      return {
        users: users.map((user: any) => this.transformUser(user)),
        total
      };
    } catch (error) {
      logger.error('Failed to list tenant users', { error, tenantId, filters });
      throw error;
    }
  }

  /**
   * Delete user (soft delete)
   */
  async deleteUser(userId: string): Promise<void> {
    try {
      await prisma.user.update({
        where: { id: userId },
        data: {
          isActive: false,
          updatedAt: new Date()
        }
      });

      logger.info('User deleted (soft)', { userId });
    } catch (error) {
      logger.error('Failed to delete user', { error, userId });
      throw error;
    }
  }

  /**
   * Permanently delete user
   */
  async permanentlyDeleteUser(userId: string): Promise<void> {
    try {
      await prisma.user.delete({
        where: { id: userId }
      });

      logger.warn('User permanently deleted', { userId });
    } catch (error) {
      logger.error('Failed to permanently delete user', { error, userId });
      throw error;
    }
  }

  /**
   * Send user invitation
   */
  async sendUserInvitation(invitation: UserInvitation): Promise<string> {
    try {
      // Generate invitation token
      const token = this.generateInvitationToken();

      // Store invitation (you might want to create an invitations table)
      // For now, we'll use the auth service
      const result = await authService.createTenantInvitation(
        invitation.tenantId,
        invitation.email,
        invitation.role,
        invitation.invitedBy
      );

      if (!result.success) {
        throw new Error(result.error || 'Failed to create invitation');
      }

      // Email invitation will be implemented in next phase
      logger.info('User invitation created (email sending pending)', {
        email: invitation.email,
        tenantId: invitation.tenantId,
        role: invitation.role,
        invitedBy: invitation.invitedBy
      });

      return result.token || token;
    } catch (error) {
      logger.error('Failed to send user invitation', { error, invitation });
      throw error;
    }
  }

  /**
   * Accept user invitation
   */
  async acceptInvitation(token: string): Promise<{ success: boolean; error?: string }> {
    try {
      return await authService.acceptInvitation(token);
    } catch (error) {
      logger.error('Failed to accept invitation', { error, token });
      throw error;
    }
  }

  /**
   * Get user permissions
   */
  async getUserPermissions(userId: string, tenantId: string): Promise<UserPermissions> {
    try {
      const user = await prisma.user.findUnique({
        where: { id: userId }
      });

      if (!user) {
        throw new Error('User not found');
      }

      // Define role-based permissions
      const rolePermissions = this.getRolePermissions(user.role);

      return {
        resources: rolePermissions,
        roles: [user.role],
        tenantId
      };
    } catch (error) {
      logger.error('Failed to get user permissions', { error, userId, tenantId });
      throw error;
    }
  }

  /**
   * Check if user has permission
   */
  async hasPermission(
    userId: string,
    resource: string,
    action: string,
    tenantId: string
  ): Promise<boolean> {
    try {
      const permissions = await this.getUserPermissions(userId, tenantId);
      
      // Check if user has permission for this resource and action
      const resourcePermissions = permissions.resources[resource] || [];
      return resourcePermissions.includes(action) || resourcePermissions.includes('*');
    } catch (error) {
      logger.error('Failed to check user permission', { error, userId, resource, action });
      return false;
    }
  }

  /**
   * Update user last login
   */
  async updateLastLogin(userId: string): Promise<void> {
    try {
      await prisma.user.update({
        where: { id: userId },
        data: { lastLoginAt: new Date() }
      });
    } catch (error) {
      logger.error('Failed to update last login', { error, userId });
    }
  }

  /**
   * Get role-based permissions
   */
  private getRolePermissions(role: string): Record<string, string[]> {
    const permissions: Record<string, Record<string, string[]>> = {
      owner: {
        '*': ['*'] // Full access
      },
      manager: {
        products: ['create', 'read', 'update', 'delete'],
        inventory: ['create', 'read', 'update', 'delete'],
        orders: ['create', 'read', 'update', 'delete'],
        users: ['read'],
        reports: ['read'],
        settings: ['read', 'update']
      },
      staff: {
        products: ['read', 'update'],
        inventory: ['read', 'update'],
        orders: ['create', 'read', 'update'],
        reports: ['read']
      },
      fulfillment: {
        orders: ['read', 'update'],
        inventory: ['read', 'update'],
        shipping: ['create', 'read', 'update']
      }
    };

    return permissions[role] || {};
  }

  /**
   * Generate invitation token
   */
  private generateInvitationToken(): string {
    return require('crypto').randomBytes(32).toString('hex');
  }

  /**
   * Transform database user to API user
   */
  private transformUser(user: any): User {
    return {
      id: user.id,
      tenantId: user.tenantId,
      email: user.email,
      name: user.name || undefined,
      role: user.role,
      isActive: user.isActive,
      lastLoginAt: user.lastLoginAt || undefined,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt
    };
  }
}

export const userService = new UserService();