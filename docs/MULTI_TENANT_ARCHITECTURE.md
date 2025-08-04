# DeckStack Multi-Tenant Architecture Design

## Document Information
- **Version**: 1.0
- **Date**: 2025-08-04
- **Status**: Implementation Ready
- **Owner**: Engineering Team

## Table of Contents
1. [Architecture Overview](#architecture-overview)
2. [Data Isolation Strategy](#data-isolation-strategy)
3. [User Management System](#user-management-system)
4. [Role-Based Access Control](#role-based-access-control)
5. [Tenant Management](#tenant-management)
6. [Security Considerations](#security-considerations)
7. [Implementation Plan](#implementation-plan)

## Architecture Overview

### Multi-Tenancy Model
DeckStack implements a **shared database, shared schema** multi-tenancy model with:
- Row-level tenant isolation using `tenant_id` foreign keys
- Middleware-enforced tenant context
- Role-based access control within tenants
- Cross-tenant user support for enterprise customers

### Tenant Hierarchy
```
Enterprise Customer
├── Primary Tenant (Main Business)
│   ├── Owner Users
│   ├── Manager Users
│   ├── Staff Users
│   └── Fulfillment Users
├── Secondary Tenant (Subsidiary/Brand)
│   ├── Manager Users (from Primary)
│   └── Staff Users
└── Development Tenant (Testing)
    └── Developer Users
```

## Data Isolation Strategy

### 1. Database-Level Isolation
```sql
-- All tables include tenant_id for isolation
CREATE TABLE products (
    id UUID PRIMARY KEY,
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    -- ... other fields
);

-- Row Level Security (RLS) for additional protection
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON products
    USING (tenant_id = current_setting('app.current_tenant_id')::UUID);
```

### 2. Application-Level Isolation
- **Middleware Enforcement**: All API requests include tenant context
- **Query Scoping**: All database queries automatically filtered by tenant_id
- **Cross-Tenant Prevention**: Strict validation prevents cross-tenant data access

### 3. Tenant Context Management
```typescript
interface TenantContext {
  tenantId: string;
  tenantName: string;
  subdomain: string;
  settings: TenantSettings;
  permissions: string[];
}

interface RequestContext extends Request {
  tenant: TenantContext;
  user: User;
}
```

## User Management System

### 1. User Types
- **Single-Tenant Users**: Belong to one tenant only
- **Multi-Tenant Users**: Can access multiple tenants (enterprise)
- **System Administrators**: Platform-level access (DeckStack team)

### 2. User Roles per Tenant
```typescript
enum UserRole {
  OWNER = 'owner',           // Full tenant access
  MANAGER = 'manager',       // Business operations
  STAFF = 'staff',          // Daily operations
  FULFILLMENT = 'fulfillment', // Warehouse operations
  READONLY = 'readonly'      // View-only access
}
```

### 3. Permission Matrix
| Role | Products | Inventory | Orders | Users | Settings | Reports |
|------|----------|-----------|--------|-------|----------|---------|
| Owner | Full | Full | Full | Full | Full | Full |
| Manager | Full | Full | Full | View | Limited | Full |
| Staff | Limited | Full | Full | None | None | Limited |
| Fulfillment | View | Limited | Fulfill | None | None | None |
| Readonly | View | View | View | None | None | View |

## Role-Based Access Control

### 1. Permission System
```typescript
interface Permission {
  resource: string;    // 'products', 'orders', 'users'
  action: string;      // 'create', 'read', 'update', 'delete'
  scope?: string;      // 'own', 'team', 'all'
}

interface RolePermissions {
  role: UserRole;
  permissions: Permission[];
}
```

### 2. Resource-Level Permissions
```typescript
const ROLE_PERMISSIONS: Record<UserRole, Permission[]> = {
  [UserRole.OWNER]: [
    { resource: '*', action: '*' }
  ],
  [UserRole.MANAGER]: [
    { resource: 'products', action: '*' },
    { resource: 'inventory', action: '*' },
    { resource: 'orders', action: '*' },
    { resource: 'users', action: 'read' },
    { resource: 'reports', action: 'read' }
  ],
  [UserRole.STAFF]: [
    { resource: 'products', action: 'read' },
    { resource: 'inventory', action: '*' },
    { resource: 'orders', action: '*' }
  ],
  [UserRole.FULFILLMENT]: [
    { resource: 'orders', action: 'fulfill' },
    { resource: 'inventory', action: 'update' }
  ],
  [UserRole.READONLY]: [
    { resource: '*', action: 'read' }
  ]
};
```

## Tenant Management

### 1. Tenant Lifecycle
```typescript
interface TenantLifecycle {
  // Creation
  createTenant(data: CreateTenantRequest): Promise<Tenant>;
  
  // Configuration
  updateTenantSettings(tenantId: string, settings: TenantSettings): Promise<void>;
  
  // User Management
  inviteUser(tenantId: string, invitation: UserInvitation): Promise<void>;
  removeUser(tenantId: string, userId: string): Promise<void>;
  
  // Suspension/Reactivation
  suspendTenant(tenantId: string, reason: string): Promise<void>;
  reactivateTenant(tenantId: string): Promise<void>;
  
  // Data Management
  exportTenantData(tenantId: string): Promise<TenantDataExport>;
  deleteTenant(tenantId: string): Promise<void>;
}
```

### 2. Tenant Settings
```typescript
interface TenantSettings {
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
  };
  
  // Integration Settings
  integrations: {
    shopify?: ShopifyConfig;
    quickbooks?: QuickBooksConfig;
    shipping?: ShippingConfig;
  };
  
  // Security Settings
  security: {
    requireMFA: boolean;
    sessionTimeout: number;
    ipWhitelist?: string[];
    auditLogging: boolean;
  };
  
  // Billing Information
  billing: {
    plan: 'starter' | 'professional' | 'enterprise';
    billingCycle: 'monthly' | 'annual';
    customPricing?: boolean;
  };
}
```

## Security Considerations

### 1. Data Isolation Enforcement
- **Middleware Validation**: Every request validates tenant context
- **Query Filtering**: All database queries include tenant_id filters
- **Cross-Tenant Prevention**: Strict validation prevents data leakage

### 2. Authentication & Authorization
- **JWT Tokens**: Include tenant context and permissions
- **Session Management**: Tenant-scoped sessions
- **Multi-Factor Authentication**: Configurable per tenant

### 3. Audit Logging
```typescript
interface AuditLog {
  id: string;
  tenantId: string;
  userId: string;
  action: string;
  resource: string;
  resourceId?: string;
  changes?: Record<string, any>;
  ipAddress: string;
  userAgent: string;
  timestamp: Date;
}
```

### 4. Rate Limiting
- **Per-Tenant Limits**: API rate limits per tenant
- **User-Level Limits**: Additional limits per user
- **Resource Protection**: Prevent abuse of expensive operations

## Implementation Plan

### Phase 1: Enhanced Tenant Management (Week 1)
1. **Tenant Service Enhancement**
   - Create comprehensive tenant management APIs
   - Implement tenant settings management
   - Add tenant lifecycle operations

2. **User Management System**
   - Enhanced user profile management
   - Role assignment and permission checking
   - User invitation system

### Phase 2: Advanced Security (Week 2)
1. **Enhanced Authentication**
   - Multi-tenant JWT tokens
   - Session management improvements
   - MFA support

2. **Authorization Framework**
   - Permission-based access control
   - Resource-level security
   - Audit logging system

### Phase 3: Enterprise Features (Week 3)
1. **Multi-Tenant User Support**
   - Cross-tenant user access
   - Tenant switching functionality
   - Enterprise user management

2. **Advanced Administration**
   - Tenant analytics and monitoring
   - Bulk user operations
   - Data export/import tools

### Phase 4: Frontend Integration (Week 4)
1. **User Management Interface**
   - Tenant administration dashboard
   - User management screens
   - Role and permission management

2. **Tenant Switching**
   - Multi-tenant user interface
   - Context switching
   - Tenant-specific branding

## API Endpoints

### Tenant Management
```
POST   /api/tenants                    # Create tenant
GET    /api/tenants/:id                # Get tenant details
PUT    /api/tenants/:id                # Update tenant
DELETE /api/tenants/:id                # Delete tenant
PUT    /api/tenants/:id/settings       # Update settings
POST   /api/tenants/:id/suspend        # Suspend tenant
POST   /api/tenants/:id/reactivate     # Reactivate tenant
```

### User Management
```
GET    /api/users                      # List users (tenant-scoped)
POST   /api/users                      # Create user
GET    /api/users/:id                  # Get user details
PUT    /api/users/:id                  # Update user
DELETE /api/users/:id                  # Delete user
PUT    /api/users/:id/role             # Update user role
POST   /api/users/:id/invite           # Send invitation
POST   /api/users/:id/activate         # Activate user
POST   /api/users/:id/deactivate       # Deactivate user
```

### Multi-Tenant Operations
```
GET    /api/user/tenants               # List user's tenants
POST   /api/user/switch-tenant         # Switch active tenant
GET    /api/user/permissions           # Get current permissions
```

This architecture provides enterprise-grade multi-tenancy with proper data isolation, comprehensive user management, and scalable security features for DeckStack's growth.