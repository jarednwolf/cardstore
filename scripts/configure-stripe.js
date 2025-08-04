#!/usr/bin/env node
/**
 * DeckStack Stripe Configuration Script
 * Automates the complete Stripe setup process
 */

const fs = require('fs');
const path = require('path');

async function configureStripe() {
    console.log('🚀 Configuring DeckStack with Stripe...');
    
    // Get Stripe keys from environment or prompt
    const publishableKey = process.env.STRIPE_PUBLISHABLE_KEY;
    const secretKey = process.env.STRIPE_SECRET_KEY;
    
    if (!publishableKey || !secretKey) {
        console.error('❌ Missing Stripe keys!');
        console.log('Please set environment variables:');
        console.log('export STRIPE_PUBLISHABLE_KEY=pk_test_...');
        console.log('export STRIPE_SECRET_KEY=sk_test_...');
        process.exit(1);
    }
    
    console.log('✅ Stripe keys found');
    
    try {
        // 1. Create Stripe products
        console.log('📦 Creating Stripe products...');
        const stripe = require('stripe')(secretKey);
        
        const products = await createStripeProducts(stripe);
        console.log('✅ Stripe products created');
        
        // 2. Update environment file
        console.log('⚙️ Updating environment configuration...');
        updateEnvironmentFile(publishableKey, secretKey, products);
        console.log('✅ Environment configured');
        
        // 3. Update frontend
        console.log('🎨 Updating frontend configuration...');
        updateFrontendConfig(publishableKey);
        console.log('✅ Frontend configured');
        
        // 4. Display summary
        console.log('\n🎉 Stripe configuration complete!');
        console.log('\n📋 Next steps:');
        console.log('1. npm run build');
        console.log('2. npm run monetization:deploy');
        console.log('3. Test at: https://your-domain.vercel.app/pricing.html');
        
        console.log('\n💰 Your pricing plans:');
        products.forEach(product => {
            console.log(`- ${product.name}: $${(product.price / 100).toFixed(0)}/month (${product.priceId})`);
        });
        
    } catch (error) {
        console.error('❌ Configuration failed:', error.message);
        process.exit(1);
    }
}

async function createStripeProducts(stripe) {
    const products = [];
    
    // Beta Starter Plan
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
    
    products.push({
        name: 'Beta Starter',
        price: 1500,
        priceId: starterPrice.id
    });
    
    // Beta Professional Plan
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
    
    products.push({
        name: 'Beta Professional',
        price: 5000,
        priceId: professionalPrice.id
    });
    
    // Beta Enterprise Plan
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
    
    products.push({
        name: 'Beta Enterprise',
        price: 15000,
        priceId: enterprisePrice.id
    });
    
    return products;
}

function updateEnvironmentFile(publishableKey, secretKey, products) {
    const envContent = `# DeckStack Production Environment with Stripe
NODE_ENV=production
PORT=3005
API_VERSION=v1

# Database (update with your actual database URL)
DATABASE_URL="postgresql://user:pass@localhost:5432/deckstack"

# JWT Secret (update with a secure secret)
JWT_SECRET="your-secure-jwt-secret-change-this"

# Supabase (update with your actual Supabase credentials)
SUPABASE_URL="your-supabase-url"
SUPABASE_ANON_KEY="your-supabase-anon-key"
SUPABASE_SERVICE_ROLE_KEY="your-supabase-service-key"

# Stripe Configuration
STRIPE_SECRET_KEY=${secretKey}
STRIPE_PUBLISHABLE_KEY=${publishableKey}
STRIPE_WEBHOOK_SECRET=whsec_...  # Set this up after creating webhook

# Stripe Price IDs
STRIPE_STARTER_PRICE_ID=${products[0].priceId}
STRIPE_PROFESSIONAL_PRICE_ID=${products[1].priceId}
STRIPE_ENTERPRISE_PRICE_ID=${products[2].priceId}
`;
    
    fs.writeFileSync('.env.production', envContent);
}

function updateFrontendConfig(publishableKey) {
    const pricingPath = path.join('frontend', 'pricing.html');
    let content = fs.readFileSync(pricingPath, 'utf8');
    
    // Update the Stripe publishable key
    content = content.replace(
        /window\.STRIPE_PUBLISHABLE_KEY = '[^']*'/,
        `window.STRIPE_PUBLISHABLE_KEY = '${publishableKey}'`
    );
    
    fs.writeFileSync(pricingPath, content);
}

if (require.main === module) {
    configureStripe();
}

module.exports = { configureStripe };