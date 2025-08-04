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
