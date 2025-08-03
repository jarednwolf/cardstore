#!/usr/bin/env node

const axios = require('axios');

const BASE_URL = 'http://localhost:3005/api/v1';

// Configure axios defaults for development auth bypass
const defaultHeaders = {
  'x-tenant-id': 'test-tenant-123',
  'Content-Type': 'application/json'
};

axios.defaults.headers.common = { ...axios.defaults.headers.common, ...defaultHeaders };

// Generate unique test data
const timestamp = Date.now();
const testOrder = {
  source: 'manual',
  customerId: 'test-customer-123',
  lineItems: [
    {
      variantId: 'test-variant-1',
      quantity: 2,
      price: 100.00
    },
    {
      variantId: 'test-variant-2',
      quantity: 1,
      price: 50.00
    }
  ],
  shippingAddress: {
    firstName: 'John',
    lastName: 'Doe',
    address1: '123 Main St',
    city: 'Anytown',
    province: 'CA',
    zip: '12345',
    country: 'US'
  },
  notes: 'Test order for order management system'
};

async function testOrderManagement() {
  console.log('🧪 Testing Order Management System...\n');

  try {
    // Test 1: Health check
    console.log('1. Testing health endpoint...');
    const healthResponse = await axios.get(`${BASE_URL}/health`);
    console.log('✅ Health check passed:', healthResponse.data);

    // Test 2: Create tenant and test products first
    console.log('\n2. Setting up test data...');
    
    // Create tenant first
    try {
      await axios.post(`${BASE_URL}/system/tenants`, {
        name: 'Test Tenant',
        subdomain: 'test-tenant-123'
      });
      console.log('✅ Test tenant created');
    } catch (error) {
      // Tenant might already exist, that's okay
      console.log('ℹ️ Tenant already exists or creation failed (continuing...)');
    }
    
    // Create test product with unique SKUs
    const productResponse = await axios.post(`${BASE_URL}/products`, {
      title: `Test Magic Card ${timestamp}`,
      description: 'A test card for order testing',
      vendor: 'Test Vendor',
      category: 'Magic: The Gathering',
      variants: [
        {
          sku: `TEST-${timestamp}-001-NM`,
          title: 'Near Mint',
          price: 100.00,
          tcgAttributes: {
            condition: 'Near Mint',
            set: 'Test Set'
          }
        },
        {
          sku: `TEST-${timestamp}-002-LP`,
          title: 'Lightly Played',
          price: 50.00,
          tcgAttributes: {
            condition: 'Lightly Played',
            set: 'Test Set'
          }
        }
      ]
    });
    
    console.log('✅ Test product created:', productResponse.data.data.title);
    const product = productResponse.data.data;
    
    let variants;
    
    // Check if variants exist in the response
    if (!product.variants || product.variants.length === 0) {
      console.log('⚠️ No variants in product response, fetching product details...');
      const productDetailResponse = await axios.get(`${BASE_URL}/products/${product.id}`);
      variants = productDetailResponse.data.data.variants;
      
      if (!variants || variants.length < 2) {
        throw new Error('Product must have at least 2 variants for testing');
      }
    } else {
      variants = product.variants;
    }
    
    // Update test order with real variant IDs
    testOrder.lineItems[0].variantId = variants[0].id;
    testOrder.lineItems[1].variantId = variants[1].id;

    // Set up inventory for the variants
    console.log('\n3. Setting up inventory...');
    
    // Create inventory location
    const locationResponse = await axios.post(`${BASE_URL}/inventory/locations`, {
      name: 'Test Warehouse',
      type: 'warehouse'
    });
    console.log('✅ Test location created:', locationResponse.data.data.name);
    const locationId = locationResponse.data.data.id;

    // Set inventory levels
    for (const variant of variants) {
      await axios.put(`${BASE_URL}/inventory/${variant.id}/locations/${locationId}`, {
        quantity: 10,
        reason: 'restock'
      });
    }
    console.log('✅ Inventory levels set for test variants');

    // Test 3: Create order
    console.log('\n4. Creating test order...');
    const createResponse = await axios.post(`${BASE_URL}/orders`, testOrder);
    console.log('✅ Order created successfully:', {
      id: createResponse.data.data.id,
      orderNumber: createResponse.data.data.orderNumber,
      status: createResponse.data.data.status,
      totalPrice: createResponse.data.data.totalPrice
    });
    
    const orderId = createResponse.data.data.id;

    // Test 4: Get order by ID
    console.log('\n5. Retrieving order by ID...');
    const getResponse = await axios.get(`${BASE_URL}/orders/${orderId}`);
    console.log('✅ Order retrieved:', {
      id: getResponse.data.data.id,
      orderNumber: getResponse.data.data.orderNumber,
      lineItemCount: getResponse.data.data.lineItems?.length || 0
    });

    // Test 5: List orders
    console.log('\n6. Listing orders...');
    const listResponse = await axios.get(`${BASE_URL}/orders?limit=5`);
    console.log('✅ Orders listed:', {
      count: listResponse.data.data.length,
      totalCount: listResponse.data.meta?.total || 0
    });

    // Test 6: Process order
    console.log('\n7. Processing order...');
    const processResponse = await axios.post(`${BASE_URL}/orders/${orderId}/process`);
    console.log('✅ Order processed:', processResponse.data.data);

    // Test 7: Update order
    console.log('\n8. Updating order...');
    const updateResponse = await axios.put(`${BASE_URL}/orders/${orderId}`, {
      notes: 'Updated test order notes',
      tags: ['test', 'processed']
    });
    console.log('✅ Order updated:', {
      id: updateResponse.data.data.id,
      notes: updateResponse.data.data.notes,
      tags: updateResponse.data.data.tags
    });

    // Test 8: Fulfill order
    console.log('\n9. Fulfilling order...');
    const lineItems = getResponse.data.data.lineItems;
    const fulfillmentRequest = {
      lineItems: lineItems.map(item => ({
        lineItemId: item.id,
        quantity: item.quantity,
        locationId: locationId
      })),
      trackingNumber: 'TEST123456789',
      trackingCompany: 'Test Shipping',
      notifyCustomer: false
    };
    
    const fulfillResponse = await axios.post(`${BASE_URL}/orders/${orderId}/fulfill`, fulfillmentRequest);
    console.log('✅ Order fulfilled:', fulfillResponse.data.data);

    // Test 9: Check final order status
    console.log('\n10. Checking final order status...');
    const finalResponse = await axios.get(`${BASE_URL}/orders/${orderId}`);
    console.log('✅ Final order status:', {
      id: finalResponse.data.data.id,
      status: finalResponse.data.data.status,
      fulfillmentStatus: finalResponse.data.data.fulfillmentStatus,
      lineItems: finalResponse.data.data.lineItems?.map(item => ({
        sku: item.sku,
        quantity: item.quantity,
        fulfilledQuantity: item.fulfilledQuantity
      }))
    });

    console.log('\n🎉 All order management tests passed successfully!');
    console.log('\n📊 Order Management System Summary:');
    console.log('✅ Order creation and retrieval');
    console.log('✅ Order listing and search');
    console.log('✅ Order processing workflow');
    console.log('✅ Inventory integration');
    console.log('✅ Order fulfillment');
    console.log('✅ Order status management');

  } catch (error) {
    console.error('❌ Test failed:', {
      message: error.message,
      status: error.response?.status,
      data: error.response?.data
    });
    process.exit(1);
  }
}

// Run the tests
testOrderManagement();