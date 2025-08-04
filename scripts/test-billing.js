#!/usr/bin/env node
const https = require('https');

async function testBilling() {
  console.log('🧪 Testing DeckStack billing endpoints...');
  
  const baseUrl = process.env.TEST_URL || 'http://localhost:3005';
  
  try {
    // Test plans endpoint
    await testEndpoint(`${baseUrl}/api/v1/billing/plans`, 'GET');
    console.log('✅ Billing plans endpoint working');
    
    // Test pricing page
    await testEndpoint(`${baseUrl}/pricing.html`, 'GET');
    console.log('✅ Pricing page accessible');
    
    console.log('\n🎉 Billing system is ready!');
    console.log('Next steps:');
    console.log('1. Set up your Stripe account');
    console.log('2. Create products using: npm run stripe:create-products');
    console.log('3. Update environment variables');
    console.log('4. Deploy: npm run monetization:deploy');
    
  } catch (error) {
    console.error('❌ Billing test failed:', error.message);
  }
}

function testEndpoint(url, method = 'GET') {
  return new Promise((resolve, reject) => {
    const request = https.get(url, (response) => {
      if (response.statusCode >= 200 && response.statusCode < 400) {
        resolve();
      } else {
        reject(new Error(`${url} returned status ${response.statusCode}`));
      }
    });
    
    request.on('error', reject);
    request.setTimeout(5000, () => {
      request.destroy();
      reject(new Error(`${url} request timed out`));
    });
  });
}

if (require.main === module) {
  testBilling();
}

module.exports = { testBilling };
