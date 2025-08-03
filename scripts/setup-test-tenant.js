#!/usr/bin/env node

const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function setupTestTenant() {
  try {
    console.log('Setting up test tenant...');
    
    // Create or update test tenant
    const tenant = await prisma.tenant.upsert({
      where: { subdomain: 'test-tenant-123' },
      update: {},
      create: {
        id: 'test-tenant-123',
        name: 'Test Tenant',
        subdomain: 'test-tenant-123',
        settings: '{}',
        isActive: true
      }
    });
    
    console.log('✅ Test tenant created/updated:', tenant);
    
    // Create a test user for the tenant
    const user = await prisma.user.upsert({
      where: { email: 'dev@example.com' },
      update: {},
      create: {
        id: 'dev-user',
        tenantId: tenant.id,
        email: 'dev@example.com',
        name: 'Development User',
        role: 'owner',
        isActive: true
      }
    });
    
    console.log('✅ Test user created/updated:', user);
    
  } catch (error) {
    console.error('❌ Failed to setup test tenant:', error);
  } finally {
    await prisma.$disconnect();
  }
}

setupTestTenant();