# DeckStack Production Deployment Guide

This guide will walk you through deploying DeckStack to production with real authentication and database functionality.

## 🚀 Quick Start

### 1. Set Up Supabase Database

1. **Go to your Supabase project**: https://supabase.com/dashboard/project/iqkwlsrjgwvcbemvdqak
2. **Get your credentials**:
   - Navigate to Settings → API
   - Copy the "Project URL" 
   - Copy the "anon public" key
   - Copy the "service_role" key (keep this secret!)
3. **Set up the database schema**:
   ```sql
   -- Run this in your Supabase SQL editor
   -- This will create the necessary tables for authentication and multi-tenancy
   
   -- Enable Row Level Security
   ALTER TABLE auth.users ENABLE ROW LEVEL SECURITY;
   
   -- Create tenants table
   CREATE TABLE IF NOT EXISTS public.tenants (
     id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
     name TEXT NOT NULL,
     subdomain TEXT UNIQUE NOT NULL,
     plan TEXT DEFAULT 'starter',
     settings JSONB DEFAULT '{}',
     is_active BOOLEAN DEFAULT true,
     created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
     updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
   );
   
   -- Create users table (extends auth.users)
   CREATE TABLE IF NOT EXISTS public.users (
     id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
     email TEXT NOT NULL,
     full_name TEXT,
     avatar_url TEXT,
     tenant_id UUID REFERENCES public.tenants(id),
     role TEXT DEFAULT 'staff',
     is_active BOOLEAN DEFAULT true,
     last_login_at TIMESTAMP WITH TIME ZONE,
     created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
     updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
   );
   
   -- Create user_roles table
   CREATE TABLE IF NOT EXISTS public.user_roles (
     id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
     user_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
     tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE,
     role TEXT NOT NULL,
     permissions JSONB DEFAULT '{}',
     created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
     updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
   );
   
   -- Create tenant_invitations table
   CREATE TABLE IF NOT EXISTS public.tenant_invitations (
     id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
     tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE,
     email TEXT NOT NULL,
     role TEXT NOT NULL,
     invited_by UUID REFERENCES public.users(id),
     token TEXT UNIQUE NOT NULL,
     expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
     accepted_at TIMESTAMP WITH TIME ZONE,
     created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
   );
   
   -- Create function to handle user creation
   CREATE OR REPLACE FUNCTION public.handle_new_user()
   RETURNS TRIGGER AS $$
   BEGIN
     INSERT INTO public.users (id, email, full_name)
     VALUES (NEW.id, NEW.email, NEW.raw_user_meta_data->>'full_name');
     RETURN NEW;
   END;
   $$ LANGUAGE plpgsql SECURITY DEFINER;
   
   -- Create trigger for new user creation
   DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
   CREATE TRIGGER on_auth_user_created
     AFTER INSERT ON auth.users
     FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
   
   -- Create function to create tenant with owner
   CREATE OR REPLACE FUNCTION public.create_tenant_with_owner(
     tenant_name TEXT,
     tenant_subdomain TEXT,
     owner_email TEXT,
     owner_full_name TEXT DEFAULT NULL
   )
   RETURNS JSON AS $$
   DECLARE
     new_tenant_id UUID;
     owner_user_id UUID;
   BEGIN
     -- Create tenant
     INSERT INTO public.tenants (name, subdomain)
     VALUES (tenant_name, tenant_subdomain)
     RETURNING id INTO new_tenant_id;
     
     -- Find user by email
     SELECT id INTO owner_user_id
     FROM auth.users
     WHERE email = owner_email;
     
     -- Update user with tenant info
     UPDATE public.users
     SET tenant_id = new_tenant_id, role = 'owner'
     WHERE id = owner_user_id;
     
     -- Create user role
     INSERT INTO public.user_roles (user_id, tenant_id, role, permissions)
     VALUES (owner_user_id, new_tenant_id, 'owner', '{"all": true}');
     
     RETURN json_build_object(
       'tenant_id', new_tenant_id,
       'user_id', owner_user_id,
       'success', true
     );
   END;
   $$ LANGUAGE plpgsql SECURITY DEFINER;
   ```

### 2. Configure Vercel Environment Variables

1. **Go to your Vercel dashboard**: https://vercel.com/dashboard
2. **Navigate to your project settings** → Environment Variables
3. **Add these environment variables**:

```bash
# Supabase Configuration
SUPABASE_URL=https://iqkwlsrjgwvcbemvdqak.supabase.co
SUPABASE_ANON_KEY=[YOUR_ANON_KEY_FROM_SUPABASE]
SUPABASE_SERVICE_ROLE_KEY=[YOUR_SERVICE_ROLE_KEY_FROM_SUPABASE]

# Database
DATABASE_URL=[YOUR_SUPABASE_DATABASE_URL]

# JWT Secret (generate with: openssl rand -base64 32)
JWT_SECRET=[GENERATE_A_SECURE_32_CHARACTER_STRING]

# Application
NODE_ENV=production
API_VERSION=v1

# Shopify (configure when ready)
SHOPIFY_WEBHOOK_SECRET=placeholder
SHOPIFY_API_KEY=placeholder
SHOPIFY_API_SECRET=placeholder
```

### 3. Deploy to Vercel

1. **Build and deploy**:
   ```bash
   npm run build
   vercel --prod
   ```

2. **Or use the Vercel CLI**:
   ```bash
   vercel env add SUPABASE_URL
   vercel env add SUPABASE_ANON_KEY
   vercel env add SUPABASE_SERVICE_ROLE_KEY
   vercel env add DATABASE_URL
   vercel env add JWT_SECRET
   vercel --prod
   ```

## 🔧 Configuration Steps

### Step 1: Update CORS Origins

Update your backend CORS configuration to include your production domain:

```typescript
// In src/index.ts
cors({
  origin: [
    'https://your-domain.vercel.app',
    'https://deckstack.com' // your custom domain
  ],
  credentials: true
})
```

### Step 2: Set Up Custom Domain (Optional)

1. In Vercel dashboard, go to your project
2. Navigate to Settings → Domains
3. Add your custom domain
4. Update DNS records as instructed

### Step 3: Enable Email Authentication (Recommended)

1. In Supabase dashboard, go to Authentication → Settings
2. Configure email templates
3. Set up SMTP settings for production emails
4. Enable email confirmation

## 🧪 Testing the Production Setup

### Test Authentication Flow

1. **Visit your production URL**
2. **Try signing up with a real email**
3. **Check that**:
   - User is created in Supabase auth.users table
   - User record is created in public.users table
   - Tenant is created if provided
   - JWT tokens are properly issued
   - Redirect to onboarding works

### Test API Endpoints

```bash
# Health check
curl https://your-domain.vercel.app/health

# Authentication
curl -X POST https://your-domain.vercel.app/api/auth/signup \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "password123",
    "fullName": "Test User",
    "tenantName": "Test Store",
    "tenantSubdomain": "teststore"
  }'
```

## 🔒 Security Checklist

- [ ] JWT_SECRET is a secure random string
- [ ] SUPABASE_SERVICE_ROLE_KEY is kept secret
- [ ] CORS origins are restricted to your domains
- [ ] Rate limiting is enabled
- [ ] HTTPS is enforced
- [ ] Row Level Security is enabled in Supabase

## 📊 Monitoring

### Set Up Error Tracking (Optional)

1. **Add Sentry**:
   ```bash
   npm install @sentry/node
   ```

2. **Configure in environment**:
   ```bash
   SENTRY_DSN=your-sentry-dsn
   ```

### Monitor Database Performance

1. Use Supabase built-in monitoring
2. Set up alerts for high CPU/memory usage
3. Monitor API response times

## 🚨 Troubleshooting

### Common Issues

1. **"Authentication service not configured"**
   - Check that all Supabase environment variables are set
   - Verify the Supabase URL and keys are correct

2. **CORS errors**
   - Add your domain to the CORS origins list
   - Check that credentials: true is set

3. **Database connection errors**
   - Verify the DATABASE_URL is correct
   - Check Supabase database is running
   - Ensure connection pooling is configured

4. **JWT token issues**
   - Verify JWT_SECRET is set and consistent
   - Check token expiration settings

### Debug Mode

Enable debug logging by setting:
```bash
LOG_LEVEL=debug
```

## 📈 Next Steps

After successful deployment:

1. **Set up monitoring and alerts**
2. **Configure email verification**
3. **Add Shopify integration**
4. **Set up automated backups**
5. **Configure CDN for static assets**
6. **Set up staging environment**

## 🆘 Support

If you encounter issues:

1. Check the Vercel function logs
2. Check Supabase logs
3. Verify all environment variables are set
4. Test API endpoints individually
5. Check network connectivity

---

**🎉 Congratulations!** Your DeckStack application is now running in production with real authentication and database functionality.