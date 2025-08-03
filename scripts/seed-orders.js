const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding sample orders for testing...');

  // Ensure we have a tenant and user
  const tenant = await prisma.tenant.upsert({
    where: { subdomain: 'test-tenant' },
    update: {},
    create: {
      id: 'test-tenant',
      name: 'Test Card Store',
      subdomain: 'test-tenant',
      settings: '{}',
      isActive: true,
    },
  });

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

  // Create sample products and variants
  const products = [];
  const productData = [
    {
      title: 'Black Lotus',
      description: 'Alpha Black Lotus - Near Mint',
      vendor: 'Wizards of the Coast',
      productType: 'Single Card',
      category: 'Magic: The Gathering',
      variants: [
        {
          sku: 'MTG-ALP-BL-NM',
          title: 'Alpha - Near Mint',
          price: 25000.00,
          weight: 0.01,
          tcgAttributes: {
            set: 'Alpha',
            rarity: 'Rare',
            condition: 'Near Mint',
            foil: false
          }
        }
      ]
    },
    {
      title: 'Charizard',
      description: 'Base Set Charizard - Shadowless',
      vendor: 'Pokemon Company',
      productType: 'Single Card',
      category: 'Pokemon',
      variants: [
        {
          sku: 'PKM-BS-CHAR-SL-NM',
          title: 'Base Set Shadowless - Near Mint',
          price: 350.00,
          weight: 0.01,
          tcgAttributes: {
            set: 'Base Set',
            rarity: 'Holo Rare',
            condition: 'Near Mint',
            foil: true
          }
        }
      ]
    },
    {
      title: 'Blue-Eyes White Dragon',
      description: 'LOB Blue-Eyes White Dragon',
      vendor: 'Konami',
      productType: 'Single Card',
      category: 'Yu-Gi-Oh!',
      variants: [
        {
          sku: 'YGO-LOB-BEWD-NM',
          title: 'Legend of Blue Eyes - Near Mint',
          price: 45.00,
          weight: 0.01,
          tcgAttributes: {
            set: 'Legend of Blue Eyes White Dragon',
            rarity: 'Ultra Rare',
            condition: 'Near Mint',
            foil: true
          }
        }
      ]
    }
  ];

  for (const productInfo of productData) {
    const product = await prisma.product.create({
      data: {
        tenantId: tenant.id,
        title: productInfo.title,
        description: productInfo.description,
        vendor: productInfo.vendor,
        productType: productInfo.productType,
        category: productInfo.category,
        tags: JSON.stringify([productInfo.category]),
        status: 'active'
      }
    });

    for (const variantInfo of productInfo.variants) {
      const variant = await prisma.productVariant.create({
        data: {
          tenantId: tenant.id,
          productId: product.id,
          sku: variantInfo.sku,
          title: variantInfo.title,
          price: variantInfo.price,
          weight: variantInfo.weight,
          weightUnit: 'oz',
          requiresShipping: true,
          taxable: true,
          tcgAttributes: JSON.stringify(variantInfo.tcgAttributes)
        }
      });

      // Create inventory for this variant
      const location = await prisma.inventoryLocation.upsert({
        where: { id: 'main-store' },
        update: {},
        create: {
          id: 'main-store',
          tenantId: tenant.id,
          name: 'Main Store',
          type: 'store',
          address: JSON.stringify({
            address1: '123 Card Store Lane',
            city: 'Trading City',
            province: 'CA',
            country: 'US',
            zip: '90210'
          }),
          isActive: true
        }
      });

      await prisma.inventoryItem.create({
        data: {
          tenantId: tenant.id,
          variantId: variant.id,
          locationId: location.id,
          onHand: 5,
          reserved: 0,
          safetyStock: 1,
          channelBuffers: JSON.stringify({})
        }
      });
    }

    products.push(product);
  }

  // Create sample orders
  const orderData = [
    {
      customerId: 'customer-001',
      customerEmail: 'john.doe@example.com',
      lineItems: [
        { productIndex: 1, quantity: 1 }, // Charizard
        { productIndex: 2, quantity: 2 }  // Blue-Eyes White Dragon
      ],
      shippingAddress: {
        firstName: 'John',
        lastName: 'Doe',
        address1: '456 Collector Ave',
        city: 'Card Town',
        province: 'CA',
        country: 'US',
        zip: '90211',
        phone: '555-0123'
      }
    },
    {
      customerId: 'customer-002',
      customerEmail: 'jane.smith@example.com',
      lineItems: [
        { productIndex: 0, quantity: 1 } // Black Lotus
      ],
      shippingAddress: {
        firstName: 'Jane',
        lastName: 'Smith',
        address1: '789 Magic Street',
        city: 'Planeswalker City',
        province: 'NY',
        country: 'US',
        zip: '10001',
        phone: '555-0456'
      }
    },
    {
      customerId: 'customer-003',
      customerEmail: 'mike.wilson@example.com',
      lineItems: [
        { productIndex: 1, quantity: 1 }, // Charizard
        { productIndex: 2, quantity: 1 }  // Blue-Eyes White Dragon
      ],
      shippingAddress: {
        firstName: 'Mike',
        lastName: 'Wilson',
        address1: '321 Duelist Blvd',
        city: 'Tournament Town',
        province: 'TX',
        country: 'US',
        zip: '75001',
        phone: '555-0789'
      }
    }
  ];

  for (let i = 0; i < orderData.length; i++) {
    const orderInfo = orderData[i];
    const orderNumber = `ORD-${Date.now()}-${String(i + 1).padStart(3, '0')}`;
    
    // Get variants for line items
    const variants = await prisma.productVariant.findMany({
      where: { tenantId: tenant.id },
      include: { product: true }
    });

    let subtotalPrice = 0;
    const lineItemsData = [];

    for (const lineItem of orderInfo.lineItems) {
      const variant = variants[lineItem.productIndex];
      if (variant) {
        const itemTotal = variant.price * lineItem.quantity;
        subtotalPrice += itemTotal;
        
        lineItemsData.push({
          variantId: variant.id,
          quantity: lineItem.quantity,
          price: variant.price,
          totalDiscount: 0,
          fulfilledQuantity: 0,
          title: variant.product.title,
          sku: variant.sku,
          variantTitle: variant.title
        });
      }
    }

    const order = await prisma.order.create({
      data: {
        tenantId: tenant.id,
        orderNumber,
        source: 'shopify',
        customerId: orderInfo.customerId,
        status: 'processing', // Ready to ship
        financialStatus: 'paid',
        fulfillmentStatus: 'unfulfilled',
        subtotalPrice,
        totalTax: subtotalPrice * 0.08, // 8% tax
        totalShipping: 9.95,
        totalPrice: subtotalPrice + (subtotalPrice * 0.08) + 9.95,
        currency: 'USD',
        shippingAddress: JSON.stringify(orderInfo.shippingAddress),
        billingAddress: JSON.stringify(orderInfo.shippingAddress),
        tags: JSON.stringify(['test-order']),
        notes: `Test order for ${orderInfo.customerEmail}`,
        channelData: JSON.stringify({
          customerEmail: orderInfo.customerEmail,
          source: 'test-data'
        })
      }
    });

    // Create line items
    for (const lineItemData of lineItemsData) {
      await prisma.orderLineItem.create({
        data: {
          orderId: order.id,
          ...lineItemData
        }
      });
    }

    console.log(`Created order: ${orderNumber}`);
  }

  console.log('Sample orders created successfully!');
  console.log('\nTest Data Summary:');
  console.log('- 3 Products with variants');
  console.log('- 3 Orders ready to ship');
  console.log('- Inventory items for all products');
  console.log('\nYou can now test the shipping workflow!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });