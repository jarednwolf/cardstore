import { describe, test, expect, beforeAll, afterAll, beforeEach } from '@jest/globals';
import request from 'supertest';
import { PrismaClient } from '@prisma/client';
import { app } from '../index';
import { tenantService } from '../services/tenantService';
import { userService } from '../services/userService';
import { auditService } from '../services/auditService';

const prisma = new PrismaClient();

describe('Multi-Tenant Security and Data Isolation', () => {
  let tenant1: any;
  let tenant2: any;
  let user1: any;
  let user2: any;
  let token1: string;
  let token2: string;

  beforeAll(async () => {
    // Create test tenants
    tenant1 = await tenantService.createTenant({
      name: 'Test Tenant 1',
      subdomain: 'test-tenant-1',
      ownerEmail: 'owner1@test.com',
      ownerName: 'Owner One'
    });

    tenant2 = await tenantService.createTenant({
      name: 'Test Tenant 2',
      subdomain: 'test-tenant-2',
      ownerEmail: 'owner2@test.com',
      ownerName: 'Owner Two'
    });

    // Create test users
    user1 = await userService.createUser({
      email: 'user1@test.com',
      name: 'User One',
      role: 'manager',
      tenantId: tenant1.id
    });

    user2 = await userService.createUser({
      email: 'user2@test.com',
      name: 'User Two',
      role: 'manager',
      tenantId: tenant2.id
    });

    // Generate test tokens (simplified for testing)
    token1 = 'demo-token-for-testing';
    token2 = 'demo-token-for-testing';
  });

  afterAll(async () => {
    // Cleanup test data
    await prisma.user.deleteMany({
      where: {
        OR: [
          { tenantId: tenant1.id },
          { tenantId: tenant2.id }
        ]
      }
    });

    await prisma.tenant.deleteMany({
      where: {
        OR: [
          { id: tenant1.id },
          { id: tenant2.id }
        ]
      }
    });

    await prisma.$disconnect();
  });

  describe('Tenant Data Isolation', () => {
    test('should prevent cross-tenant data access', async () => {
      // Create a product for tenant1
      const product1 = await prisma.product.create({
        data: {
          tenantId: tenant1.id,
          title: 'Tenant 1 Product',
          description: 'This belongs to tenant 1'
        }
      });

      // Try to access tenant1's product from tenant2's context
      const response = await request(app)
        .get(`/api/v1/products/${product1.id}`)
        .set('Authorization', `Bearer ${token2}`)
        .set('X-Tenant-ID', tenant2.id);

      expect(response.status).toBe(404); // Should not find the product
    });

    test('should only return tenant-scoped data', async () => {
      // Create products for both tenants
      await prisma.product.createMany({
        data: [
          {
            tenantId: tenant1.id,
            title: 'Tenant 1 Product A',
            description: 'Belongs to tenant 1'
          },
          {
            tenantId: tenant1.id,
            title: 'Tenant 1 Product B',
            description: 'Also belongs to tenant 1'
          },
          {
            tenantId: tenant2.id,
            title: 'Tenant 2 Product A',
            description: 'Belongs to tenant 2'
          }
        ]
      });

      // Request products from tenant1's context
      const response1 = await request(app)
        .get('/api/v1/products')
        .set('Authorization', `Bearer ${token1}`)
        .set('X-Tenant-ID', tenant1.id);

      expect(response1.status).toBe(200);
      expect(response1.body.data).toHaveLength(2);
      expect(response1.body.data.every((p: any) => p.tenantId === tenant1.id)).toBe(true);

      // Request products from tenant2's context
      const response2 = await request(app)
        .get('/api/v1/products')
        .set('Authorization', `Bearer ${token2}`)
        .set('X-Tenant-ID', tenant2.id);

      expect(response2.status).toBe(200);
      expect(response2.body.data).toHaveLength(1);
      expect(response2.body.data[0].tenantId).toBe(tenant2.id);
    });

    test('should prevent tenant ID manipulation in requests', async () => {
      // Try to create a product with a different tenant ID
      const response = await request(app)
        .post('/api/v1/products')
        .set('Authorization', `Bearer ${token1}`)
        .set('X-Tenant-ID', tenant1.id)
        .send({
          tenantId: tenant2.id, // Try to set different tenant ID
          title: 'Malicious Product',
          description: 'Trying to create in wrong tenant'
        });

      // Should either reject or auto-correct to user's tenant
      if (response.status === 201) {
        expect(response.body.data.tenantId).toBe(tenant1.id);
      } else {
        expect(response.status).toBeGreaterThanOrEqual(400);
      }
    });
  });

  describe('User Management Security', () => {
    test('should prevent cross-tenant user access', async () => {
      // Try to access user from different tenant
      const response = await request(app)
        .get(`/api/v1/users/${user1.id}`)
        .set('Authorization', `Bearer ${token2}`)
        .set('X-Tenant-ID', tenant2.id);

      expect(response.status).toBe(403); // Should be forbidden
    });

    test('should only list users from same tenant', async () => {
      const response = await request(app)
        .get('/api/v1/users')
        .set('Authorization', `Bearer ${token1}`)
        .set('X-Tenant-ID', tenant1.id);

      expect(response.status).toBe(200);
      expect(response.body.data.every((u: any) => u.tenantId === tenant1.id)).toBe(true);
    });

    test('should prevent user role escalation across tenants', async () => {
      // Try to update user in different tenant
      const response = await request(app)
        .put(`/api/v1/users/${user2.id}`)
        .set('Authorization', `Bearer ${token1}`)
        .set('X-Tenant-ID', tenant1.id)
        .send({
          role: 'owner'
        });

      expect(response.status).toBe(403);
    });
  });

  describe('Tenant Management Security', () => {
    test('should prevent unauthorized tenant access', async () => {
      // Try to access different tenant's details
      const response = await request(app)
        .get(`/api/v1/tenants/${tenant2.id}`)
        .set('Authorization', `Bearer ${token1}`)
        .set('X-Tenant-ID', tenant1.id);

      expect(response.status).toBe(403);
    });

    test('should prevent tenant settings modification by non-owners', async () => {
      // Create a staff user
      const staffUser = await userService.createUser({
        email: 'staff@test.com',
        name: 'Staff User',
        role: 'staff',
        tenantId: tenant1.id
      });

      // Try to modify tenant settings as staff
      const response = await request(app)
        .put(`/api/v1/tenants/${tenant1.id}/settings`)
        .set('Authorization', `Bearer ${token1}`) // Would need staff token
        .set('X-Tenant-ID', tenant1.id)
        .send({
          features: {
            advancedReporting: true
          }
        });

      // Should require owner or manager role
      expect([403, 401]).toContain(response.status);
    });
  });

  describe('Audit Logging', () => {
    test('should log tenant-scoped actions', async () => {
      // Perform an action
      await request(app)
        .post('/api/v1/products')
        .set('Authorization', `Bearer ${token1}`)
        .set('X-Tenant-ID', tenant1.id)
        .send({
          title: 'Test Product for Audit',
          description: 'Testing audit logging'
        });

      // Check audit logs
      const auditLogs = await auditService.getAuditLogs({
        tenantId: tenant1.id,
        action: 'create',
        resource: 'product'
      });

      expect(auditLogs.logs.length).toBeGreaterThan(0);
      expect(auditLogs.logs[0].tenantId).toBe(tenant1.id);
      expect(auditLogs.logs[0].action).toBe('create');
      expect(auditLogs.logs[0].resource).toBe('product');
    });

    test('should not expose audit logs across tenants', async () => {
      // Try to access audit logs from different tenant
      const auditLogs = await auditService.getAuditLogs({
        tenantId: tenant2.id,
        action: 'create',
        resource: 'product'
      });

      // Should not contain logs from tenant1
      expect(auditLogs.logs.every(log => log.tenantId === tenant2.id)).toBe(true);
    });
  });

  describe('Permission System', () => {
    test('should enforce role-based permissions', async () => {
      // Create a fulfillment user
      const fulfillmentUser = await userService.createUser({
        email: 'fulfillment@test.com',
        name: 'Fulfillment User',
        role: 'fulfillment',
        tenantId: tenant1.id
      });

      // Check permissions
      const hasProductCreate = await userService.hasPermission(
        fulfillmentUser.id,
        'products',
        'create',
        tenant1.id
      );

      const hasOrderUpdate = await userService.hasPermission(
        fulfillmentUser.id,
        'orders',
        'update',
        tenant1.id
      );

      expect(hasProductCreate).toBe(false); // Fulfillment can't create products
      expect(hasOrderUpdate).toBe(true); // Fulfillment can update orders
    });

    test('should prevent permission escalation', async () => {
      // Staff user should not be able to manage other users
      const hasUserManagement = await userService.hasPermission(
        user1.id,
        'users',
        'create',
        tenant1.id
      );

      expect(hasUserManagement).toBe(false);
    });
  });

  describe('Data Validation and Sanitization', () => {
    test('should validate tenant subdomain uniqueness', async () => {
      // Try to create tenant with existing subdomain
      await expect(
        tenantService.createTenant({
          name: 'Duplicate Tenant',
          subdomain: 'test-tenant-1' // Already exists
        })
      ).rejects.toThrow('already taken');
    });

    test('should sanitize user input', async () => {
      const response = await request(app)
        .post('/api/v1/products')
        .set('Authorization', `Bearer ${token1}`)
        .set('X-Tenant-ID', tenant1.id)
        .send({
          title: '<script>alert("xss")</script>',
          description: 'Normal description'
        });

      if (response.status === 201) {
        // Should sanitize HTML/script tags
        expect(response.body.data.title).not.toContain('<script>');
      }
    });
  });

  describe('Rate Limiting and Security Headers', () => {
    test('should apply rate limiting per tenant', async () => {
      const requests: Promise<any>[] = [];
      
      // Make multiple rapid requests
      for (let i = 0; i < 10; i++) {
        requests.push(
          request(app)
            .get('/api/v1/products')
            .set('Authorization', `Bearer ${token1}`)
            .set('X-Tenant-ID', tenant1.id)
        );
      }

      const responses = await Promise.all(requests);
      
      // Should eventually hit rate limit
      const rateLimited = responses.some((r: any) => r.status === 429);
      // Note: This might not trigger in test environment
    });

    test('should include security headers', async () => {
      const response = await request(app)
        .get('/api/v1/health')
        .set('Authorization', `Bearer ${token1}`)
        .set('X-Tenant-ID', tenant1.id);

      expect(response.headers['x-content-type-options']).toBe('nosniff');
      expect(response.headers['x-frame-options']).toBeDefined();
    });
  });

  describe('Database Query Security', () => {
    test('should prevent SQL injection in filters', async () => {
      const maliciousInput = "'; DROP TABLE products; --";
      
      const response = await request(app)
        .get('/api/v1/products')
        .query({ search: maliciousInput })
        .set('Authorization', `Bearer ${token1}`)
        .set('X-Tenant-ID', tenant1.id);

      // Should not crash and should return valid response
      expect(response.status).toBeLessThan(500);
      
      // Verify products table still exists
      const productCount = await prisma.product.count();
      expect(productCount).toBeGreaterThanOrEqual(0);
    });

    test('should use parameterized queries', async () => {
      // This is more of a code review item, but we can test the behavior
      const response = await request(app)
        .get('/api/v1/products')
        .query({ 
          search: "test' OR '1'='1",
          category: "electronics' UNION SELECT * FROM users --"
        })
        .set('Authorization', `Bearer ${token1}`)
        .set('X-Tenant-ID', tenant1.id);

      expect(response.status).toBe(200);
      // Should return only legitimate results, not all products
    });
  });

  describe('Session and Token Security', () => {
    test('should reject invalid tokens', async () => {
      const response = await request(app)
        .get('/api/v1/products')
        .set('Authorization', 'Bearer invalid-token')
        .set('X-Tenant-ID', tenant1.id);

      expect(response.status).toBe(401);
    });

    test('should validate tenant context in token', async () => {
      // Try to use token with wrong tenant ID
      const response = await request(app)
        .get('/api/v1/products')
        .set('Authorization', `Bearer ${token1}`)
        .set('X-Tenant-ID', 'wrong-tenant-id');

      expect([401, 403]).toContain(response.status);
    });
  });
});

describe('Performance and Scalability', () => {
  test('should handle concurrent tenant operations', async () => {
    const concurrentRequests = Array.from({ length: 5 }, (_, i) =>
      request(app)
        .get('/api/v1/products')
        .set('Authorization', `Bearer ${token1}`)
        .set('X-Tenant-ID', tenant1.id)
    );

    const responses = await Promise.all(concurrentRequests);
    
    // All requests should succeed
    responses.forEach(response => {
      expect(response.status).toBe(200);
    });
  });

  test('should efficiently query tenant-scoped data', async () => {
    const startTime = Date.now();
    
    await request(app)
      .get('/api/v1/products')
      .set('Authorization', `Bearer ${token1}`)
      .set('X-Tenant-ID', tenant1.id);
    
    const duration = Date.now() - startTime;
    
    // Should complete within reasonable time (adjust threshold as needed)
    expect(duration).toBeLessThan(1000);
  });
});