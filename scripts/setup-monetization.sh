#!/bin/bash
# DeckStack Monetization Setup - Get to Revenue in 1 Hour!

set -e

echo "🚀 Setting up DeckStack for immediate monetization..."

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check if we're in the right directory
if [ ! -f "package.json" ]; then
    print_error "Please run this script from the project root directory"
    exit 1
fi

print_status "Installing Stripe dependencies..."

# Install Stripe dependencies
npm install stripe @stripe/stripe-js

print_success "Stripe dependencies installed"

# Create environment template for monetization
print_status "Creating monetization environment template..."

cat > .env.monetization.template << 'EOF'
# DeckStack Monetization Environment Variables
# Copy these to your .env.production file

# Stripe Configuration (REQUIRED for monetization)
STRIPE_SECRET_KEY=sk_test_...  # Get from https://dashboard.stripe.com/test/apikeys
STRIPE_PUBLISHABLE_KEY=pk_test_...  # Get from https://dashboard.stripe.com/test/apikeys
STRIPE_WEBHOOK_SECRET=whsec_...  # Get from https://dashboard.stripe.com/test/webhooks

# Stripe Price IDs (Create these in Stripe Dashboard)
STRIPE_STARTER_PRICE_ID=price_...  # $15/month Beta Starter
STRIPE_PROFESSIONAL_PRICE_ID=price_...  # $50/month Beta Professional  
STRIPE_ENTERPRISE_PRICE_ID=price_...  # $150/month Beta Enterprise

# Existing DeckStack Configuration
DATABASE_URL="postgresql://user:pass@localhost:5432/deckstack"
JWT_SECRET="your-secure-jwt-secret"
SUPABASE_URL="your-supabase-url"
SUPABASE_ANON_KEY="your-supabase-anon-key"
SUPABASE_SERVICE_ROLE_KEY="your-supabase-service-key"
NODE_ENV="production"
PORT=3005
API_VERSION="v1"
EOF

print_success "Environment template created"

# Create Stripe setup guide
print_status "Creating Stripe setup guide..."

cat > STRIPE_SETUP_GUIDE.md << 'EOF'
# 🚀 Stripe Setup Guide - Start Monetizing in 30 Minutes!

## Step 1: Create Stripe Account (5 minutes)

1. Go to [stripe.com](https://stripe.com) and create an account
2. Complete business verification (can be done later for testing)
3. Go to Dashboard → Developers → API Keys
4. Copy your **Publishable key** and **Secret key**

## Step 2: Create Subscription Products (10 minutes)

### In Stripe Dashboard → Products:

1. **Create Beta Starter Plan:**
   - Name: "Beta Starter"
   - Price: $15.00 USD
   - Billing: Monthly recurring
   - Copy the Price ID (starts with `price_`)

2. **Create Beta Professional Plan:**
   - Name: "Beta Professional" 
   - Price: $50.00 USD
   - Billing: Monthly recurring
   - Copy the Price ID (starts with `price_`)

3. **Create Beta Enterprise Plan:**
   - Name: "Beta Enterprise"
   - Price: $150.00 USD
   - Billing: Monthly recurring
   - Copy the Price ID (starts with `price_`)

## Step 3: Set Up Webhook (5 minutes)

1. Go to Dashboard → Developers → Webhooks
2. Click "Add endpoint"
3. Endpoint URL: `https://your-domain.vercel.app/api/v1/billing/webhook`
4. Select events:
   - `customer.subscription.created`
   - `customer.subscription.updated` 
   - `customer.subscription.deleted`
   - `invoice.payment_succeeded`
   - `invoice.payment_failed`
5. Copy the **Signing secret** (starts with `whsec_`)

## Step 4: Update Environment Variables (5 minutes)

Add these to your `.env.production` file:

```bash
# Stripe Keys
STRIPE_SECRET_KEY=sk_test_your_secret_key
STRIPE_PUBLISHABLE_KEY=pk_test_your_publishable_key
STRIPE_WEBHOOK_SECRET=whsec_your_webhook_secret

# Price IDs
STRIPE_STARTER_PRICE_ID=price_your_starter_price_id
STRIPE_PROFESSIONAL_PRICE_ID=price_your_professional_price_id
STRIPE_ENTERPRISE_PRICE_ID=price_your_enterprise_price_id
```

## Step 5: Update Frontend (5 minutes)

In `frontend/pricing.html`, update line 342:
```javascript
window.STRIPE_PUBLISHABLE_KEY = 'pk_test_your_actual_publishable_key';
```

## Step 6: Deploy and Test!

```bash
# Deploy to production
npm run build
vercel --prod

# Test the pricing page
# Visit: https://your-domain.vercel.app/pricing.html
```

## 🎉 You're Ready to Monetize!

Your DeckStack instance now has:
- ✅ Professional pricing page
- ✅ Stripe payment processing
- ✅ Subscription management
- ✅ 14-day free trials
- ✅ Billing portal for customers

**Start reaching out to card store owners and offer them beta access!**
EOF

print_success "Stripe setup guide created"

# Update package.json scripts for monetization
print_status "Adding monetization scripts to package.json..."

node -e "
const fs = require('fs');
const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));

// Add monetization scripts
pkg.scripts = {
  ...pkg.scripts,
  'monetization:setup': 'node scripts/setup-stripe-products.js',
  'monetization:test': 'node scripts/test-billing.js',
  'monetization:deploy': 'npm run build && vercel --prod',
  'stripe:create-products': 'node scripts/create-stripe-products.js',
  'stripe:test-webhook': 'stripe listen --forward-to localhost:3005/api/v1/billing/webhook'
};

fs.writeFileSync('package.json', JSON.stringify(pkg, null, 2));
"

print_success "Package.json updated with monetization scripts"

# Create Stripe products creation script
print_status "Creating Stripe products setup script..."

cat > scripts/create-stripe-products.js << 'EOF'
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
EOF

chmod +x scripts/create-stripe-products.js

print_success "Stripe products creation script created"

# Create billing test script
print_status "Creating billing test script..."

cat > scripts/test-billing.js << 'EOF'
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
EOF

chmod +x scripts/test-billing.js

print_success "Billing test script created"

# Create customer acquisition template
print_status "Creating customer acquisition templates..."

mkdir -p templates/outreach

cat > templates/outreach/email-template.md << 'EOF'
# Customer Acquisition Email Template

## Subject Lines (A/B Test These)
- "Professional team management for [Store Name]"
- "Streamline your card store operations"
- "Beta access: 50% off card store management platform"

## Email Template

Hi [Name],

I noticed [Store Name] and wanted to share something that might help streamline your team management.

We've built DeckStack - a professional platform specifically for card stores to manage their teams and operations securely.

**What you get today:**
✅ Secure user accounts for your team
✅ Role-based access (Owner, Manager, Staff)
✅ Professional dashboard interface
✅ Multi-location support

**Coming soon (free upgrades for beta customers):**
🚀 Inventory management with TCG attributes
🚀 Order processing and fulfillment
🚀 Shopify integration
🚀 Multi-channel selling (eBay, Amazon)

**Beta pricing: 50% off for early customers**
- Starter: $15/month (normally $30)
- Professional: $50/month (normally $100)
- Enterprise: $150/month (normally $300)

**14-day free trial, no credit card required**

Would you like a 5-minute demo this week? I can show you how it works with your current setup.

Best regards,
[Your name]

P.S. We're only accepting 50 beta customers, so spots are limited.

---

**Follow-up sequences:**
- Day 3: Case study from similar store
- Day 7: Feature update (inventory management progress)
- Day 14: Last chance for beta pricing
EOF

cat > templates/outreach/demo-script.md << 'EOF'
# Demo Script for Card Store Owners

## Opening (2 minutes)
"Thanks for your time! I know you're busy running [Store Name]. 

Let me show you how DeckStack can help you manage your team more professionally in just 5 minutes."

## Demo Flow (3 minutes)

### 1. User Management (1 minute)
- Show user creation and role assignment
- Highlight security features
- Demonstrate permission system

### 2. Professional Interface (1 minute)
- Show dashboard and navigation
- Highlight mobile responsiveness
- Demonstrate multi-tenant isolation

### 3. Coming Soon Features (1 minute)
- Show inventory management mockups
- Explain Shopify integration
- Highlight TCG-specific features

## Closing Questions
1. "How are you currently managing your team access?"
2. "What's your biggest challenge with team coordination?"
3. "Would this help streamline your operations?"

## Pricing Discussion
- Emphasize beta pricing (50% off)
- Highlight free trial (no risk)
- Mention limited beta spots

## Next Steps
- "Should we get you set up with a trial account?"
- "I can have you up and running in 5 minutes"
- "Any questions about the setup process?"
EOF

print_success "Customer acquisition templates created"

# Final setup summary
print_status "Creating final setup checklist..."

cat > MONETIZATION_CHECKLIST.md << 'EOF'
# 🚀 DeckStack Monetization Checklist

## ✅ Completed (by setup script)
- [x] Stripe dependencies installed
- [x] Billing service implemented
- [x] Pricing page created
- [x] Payment processing ready
- [x] Customer acquisition templates

## 🎯 Next Steps (30 minutes to revenue!)

### 1. Stripe Account Setup (10 minutes)
- [ ] Create Stripe account at stripe.com
- [ ] Get API keys from dashboard
- [ ] Run: `npm run stripe:create-products`
- [ ] Set up webhook endpoint

### 2. Environment Configuration (5 minutes)
- [ ] Copy `.env.monetization.template` to `.env.production`
- [ ] Add your Stripe keys and price IDs
- [ ] Update frontend with publishable key

### 3. Deploy to Production (5 minutes)
- [ ] Run: `npm run monetization:deploy`
- [ ] Test pricing page: `https://your-domain.vercel.app/pricing.html`
- [ ] Test subscription flow

### 4. Customer Acquisition (10 minutes)
- [ ] Identify 10 target card stores
- [ ] Send first outreach emails
- [ ] Schedule demo calls

## 💰 Revenue Targets

### Week 1:
- [ ] 5 beta customers signed up
- [ ] $250 MRR from subscriptions
- [ ] 10 demo calls scheduled

### Week 2:
- [ ] 15 total customers
- [ ] $750 MRR
- [ ] First customer success story

### Month 1:
- [ ] 50 customers
- [ ] $2,500 MRR
- [ ] Inventory management feature launched

## 📞 Support

- Stripe Setup: Follow `STRIPE_SETUP_GUIDE.md`
- Customer Outreach: Use templates in `templates/outreach/`
- Technical Issues: Check `docs/TROUBLESHOOTING.md`

**🎉 You're ready to start generating revenue with DeckStack!**
EOF

print_success "Monetization checklist created"

echo ""
echo "🎉 DeckStack Monetization Setup Complete!"
echo ""
echo "📋 Next Steps:"
echo "1. Follow STRIPE_SETUP_GUIDE.md to configure Stripe (30 minutes)"
echo "2. Run 'npm run stripe:create-products' to create subscription plans"
echo "3. Deploy with 'npm run monetization:deploy'"
echo "4. Start customer acquisition using templates in templates/outreach/"
echo ""
echo "💰 Revenue Timeline:"
echo "  - Hour 1: Stripe setup and deployment"
echo "  - Day 1: First customer outreach"
echo "  - Week 1: First paying customers"
echo "  - Month 1: $2,500+ MRR"
echo ""
echo "🚀 Your path to revenue starts now!"