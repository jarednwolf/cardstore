const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding test data...');

  // Create test tenant
  const tenant = await prisma.tenant.upsert({
    where: { subdomain: 'test-tenant' },
    update: {},
    create: {
      id: 'test-tenant',
      name: 'Test Tenant',
      subdomain: 'test-tenant',
      settings: '{}',
      isActive: true,
    },
  });

  console.log('Created tenant:', tenant);

  // Create test user
  const user = await prisma.user.upsert({
    where: { email: 'dev@example.com' },
    update: {},
    create: {
      id: 'dev-user',
      tenantId: tenant.id,
      email: 'dev@example.com',
      name: 'Development User',
      role: 'owner',
      isActive: true,
    },
  });

  console.log('Created user:', user);

  // Create default inventory location
  const location = await prisma.inventoryLocation.upsert({
    where: { id: 'default-location' },
    update: {},
    create: {
      id: 'default-location',
      tenantId: tenant.id,
      name: 'Main Store',
      type: 'store',
      address: '{}',
      isActive: true,
    },
  });

  console.log('Created location:', location);

  console.log('Test data seeded successfully!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });