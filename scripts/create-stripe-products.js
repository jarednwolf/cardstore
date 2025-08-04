#!/usr/bin/env node
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

async function createProducts() {
  console.log('🚀 Creating Stripe products for DeckStack...');
  
  try {
    // Create Beta Starter
    const starterProduct = await stripe.products.create({
      name: 'DeckStack Beta Starter',
      description: 'Professional team management for small card stores',
    });
    
    const starterPrice = await stripe.prices.create({
      product: starterProduct.id,
      unit_amount: 1500, // $15.00
      currency: 'usd',
      recurring: { interval: 'month' },
    });
    
    console.log(`✅ Starter Plan created: ${starterPrice.id}`);
    
    // Create Beta Professional
    const professionalProduct = await stripe.products.create({
      name: 'DeckStack Beta Professional',
      description: 'Advanced features for growing card stores',
    });
    
    const professionalPrice = await stripe.prices.create({
      product: professionalProduct.id,
      unit_amount: 5000, // $50.00
      currency: 'usd',
      recurring: { interval: 'month' },
    });
    
    console.log(`✅ Professional Plan created: ${professionalPrice.id}`);
    
    // Create Beta Enterprise
    const enterpriseProduct = await stripe.products.create({
      name: 'DeckStack Beta Enterprise',
      description: 'Full-featured solution for large card stores',
    });
    
    const enterprisePrice = await stripe.prices.create({
      product: enterpriseProduct.id,
      unit_amount: 15000, // $150.00
      currency: 'usd',
      recurring: { interval: 'month' },
    });
    
    console.log(`✅ Enterprise Plan created: ${enterprisePrice.id}`);
    
    console.log('\n📋 Add these to your environment variables:');
    console.log(`STRIPE_STARTER_PRICE_ID=${starterPrice.id}`);
    console.log(`STRIPE_PROFESSIONAL_PRICE_ID=${professionalPrice.id}`);
    console.log(`STRIPE_ENTERPRISE_PRICE_ID=${enterprisePrice.id}`);
    
  } catch (error) {
    console.error('❌ Error creating products:', error.message);
  }
}

if (require.main === module) {
  createProducts();
}

module.exports = { createProducts };
