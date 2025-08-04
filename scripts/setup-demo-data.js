#!/usr/bin/env node

/**
 * Setup Demo Data for DeckStack
 * Creates demo tenant and users for testing
 */

const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function setupDemoData() {
    try {
        console.log('🚀 Setting up demo data for DeckStack...');

        // Create demo tenant
        const demoTenant = await prisma.tenant.upsert({
            where: { id: 'test-tenant' },
            update: {},
            create: {
                id: 'test-tenant',
                name: 'Demo Company',
                subdomain: 'demo',
                settings: JSON.stringify({
                    timezone: 'America/New_York',
                    currency: 'USD',
                    features: ['user_management', 'shipping', 'inventory']
                }),
                isActive: true
            }
        });

        console.log('✅ Demo tenant created:', demoTenant.name);

        // Create demo users
        const demoUsers = [
            {
                id: 'demo-user',
                email: 'demo@example.com',
                name: 'Demo User',
                role: 'owner',
                tenantId: 'test-tenant',
                isActive: true
            },
            {
                id: 'dev-user',
                email: 'dev@example.com',
                name: 'Development User',
                role: 'owner',
                tenantId: 'test-tenant',
                isActive: true
            },
            {
                id: 'manager-user',
                email: 'manager@example.com',
                name: 'Manager User',
                role: 'manager',
                tenantId: 'test-tenant',
                isActive: true
            },
            {
                id: 'staff-user',
                email: 'staff@example.com',
                name: 'Staff User',
                role: 'staff',
                tenantId: 'test-tenant',
                isActive: true
            }
        ];

        for (const userData of demoUsers) {
            const user = await prisma.user.upsert({
                where: { email: userData.email },
                update: userData,
                create: userData
            });
            console.log(`✅ Demo user created: ${user.name} (${user.role})`);
        }

        // Create some demo orders for testing
        const demoOrders = [
            {
                id: 'order-1',
                tenantId: 'test-tenant',
                orderNumber: 'DEMO-001',
                source: 'demo',
                status: 'processing',
                financialStatus: 'paid',
                fulfillmentStatus: 'unfulfilled',
                subtotalPrice: 29.99,
                totalPrice: 29.99,
                currency: 'USD',
                shippingAddress: JSON.stringify({
                    street: '123 Main St',
                    city: 'Anytown',
                    state: 'CA',
                    zipCode: '12345',
                    country: 'US'
                }),
                billingAddress: JSON.stringify({
                    street: '123 Main St',
                    city: 'Anytown',
                    state: 'CA',
                    zipCode: '12345',
                    country: 'US'
                }),
                tags: JSON.stringify(['demo', 'test']),
                channelData: JSON.stringify({
                    customerEmail: 'customer1@example.com',
                    customerName: 'John Doe'
                })
            },
            {
                id: 'order-2',
                tenantId: 'test-tenant',
                orderNumber: 'DEMO-002',
                source: 'demo',
                status: 'pending',
                financialStatus: 'pending',
                fulfillmentStatus: 'unfulfilled',
                subtotalPrice: 45.50,
                totalPrice: 45.50,
                currency: 'USD',
                shippingAddress: JSON.stringify({
                    street: '456 Oak Ave',
                    city: 'Another City',
                    state: 'NY',
                    zipCode: '67890',
                    country: 'US'
                }),
                billingAddress: JSON.stringify({
                    street: '456 Oak Ave',
                    city: 'Another City',
                    state: 'NY',
                    zipCode: '67890',
                    country: 'US'
                }),
                tags: JSON.stringify(['demo', 'test']),
                channelData: JSON.stringify({
                    customerEmail: 'customer2@example.com',
                    customerName: 'Jane Smith'
                })
            }
        ];

        for (const orderData of demoOrders) {
            const order = await prisma.order.upsert({
                where: { id: orderData.id },
                update: orderData,
                create: orderData
            });
            console.log(`✅ Demo order created: ${order.orderNumber} ($${order.totalPrice})`);
        }

        console.log('\n🎉 Demo data setup complete!');
        console.log('\n📋 Demo Credentials:');
        console.log('   Token: demo-token-for-testing');
        console.log('   Tenant ID: test-tenant');
        console.log('   Users: demo@example.com (owner), manager@example.com (manager), staff@example.com (staff)');
        console.log('\n🌐 You can now test the application with these demo accounts.');

    } catch (error) {
        console.error('❌ Error setting up demo data:', error);
        process.exit(1);
    } finally {
        await prisma.$disconnect();
    }
}

// Run the setup
setupDemoData();