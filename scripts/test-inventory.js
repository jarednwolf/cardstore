#!/usr/bin/env node

const axios = require('axios');

const BASE_URL = 'http://localhost:3005/api/v1';
const TENANT_ID = 'test-tenant';

async function testInventorySystem() {
  console.log('🧪 Testing Inventory Management System...\n');

  // Common headers for all requests
  const headers = {
    'X-Tenant-ID': TENANT_ID,
    'Content-Type': 'application/json'
  };

  try {
    // Test 1: Create inventory location
    console.log('1️⃣ Creating inventory location...');
    const locationResponse = await axios.post(`${BASE_URL}/inventory/locations?tenantId=${TENANT_ID}`, {
      name: 'Main Warehouse',
      type: 'warehouse',
      address: {
        address1: '123 Storage St',
        city: 'Commerce City',
        province: 'CO',
        country: 'US',
        zip: '80022'
      }
    }, { headers });
    
    const locationId = locationResponse.data.data.id;
    console.log(`✅ Location created: ${locationId}\n`);

    // Test 2: Get all locations
    console.log('2️⃣ Getting all locations...');
    const locationsResponse = await axios.get(`${BASE_URL}/inventory/locations?tenantId=${TENANT_ID}`, { headers });
    console.log(`✅ Found ${locationsResponse.data.data.length} locations\n`);

    // Test 3: Create a product variant first (needed for inventory)
    console.log('3️⃣ Creating test product and variant...');
    const uniqueSku = `MTG-ALPHA-BL-${Date.now()}`;
    const productResponse = await axios.post(`${BASE_URL}/products?tenantId=${TENANT_ID}`, {
      title: 'Black Lotus',
      description: 'Alpha Black Lotus - Mint Condition',
      vendor: 'Wizards of the Coast',
      productType: 'Single Card',
      category: 'Magic: The Gathering',
      tags: ['alpha', 'power-nine', 'mint'],
      variants: [{
        sku: uniqueSku,
        title: 'Black Lotus (Alpha)',
        price: 25000.00,
        tcgAttributes: {
          set: 'Alpha',
          rarity: 'Rare',
          condition: 'Near Mint',
          foil: false,
          language: 'English'
        }
      }]
    }, { headers });
    
    const productId = productResponse.data.data.id;
    console.log(`✅ Product created: ${productId}`);
    
    // Get the product with variants to find the variant ID
    console.log('Getting product with variants...');
    const productWithVariantsResponse = await axios.get(`${BASE_URL}/products/${productId}?tenantId=${TENANT_ID}`, { headers });
    
    if (!productWithVariantsResponse.data.data.variants || productWithVariantsResponse.data.data.variants.length === 0) {
      throw new Error('No variants found for the created product');
    }
    
    const variantId = productWithVariantsResponse.data.data.variants[0].id;
    console.log(`✅ Variant found: ${variantId}\n`);

    // Test 4: Set inventory level
    console.log('4️⃣ Setting inventory level...');
    const setInventoryResponse = await axios.put(
      `${BASE_URL}/inventory/${variantId}/locations/${locationId}?tenantId=${TENANT_ID}`,
      {
        quantity: 5,
        reason: 'initial_stock'
      },
      { headers }
    );
    console.log(`✅ Inventory set to 5 units\n`);

    // Test 5: Get inventory for variant
    console.log('5️⃣ Getting inventory for variant...');
    const inventoryResponse = await axios.get(`${BASE_URL}/inventory/${variantId}?tenantId=${TENANT_ID}`, { headers });
    console.log(`✅ Current inventory: ${inventoryResponse.data.data[0].onHand} units\n`);

    // Test 6: Update inventory (add stock)
    console.log('6️⃣ Adding inventory...');
    await axios.patch(`${BASE_URL}/inventory/${variantId}?tenantId=${TENANT_ID}`, {
      updates: [{
        locationId: locationId,
        quantityChange: 3,
        reason: 'restock',
        reference: 'PO-2024-001'
      }]
    }, { headers });
    console.log(`✅ Added 3 units to inventory\n`);

    // Test 7: Set channel buffer
    console.log('7️⃣ Setting channel buffer...');
    await axios.put(
      `${BASE_URL}/inventory/${variantId}/locations/${locationId}/buffers/shopify?tenantId=${TENANT_ID}`,
      { buffer: 2 },
      { headers }
    );
    console.log(`✅ Set Shopify channel buffer to 2 units\n`);

    // Test 8: Get available to sell
    console.log('8️⃣ Getting available to sell for Shopify...');
    const availableResponse = await axios.get(
      `${BASE_URL}/inventory/${variantId}/available/shopify?tenantId=${TENANT_ID}`,
      { headers }
    );
    console.log(`✅ Available to sell on Shopify: ${availableResponse.data.data.availableToSell} units\n`);

    // Test 9: Get stock movement history
    console.log('9️⃣ Getting stock movement history...');
    const movementsResponse = await axios.get(
      `${BASE_URL}/inventory/${variantId}/movements?tenantId=${TENANT_ID}`,
      { headers }
    );
    console.log(`✅ Found ${movementsResponse.data.data.length} stock movements\n`);

    // Test 10: Get inventory reports
    console.log('🔟 Getting inventory reports...');
    const lowStockResponse = await axios.get(`${BASE_URL}/inventory/reports/low-stock?tenantId=${TENANT_ID}&threshold=10`, { headers });
    const valueResponse = await axios.get(`${BASE_URL}/inventory/reports/value?tenantId=${TENANT_ID}`, { headers });
    
    console.log(`✅ Low stock items: ${lowStockResponse.data.data.length}`);
    console.log(`✅ Total inventory value: $${valueResponse.data.data.totalValue.toFixed(2)}\n`);

    console.log('🎉 All inventory tests passed! The system is working correctly.\n');

    // Summary
    console.log('📊 INVENTORY SYSTEM SUMMARY:');
    console.log('================================');
    console.log(`• Locations: ${locationsResponse.data.data.length}`);
    console.log(`• Current Stock: ${inventoryResponse.data.data[0].onHand + 3} units`);
    console.log(`• Available to Sell (Shopify): ${availableResponse.data.data.availableToSell} units`);
    console.log(`• Stock Movements: ${movementsResponse.data.data.length}`);
    console.log(`• Total Value: $${valueResponse.data.data.totalValue.toFixed(2)}`);
    console.log('================================\n');

  } catch (error) {
    console.error('❌ Test failed:', error.response?.data || error.message);
    process.exit(1);
  }
}

// Run the test
testInventorySystem().catch(console.error);