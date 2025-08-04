import { PrismaClient } from '@prisma/client';
import { logger } from '../config/logger';
import { Tenant, User } from '../types';
import { getApiCallCount } from '../middleware/apiTracking';

const prisma = new PrismaClient();

export interface CreateTenantRequest {
  name: string;
  subdomain: string;
  settings?: TenantSettings;
  ownerEmail?: string;
  ownerName?: string;
}

export interface UpdateTenantRequest {
  name?: string;
  subdomain?: string;
  settings?: Partial<TenantSettings>;
  isActive?: boolean;
}

export interface TenantSettings {
  // Business Information
  businessName: string;
  businessType: 'retail' | 'wholesale' | 'marketplace';
  industry: string;
  
  // Feature Flags
  features: {
    multiLocation: boolean;
    advancedReporting: boolean;
    apiAccess: boolean;
    customBranding: boolean;
    bulkOperations: boolean;
    webhooks: boolean;
  };
  
  // Integration Settings
  integrations: {
    shopify?: {
      enabled: boolean;
      shopUrl?: string;
      accessToken?: string;
    };
    quickbooks?: {
      enabled: boolean;
      companyId?: string;
      accessToken?: string;
    };
    shipping?: {
      carriers: string[];
      defaultCarrier?: string;
      autoFulfillment: boolean;
    };
  };
  
  // Security Settings
  security: {
    requireMFA: boolean;
    sessionTimeout: number; // minutes
    ipWhitelist?: string[];
    auditLogging: boolean;
    passwordPolicy: {
      minLength: number;
      requireUppercase: boolean;
      requireLowercase: boolean;
      requireNumbers: boolean;
      requireSymbols: boolean;
    };
  };
  
  // Billing Information
  billing: {
    plan: 'starter' | 'professional' | 'enterprise';
    billingCycle: 'monthly' | 'annual';
    customPricing?: boolean;
    maxUsers?: number;
    maxProducts?: number;
    maxOrders?: number;
  };
  
  // Notification Settings
  notifications: {
    email: {
      lowStock: boolean;
      newOrders: boolean;
      systemUpdates: boolean;
    };
    slack?: {
      enabled: boolean;
      webhookUrl?: string;
      channels: string[];
    };
  };
  
  // Branding
  branding?: {
    logo?: string;
    primaryColor?: string;
    secondaryColor?: string;
    customDomain?: string;
  };
}

export interface TenantStats {
  userCount: number;
  productCount: number;
  orderCount: number;
  monthlyOrderValue: number;
  storageUsed: number; // MB
  apiCallsThisMonth: number;
  lastActivity: Date;
}

export interface TenantDataExport {
  tenant: Tenant;
  users: User[];
  products: any[];
  orders: any[];
  inventory: any[];
  exportedAt: Date;
  format: 'json' | 'csv';
}

export class TenantService {
  /**
   * Create a new tenant with optional owner user
   */
  async createTenant(data: CreateTenantRequest): Promise<Tenant> {
    try {
      // Validate subdomain uniqueness
      const existingTenant = await prisma.tenant.findUnique({
        where: { subdomain: data.subdomain }
      });

      if (existingTenant) {
        throw new Error(`Subdomain '${data.subdomain}' is already taken`);
      }

      // Validate subdomain format
      if (!/^[a-z0-9-]+$/.test(data.subdomain)) {
        throw new Error('Subdomain must contain only lowercase letters, numbers, and hyphens');
      }

      // Default settings
      const defaultSettings: TenantSettings = {
        businessName: data.name,
        businessType: 'retail',
        industry: 'trading_cards',
        features: {
          multiLocation: false,
          advancedReporting: false,
          apiAccess: false,
          customBranding: false,
          bulkOperations: false,
          webhooks: false
        },
        integrations: {
          shipping: {
            carriers: ['usps'],
            autoFulfillment: false
          }
        },
        security: {
          requireMFA: false,
          sessionTimeout: 480, // 8 hours
          auditLogging: true,
          passwordPolicy: {
            minLength: 8,
            requireUppercase: true,
            requireLowercase: true,
            requireNumbers: true,
            requireSymbols: false
          }
        },
        billing: {
          plan: 'starter',
          billingCycle: 'monthly',
          maxUsers: 5,
          maxProducts: 1000,
          maxOrders: 100
        },
        notifications: {
          email: {
            lowStock: true,
            newOrders: true,
            systemUpdates: true
          }
        }
      };

      const settings = { ...defaultSettings, ...data.settings };

      // Create tenant
      const tenant = await prisma.tenant.create({
        data: {
          name: data.name,
          subdomain: data.subdomain,
          settings: JSON.stringify(settings),
          isActive: true
        }
      });

      // Create owner user if provided
      if (data.ownerEmail) {
        await prisma.user.create({
          data: {
            tenantId: tenant.id,
            email: data.ownerEmail,
            name: data.ownerName || data.ownerEmail,
            role: 'owner',
            isActive: true
          }
        });
      }

      // Create default inventory location
      await prisma.inventoryLocation.create({
        data: {
          tenantId: tenant.id,
          name: 'Main Warehouse',
          type: 'warehouse',
          address: JSON.stringify({}),
          isActive: true
        }
      });

      logger.info('Tenant created successfully', {
        tenantId: tenant.id,
        subdomain: tenant.subdomain,
        ownerEmail: data.ownerEmail
      });

      return this.transformTenant(tenant);
    } catch (error) {
      logger.error('Failed to create tenant', { error, data });
      throw error;
    }
  }

  /**
   * Get tenant by ID
   */
  async getTenantById(tenantId: string): Promise<Tenant | null> {
    try {
      const tenant = await prisma.tenant.findUnique({
        where: { id: tenantId }
      });

      return tenant ? this.transformTenant(tenant) : null;
    } catch (error) {
      logger.error('Failed to get tenant', { error, tenantId });
      throw error;
    }
  }

  /**
   * Get tenant by subdomain
   */
  async getTenantBySubdomain(subdomain: string): Promise<Tenant | null> {
    try {
      const tenant = await prisma.tenant.findUnique({
        where: { subdomain }
      });

      return tenant ? this.transformTenant(tenant) : null;
    } catch (error) {
      logger.error('Failed to get tenant by subdomain', { error, subdomain });
      throw error;
    }
  }

  /**
   * Update tenant
   */
  async updateTenant(tenantId: string, data: UpdateTenantRequest): Promise<Tenant> {
    try {
      // If updating subdomain, check uniqueness
      if (data.subdomain) {
        const existingTenant = await prisma.tenant.findFirst({
          where: {
            subdomain: data.subdomain,
            id: { not: tenantId }
          }
        });

        if (existingTenant) {
          throw new Error(`Subdomain '${data.subdomain}' is already taken`);
        }
      }

      // Get current tenant for settings merge
      const currentTenant = await prisma.tenant.findUnique({
        where: { id: tenantId }
      });

      if (!currentTenant) {
        throw new Error('Tenant not found');
      }

      // Merge settings if provided
      let updatedSettings = currentTenant.settings;
      if (data.settings) {
        const currentSettings = JSON.parse(currentTenant.settings);
        updatedSettings = JSON.stringify({
          ...currentSettings,
          ...data.settings
        });
      }

      const tenant = await prisma.tenant.update({
        where: { id: tenantId },
        data: {
          ...(data.name && { name: data.name }),
          ...(data.subdomain && { subdomain: data.subdomain }),
          ...(data.isActive !== undefined && { isActive: data.isActive }),
          settings: updatedSettings,
          updatedAt: new Date()
        }
      });

      logger.info('Tenant updated successfully', { tenantId, changes: data });

      return this.transformTenant(tenant);
    } catch (error) {
      logger.error('Failed to update tenant', { error, tenantId, data });
      throw error;
    }
  }

  /**
   * Suspend tenant (soft delete)
   */
  async suspendTenant(tenantId: string, reason: string): Promise<void> {
    try {
      await prisma.tenant.update({
        where: { id: tenantId },
        data: {
          isActive: false,
          updatedAt: new Date()
        }
      });

      // Log suspension
      logger.warn('Tenant suspended', { tenantId, reason });
    } catch (error) {
      logger.error('Failed to suspend tenant', { error, tenantId });
      throw error;
    }
  }

  /**
   * Reactivate tenant
   */
  async reactivateTenant(tenantId: string): Promise<void> {
    try {
      await prisma.tenant.update({
        where: { id: tenantId },
        data: {
          isActive: true,
          updatedAt: new Date()
        }
      });

      logger.info('Tenant reactivated', { tenantId });
    } catch (error) {
      logger.error('Failed to reactivate tenant', { error, tenantId });
      throw error;
    }
  }

  /**
   * Get tenant statistics
   */
  async getTenantStats(tenantId: string): Promise<TenantStats> {
    try {
      const [
        userCount,
        productCount,
        orderCount,
        monthlyOrders,
        lastActivity
      ] = await Promise.all([
        prisma.user.count({ where: { tenantId } }),
        prisma.product.count({ where: { tenantId } }),
        prisma.order.count({ where: { tenantId } }),
        prisma.order.aggregate({
          where: {
            tenantId,
            createdAt: {
              gte: new Date(new Date().getFullYear(), new Date().getMonth(), 1)
            }
          },
          _sum: { totalPrice: true }
        }),
        prisma.user.findFirst({
          where: { tenantId },
          orderBy: { lastLoginAt: 'desc' },
          select: { lastLoginAt: true }
        })
      ]);

      return {
        userCount,
        productCount,
        orderCount,
        monthlyOrderValue: monthlyOrders._sum.totalPrice || 0,
        storageUsed: 0, // TODO: Calculate actual storage usage
        apiCallsThisMonth: await this.getApiCallsThisMonth(tenantId),
        lastActivity: lastActivity?.lastLoginAt || new Date()
      };
    } catch (error) {
      logger.error('Failed to get tenant stats', { error, tenantId });
      throw error;
    }
  }

  /**
   * List all tenants (admin only)
   */
  async listTenants(
    page: number = 1,
    limit: number = 20,
    filters?: {
      isActive?: boolean;
      plan?: string;
      search?: string;
    }
  ): Promise<{ tenants: Tenant[]; total: number }> {
    try {
      const where: any = {};

      if (filters?.isActive !== undefined) {
        where.isActive = filters.isActive;
      }

      if (filters?.search) {
        where.OR = [
          { name: { contains: filters.search, mode: 'insensitive' } },
          { subdomain: { contains: filters.search, mode: 'insensitive' } }
        ];
      }

      const [tenants, total] = await Promise.all([
        prisma.tenant.findMany({
          where,
          skip: (page - 1) * limit,
          take: limit,
          orderBy: { createdAt: 'desc' }
        }),
        prisma.tenant.count({ where })
      ]);

      return {
        tenants: tenants.map((tenant: any) => this.transformTenant(tenant)),
        total
      };
    } catch (error) {
      logger.error('Failed to list tenants', { error, filters });
      throw error;
    }
  }

  /**
   * Delete tenant (hard delete - use with caution)
   */
  async deleteTenant(tenantId: string): Promise<void> {
    try {
      // This will cascade delete all related data due to foreign key constraints
      await prisma.tenant.delete({
        where: { id: tenantId }
      });

      logger.warn('Tenant deleted permanently', { tenantId });
    } catch (error) {
      logger.error('Failed to delete tenant', { error, tenantId });
      throw error;
    }
  }

  /**
   * Export tenant data
   */
  async exportTenantData(tenantId: string, format: 'json' | 'csv' = 'json'): Promise<TenantDataExport> {
    try {
      const [tenant, users, products, orders, inventory] = await Promise.all([
        prisma.tenant.findUnique({ where: { id: tenantId } }),
        prisma.user.findMany({ where: { tenantId } }),
        prisma.product.findMany({ 
          where: { tenantId },
          include: { variants: true }
        }),
        prisma.order.findMany({ 
          where: { tenantId },
          include: { lineItems: true }
        }),
        prisma.inventoryItem.findMany({
          where: { tenantId },
          include: { variant: true, location: true }
        })
      ]);

      if (!tenant) {
        throw new Error('Tenant not found');
      }

      return {
        tenant: this.transformTenant(tenant),
        users: users.map((user: any) => ({
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
          isActive: user.isActive,
          createdAt: user.createdAt,
          lastLoginAt: user.lastLoginAt
        })) as User[],
        products,
        orders,
        inventory,
        exportedAt: new Date(),
        format
      };
    } catch (error) {
      logger.error('Failed to export tenant data', { error, tenantId });
      throw error;
    }
  }

  /**
   * Transform database tenant to API tenant
   */
  private transformTenant(tenant: any): Tenant {
    return {
      id: tenant.id,
      name: tenant.name,
      subdomain: tenant.subdomain,
      settings: JSON.parse(tenant.settings),
      isActive: tenant.isActive,
      createdAt: tenant.createdAt,
      updatedAt: tenant.updatedAt
    };
  }

  /**
   * Get API calls for current month
   */
  private async getApiCallsThisMonth(tenantId: string): Promise<number> {
    try {
      const startOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
      return await getApiCallCount(tenantId, startOfMonth);
    } catch (error) {
      logger.error('Failed to get API calls this month', { error, tenantId });
      return 0;
    }
  }
}

export const tenantService = new TenantService();