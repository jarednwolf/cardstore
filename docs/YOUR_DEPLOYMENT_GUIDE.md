# 🚀 Your CardStore Deployment Guide

## 🎯 Your Project Setup

You've already created the key services! Here are your project details:

- **GitHub Repository**: https://github.com/jarednwolf/cardstore
- **Vercel Project**: https://vercel.com/jareds-projects-247fc15d/cardstore
- **Supabase Project**: https://supabase.com/dashboard/project/iqkwlsrjgwvcbemvdqak

## 📋 Step-by-Step Deployment Instructions

### **Phase 1: Supabase Database Setup (30 minutes)**

#### 1. **Configure Supabase Database**
Go to your Supabase project: https://supabase.com/dashboard/project/iqkwlsrjgwvcbemvdqak

**SQL Editor → New Query:**
```sql
-- Enable necessary extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- Create your database schema
-- Copy the schema from docs/DATABASE_SCHEMA.md
-- Start with the basic tables:

CREATE TABLE tenants (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  subdomain TEXT UNIQUE NOT NULL,
  plan TEXT DEFAULT 'free',
  settings JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE products (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
  shopify_product_id BIGINT UNIQUE,
  title VARCHAR(500) NOT NULL,
  description TEXT,
  vendor VARCHAR(100),
  status VARCHAR(20) DEFAULT 'active',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable Row Level Security
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE tenants ENABLE ROW LEVEL SECURITY;

-- Create policies for tenant isolation
CREATE POLICY "Users can only access their tenant's products" ON products
  FOR ALL USING (tenant_id = (auth.jwt() ->> 'tenant_id')::UUID);

CREATE POLICY "Users can only access their tenant" ON tenants
  FOR ALL USING (id = (auth.jwt() ->> 'tenant_id')::UUID);
```

#### 2. **Get Supabase Connection Details**
In your Supabase dashboard:
- Go to **Settings → Database**
- Copy the **Connection String** (URI format)
- Go to **Settings → API**
- Copy the **Project URL** and **anon public key**

### **Phase 2: Environment Configuration (15 minutes)**

#### 1. **Create Production Environment File**
```bash
# Copy the production template
cp .env.production .env.supabase

# Edit with your Supabase details
nano .env.supabase
```

#### 2. **Update .env.supabase with Your Values**
```env
# Application Configuration
NODE_ENV=production
PORT=3000
API_VERSION=v1

# Supabase Configuration
DATABASE_URL="postgresql://postgres:[YOUR-PASSWORD]@db.iqkwlsrjgwvcbemvdqak.supabase.co:5432/postgres"
SUPABASE_URL="https://iqkwlsrjgwvcbemvdqak.supabase.co"
SUPABASE_ANON_KEY="[YOUR-ANON-KEY]"
SUPABASE_SERVICE_ROLE_KEY="[YOUR-SERVICE-ROLE-KEY]"

# JWT Configuration (generate a secure secret)
JWT_SECRET="[GENERATE-A-SECURE-32-CHAR-STRING]"
JWT_EXPIRES_IN="24h"

# CORS Configuration
CORS_ORIGIN="https://cardstore.vercel.app,https://cardstore-git-main-jareds-projects-247fc15d.vercel.app"

# Shopify Configuration (when ready)
SHOPIFY_WEBHOOK_SECRET="your-shopify-webhook-secret"
SHOPIFY_API_KEY="your-shopify-api-key"
SHOPIFY_API_SECRET="your-shopify-api-secret"

# Security
TRUST_PROXY=true
```

### **Phase 3: GitHub Repository Setup (10 minutes)**

#### 1. **Push Your Code to GitHub**
```bash
# Add all the new files we created
git add .

# Commit the production configuration
git commit -m "Add production deployment configuration

- Add Dockerfile for containerized deployment
- Add GitHub Actions CI/CD pipeline
- Add production environment templates
- Add deployment scripts and monitoring
- Add security middleware
- Ready for Supabase + Vercel deployment"

# Push to your repository
git push origin main
```

#### 2. **Configure GitHub Secrets**
Go to: https://github.com/jarednwolf/cardstore/settings/secrets/actions

Add these secrets:
- `SUPABASE_URL`: https://iqkwlsrjgwvcbemvdqak.supabase.co
- `SUPABASE_ANON_KEY`: [Your anon key from Supabase]
- `SUPABASE_SERVICE_ROLE_KEY`: [Your service role key from Supabase]
- `DATABASE_URL`: [Your Supabase database connection string]
- `JWT_SECRET`: [Your generated JWT secret]

### **Phase 4: Vercel Frontend Deployment (15 minutes)**

#### 1. **Update Vercel Configuration**
Update your `vercel.json` with your specific URLs:
```json
{
  "version": 2,
  "name": "cardstore",
  "builds": [
    {
      "src": "frontend/**/*",
      "use": "@vercel/static"
    }
  ],
  "routes": [
    {
      "src": "/api/(.*)",
      "dest": "https://your-supabase-edge-function-url/api/$1"
    },
    {
      "src": "/(.*)",
      "dest": "/frontend/$1"
    }
  ],
  "env": {
    "NEXT_PUBLIC_SUPABASE_URL": "https://iqkwlsrjgwvcbemvdqak.supabase.co",
    "NEXT_PUBLIC_SUPABASE_ANON_KEY": "[YOUR-ANON-KEY]"
  }
}
```

#### 2. **Deploy to Vercel**
Go to: https://vercel.com/jareds-projects-247fc15d/cardstore

- Connect your GitHub repository
- Set environment variables:
  - `NEXT_PUBLIC_SUPABASE_URL`: https://iqkwlsrjgwvcbemvdqak.supabase.co
  - `NEXT_PUBLIC_SUPABASE_ANON_KEY`: [Your anon key]
- Deploy!

### **Phase 5: Supabase Edge Functions (Backend) (20 minutes)**

#### 1. **Install Supabase CLI**
```bash
npm install -g supabase
supabase login
```

#### 2. **Initialize Supabase Functions**
```bash
# Link to your project
supabase link --project-ref iqkwlsrjgwvcbemvdqak

# Create edge functions
supabase functions new health
supabase functions new api
```

#### 3. **Deploy Your API as Edge Functions**
```bash
# Deploy functions
supabase functions deploy health
supabase functions deploy api

# Set environment variables
supabase secrets set JWT_SECRET=[YOUR-JWT-SECRET]
supabase secrets set SHOPIFY_WEBHOOK_SECRET=[YOUR-WEBHOOK-SECRET]
```

### **Phase 6: Frontend API Integration (15 minutes)**

#### 1. **Update Frontend API Configuration**
Update `frontend/js/api.js`:
```javascript
class SupabaseAPI {
  constructor() {
    this.supabaseUrl = 'https://iqkwlsrjgwvcbemvdqak.supabase.co';
    this.supabaseKey = '[YOUR-ANON-KEY]';
    this.baseURL = `${this.supabaseUrl}/functions/v1`;
  }

  async makeRequest(endpoint, options = {}) {
    const url = `${this.baseURL}${endpoint}`;
    const config = {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.supabaseKey}`,
        ...options.headers
      },
      ...options
    };

    const response = await fetch(url, config);
    return response.json();
  }

  // Update all your existing methods to use Supabase
  async getHealth() {
    return this.makeRequest('/health');
  }

  async getProducts() {
    return this.makeRequest('/api/products');
  }
  
  // ... rest of your API methods
}
```

## 🚀 Quick Deployment Commands

### **Deploy Everything**
```bash
# 1. Deploy database schema
supabase db push

# 2. Deploy edge functions
supabase functions deploy --no-verify-jwt

# 3. Deploy frontend (automatic via Vercel GitHub integration)
git push origin main
```

### **Verify Deployment**
```bash
# Test your endpoints
curl https://iqkwlsrjgwvcbemvdqak.supabase.co/functions/v1/health
curl https://cardstore.vercel.app
```

## 🎯 Your Live URLs

Once deployed, your application will be available at:

- **Frontend**: https://cardstore.vercel.app
- **API**: https://iqkwlsrjgwvcbemvdqak.supabase.co/functions/v1
- **Database**: Supabase Dashboard
- **Monitoring**: Supabase Dashboard → Logs

## 💰 Cost Breakdown

With your Supabase + Vercel setup:
- **Supabase**: $25/month (Pro plan)
- **Vercel**: $20/month (Pro plan)
- **Total**: $45/month

**Savings**: 68-77% compared to other deployment strategies!

## ✅ Deployment Checklist

### **Pre-Deployment**
- [ ] Supabase project created ✅
- [ ] Vercel project created ✅
- [ ] GitHub repository created ✅
- [ ] Database schema deployed
- [ ] Environment variables configured
- [ ] GitHub secrets configured

### **Deployment**
- [ ] Edge functions deployed
- [ ] Frontend deployed to Vercel
- [ ] Database migrations run
- [ ] API endpoints tested
- [ ] Frontend-backend integration verified

### **Post-Deployment**
- [ ] Health checks passing
- [ ] Authentication working
- [ ] Real-time features functional
- [ ] Monitoring configured
- [ ] Custom domain configured (optional)

## 🆘 Troubleshooting

### **Common Issues**
1. **CORS Errors**: Update CORS_ORIGIN in environment variables
2. **Database Connection**: Check DATABASE_URL format
3. **Authentication Issues**: Verify JWT_SECRET matches
4. **API Not Found**: Ensure edge functions are deployed

### **Getting Help**
- **Supabase Docs**: https://supabase.com/docs
- **Vercel Docs**: https://vercel.com/docs
- **Your Project Issues**: https://github.com/jarednwolf/cardstore/issues

## 🎉 Next Steps

1. **Complete the deployment** following this guide
2. **Test all functionality** using the health check and frontend
3. **Configure your Shopify integration** when ready
4. **Set up monitoring** and alerts
5. **Add your custom domain** to Vercel

**You're ready to launch!** 🚀

---

*This guide is specifically tailored for your CardStore project setup. All URLs and project IDs are configured for your actual services.*