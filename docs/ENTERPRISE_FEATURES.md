# DeckStack Enterprise Multi-Tenant Features

## Document Information
- **Version**: 1.0
- **Date**: 2025-08-04
- **Status**: Production Ready
- **Owner**: Engineering Team

## Table of Contents
1. [Overview](#overview)
2. [Multi-Tenant Architecture](#multi-tenant-architecture)
3. [User Management System](#user-management-system)
4. [Role-Based Access Control](#role-based-access-control)
5. [Data Isolation & Security](#data-isolation--security)
6. [Audit Logging](#audit-logging)
7. [API Reference](#api-reference)
8. [Frontend Integration](#frontend-integration)
9. [Security Best Practices](#security-best-practices)
10. [Deployment Guide](#deployment-guide)

## Overview

DeckStack's enterprise multi-tenant system enables a single application instance to serve multiple organizations (tenants) with complete data isolation, user management, and security controls. This architecture is designed for SaaS deployment where each customer operates as an independent tenant.

### Key Features

✅ **Complete Data Isolation**: Each tenant's data is completely isolated from other tenants
✅ **Role-Based Access Control**: Granular permissions system with predefined roles
✅ **User Management**: Full user lifecycle management with invitations and onboarding
✅ **Audit Logging**: Comprehensive activity tracking for compliance and security
✅ **Tenant Administration**: Complete tenant lifecycle management
✅ **Security Middleware**: Multiple layers of security validation
✅ **Frontend Integration**: Beautiful, responsive user management interface

## Multi-Tenant Architecture

### Architecture Pattern
DeckStack implements a **shared database, shared schema** multi-tenancy model with row-level tenant isolation.

```
┌─────────────────────────────────────────────────────────────┐
│                    DeckStack Application                    │
├─────────────────────────────────────────────────────────────┤
│  Tenant A          │  Tenant B          │  Tenant C        │
│  ┌─────────────┐   │  ┌─────────────┐   │  ┌─────────────┐ │
│  │ Users       │   │  │ Users       │   │  │ Users       │ │
│  │ Products    │   │  │ Products    │   │  │ Products    │ │
│  │ Orders      │   │  │ Orders      │   │  │ Orders      │ │
│  │ Inventory   │   │  │ Inventory   │   │  │ Inventory   │ │
│  └─────────────┘   │  └─────────────┘   │  └─────────────┘ │
├─────────────────────────────────────────────────────────────┤
│                   Shared Database Layer                     │
│  ┌─────────────────────────────────────────────────────────┐ │
│  │ All tables include tenant_id for row-level isolation   │ │
│  └─────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
```

### Database Schema
Every data table includes a `tenant_id` foreign key:

```sql
-- Example table structure
CREATE TABLE products (
    id UUID PRIMARY KEY,
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    title VARCHAR(500) NOT NULL,
    -- ... other fields
);

-- Automatic tenant filtering index
CREATE INDEX idx_products_tenant_id ON products(tenant_id);
```

### Tenant Context Flow
1. **Authentication**: User authenticates and receives JWT token with tenant context
2. **Request Processing**: Middleware extracts tenant ID from token/headers
3. **Data Access**: All database queries automatically filtered by tenant ID
4. **Response**: Only tenant-scoped data returned to client

## User Management System

### User Lifecycle

#### 1. User Creation
```typescript
// API: POST /api/v1/users
{
  "email": "user@company.com",
  "name": "John Doe",
  "role": "manager",
  "sendInvitation": true
}
```

#### 2. User Invitation
```typescript
// API: POST /api/v1/users/invite
{
  "email": "newuser@company.com",
  "role": "staff",
  "message": "Welcome to our team!"
}
```

#### 3. Invitation Acceptance
```typescript
// API: POST /api/v1/users/accept-invitation
{
  "token": "invitation-token-here"
}
```

### User Roles

| Role | Description | Permissions |
|------|-------------|-------------|
| **Owner** | Tenant administrator | Full access to all resources and settings |
| **Manager** | Business operations manager | Manage products, orders, inventory, view reports |
| **Staff** | Daily operations user | Manage inventory and orders, view products |
| **Fulfillment** | Warehouse operations | Update orders and inventory for fulfillment |

### User Profile Management
Users can manage their profiles through the API or frontend interface:

```typescript
// Get current user profile
GET /api/v1/users/profile

// Update profile
PUT /api/v1/users/profile
{
  "name": "Updated Name"
}

// Get user permissions
GET /api/v1/users/permissions
```

## Role-Based Access Control

### Permission Matrix

| Resource | Owner | Manager | Staff | Fulfillment |
|----------|-------|---------|-------|-------------|
| **Users** | Full | View | None | None |
| **Products** | Full | Full | View/Edit | View |
| **Inventory** | Full | Full | Full | Edit |
| **Orders** | Full | Full | Full | Fulfill |
| **Reports** | Full | Full | View | None |
| **Settings** | Full | Limited | None | None |

### Permission Checking
```typescript
// Check if user has permission
const hasPermission = await userService.hasPermission(
  userId,
  'products',
  'create',
  tenantId
);

// Middleware for route protection
router.post('/products', 
  authMiddleware,
  requireRole(['owner', 'manager']),
  createProduct
);
```

### Custom Permissions
The system supports granular permission checking:

```typescript
// Resource-level permissions
const permissions = {
  'products': ['create', 'read', 'update', 'delete'],
  'orders': ['read', 'update', 'fulfill'],
  'inventory': ['read', 'update']
};
```

## Data Isolation & Security

### Automatic Tenant Scoping
All database operations are automatically scoped to the current tenant:

```typescript
// Middleware automatically adds tenant filtering
const products = await prisma.product.findMany({
  where: {
    tenantId: req.user.tenantId, // Automatically added
    status: 'active'
  }
});
```

### Tenant-Scoped Prisma Client
```typescript
import { getTenantScopedPrisma } from '../middleware/tenantScope';

// Get tenant-scoped database client
const scopedPrisma = getTenantScopedPrisma(req);

// All queries automatically filtered by tenant
const products = await scopedPrisma.client.product.findMany();
```

### Security Validations
1. **Cross-Tenant Prevention**: Users cannot access data from other tenants
2. **Resource Ownership**: Validates resource belongs to user's tenant
3. **Permission Enforcement**: Role-based access control on all operations
4. **Input Sanitization**: All user input sanitized and validated
5. **SQL Injection Prevention**: Parameterized queries and ORM protection

### Security Middleware Stack
```typescript
// Applied to all protected routes
app.use('/api/v1', [
  authMiddleware,           // Authenticate user
  tenantScopeMiddleware,    // Set tenant context
  auditMiddleware,          // Log actions
  rateLimitMiddleware       // Prevent abuse
]);
```

## Audit Logging

### Automatic Activity Tracking
All user actions are automatically logged:

```typescript
// Audit log entry structure
{
  "id": "audit-log-id",
  "tenantId": "tenant-id",
  "userId": "user-id",
  "action": "create",
  "resource": "product",
  "resourceId": "product-id",
  "changes": { "title": "New Product" },
  "metadata": {
    "method": "POST",
    "path": "/api/v1/products",
    "statusCode": 201,
    "duration": 150
  },
  "ipAddress": "192.168.1.1",
  "userAgent": "Mozilla/5.0...",
  "timestamp": "2025-08-04T00:00:00.000Z"
}
```

### Audit Log Queries
```typescript
// Get audit logs for tenant
const logs = await auditService.getAuditLogs({
  tenantId: 'tenant-id',
  action: 'create',
  resource: 'product',
  dateFrom: new Date('2025-08-01'),
  dateTo: new Date('2025-08-31')
});

// Get audit summary
const summary = await auditService.getAuditSummary('tenant-id', 30);
```

### Compliance Features
- **Data Retention**: Configurable log retention periods
- **Export Capabilities**: Export audit logs for compliance reporting
- **Real-time Monitoring**: Track suspicious activities
- **Immutable Logs**: Audit logs cannot be modified after creation

## API Reference

### Tenant Management

#### Create Tenant
```http
POST /api/v1/tenants
Authorization: Bearer <admin-token>

{
  "name": "Acme Corporation",
  "subdomain": "acme",
  "ownerEmail": "admin@acme.com",
  "ownerName": "John Admin"
}
```

#### Get Tenant Details
```http
GET /api/v1/tenants/current
Authorization: Bearer <user-token>
```

#### Update Tenant Settings
```http
PUT /api/v1/tenants/{id}/settings
Authorization: Bearer <owner-token>

{
  "features": {
    "advancedReporting": true,
    "apiAccess": true
  },
  "security": {
    "requireMFA": true,
    "sessionTimeout": 480
  }
}
```

### User Management

#### List Users
```http
GET /api/v1/users?page=1&limit=20&role=manager&search=john
Authorization: Bearer <manager-token>
```

#### Create User
```http
POST /api/v1/users
Authorization: Bearer <owner-token>

{
  "email": "user@company.com",
  "name": "Jane Doe",
  "role": "staff",
  "sendInvitation": true
}
```

#### Update User
```http
PUT /api/v1/users/{id}
Authorization: Bearer <owner-token>

{
  "name": "Jane Smith",
  "role": "manager",
  "isActive": true
}
```

#### Send Invitation
```http
POST /api/v1/users/invite
Authorization: Bearer <manager-token>

{
  "email": "newuser@company.com",
  "role": "staff",
  "message": "Welcome to our team!"
}
```

### Audit Logs

#### Get Audit Logs
```http
GET /api/v1/audit/logs?action=create&resource=product&page=1
Authorization: Bearer <manager-token>
```

#### Get Audit Summary
```http
GET /api/v1/audit/summary?days=30
Authorization: Bearer <manager-token>
```

## Frontend Integration

### User Management Interface
The system includes a complete user management interface at `/users.html`:

#### Features
- **User List**: Paginated table with search and filtering
- **User Creation**: Modal form for adding new users
- **User Editing**: In-place editing of user details
- **Role Management**: Visual role badges and permission display
- **Invitation System**: Send and track user invitations
- **Responsive Design**: Works on desktop and mobile devices

#### Usage
```javascript
// Initialize user manager
const userManager = new UserManager();

// Load users with filters
userManager.loadUsers({
  role: 'manager',
  isActive: true,
  search: 'john'
});

// Create new user
userManager.openCreateUserModal();

// Send invitation
userManager.openInviteModal();
```

### Integration with Existing Frontend
```javascript
// Add user management to navigation
<nav>
  <a href="/users.html">User Management</a>
  <a href="/tenants.html">Tenant Settings</a>
  <a href="/audit.html">Audit Logs</a>
</nav>

// Check user permissions
if (user.role === 'owner' || user.role === 'manager') {
  showUserManagement();
}
```

## Security Best Practices

### 1. Authentication Security
- **JWT Tokens**: Secure token-based authentication
- **Token Expiration**: Configurable token lifetimes
- **Refresh Tokens**: Secure token renewal process
- **Multi-Factor Authentication**: Optional MFA support

### 2. Authorization Security
- **Principle of Least Privilege**: Users get minimum required permissions
- **Role-Based Access**: Predefined roles with specific permissions
- **Resource-Level Security**: Validate access to specific resources
- **Cross-Tenant Prevention**: Strict tenant boundary enforcement

### 3. Data Security
- **Encryption at Rest**: Database encryption for sensitive data
- **Encryption in Transit**: HTTPS/TLS for all communications
- **Input Validation**: Comprehensive input sanitization
- **SQL Injection Prevention**: Parameterized queries and ORM protection

### 4. Operational Security
- **Audit Logging**: Complete activity tracking
- **Rate Limiting**: Prevent abuse and DoS attacks
- **Security Headers**: Comprehensive security header implementation
- **Error Handling**: Secure error messages without information leakage

### 5. Compliance Features
- **Data Retention**: Configurable data retention policies
- **Data Export**: GDPR-compliant data export capabilities
- **Audit Trails**: Immutable audit logs for compliance
- **Access Controls**: Granular permission system

## Deployment Guide

### 1. Environment Setup
```bash
# Set required environment variables
export DATABASE_URL="postgresql://user:pass@localhost:5432/deckstack"
export JWT_SECRET="your-secure-jwt-secret"
export SUPABASE_URL="your-supabase-url"
export SUPABASE_ANON_KEY="your-supabase-anon-key"
export SUPABASE_SERVICE_ROLE_KEY="your-supabase-service-key"
```

### 2. Database Migration
```bash
# Run database migrations
npx prisma migrate deploy

# Seed initial data (optional)
npm run seed
```

### 3. Application Deployment
```bash
# Build application
npm run build

# Start production server
npm start
```

### 4. Initial Tenant Setup
```bash
# Create first tenant via API or admin interface
curl -X POST http://localhost:3005/api/v1/tenants \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer admin-token" \
  -d '{
    "name": "First Tenant",
    "subdomain": "first-tenant",
    "ownerEmail": "admin@firsttenant.com"
  }'
```

### 5. Monitoring Setup
- **Health Checks**: Monitor `/health` endpoint
- **Audit Log Monitoring**: Set up alerts for suspicious activities
- **Performance Monitoring**: Track API response times
- **Error Tracking**: Monitor application errors and exceptions

## Troubleshooting

### Common Issues

#### 1. Cross-Tenant Data Access
**Problem**: User seeing data from other tenants
**Solution**: Check tenant middleware configuration and JWT token tenant claims

#### 2. Permission Denied Errors
**Problem**: Users cannot access resources they should have access to
**Solution**: Verify user role and permission configuration

#### 3. Invitation Emails Not Sending
**Problem**: User invitations not being delivered
**Solution**: Check email service configuration and SMTP settings

#### 4. Audit Logs Not Recording
**Problem**: User actions not appearing in audit logs
**Solution**: Verify audit middleware is properly configured on routes

### Debug Commands
```bash
# Check tenant configuration
npm run debug:tenant <tenant-id>

# Verify user permissions
npm run debug:permissions <user-id>

# Test data isolation
npm run test:isolation

# Validate audit logging
npm run test:audit
```

## Support and Maintenance

### Regular Maintenance Tasks
1. **Audit Log Cleanup**: Remove old audit logs based on retention policy
2. **User Account Review**: Regular review of user accounts and permissions
3. **Security Updates**: Keep dependencies and security patches up to date
4. **Performance Monitoring**: Monitor and optimize database queries
5. **Backup Verification**: Regular testing of backup and restore procedures

### Monitoring Metrics
- **Active Tenants**: Number of active tenant accounts
- **User Activity**: Daily/monthly active users per tenant
- **API Performance**: Response times and error rates
- **Security Events**: Failed login attempts and suspicious activities
- **Resource Usage**: Database size and query performance

This enterprise multi-tenant system provides a robust, secure, and scalable foundation for serving multiple customers with complete data isolation and comprehensive user management capabilities.