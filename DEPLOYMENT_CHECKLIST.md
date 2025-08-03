# 🚀 CardStore Production Deployment Checklist

## Overview
This checklist will guide you through deploying CardStore to production in **2-4 hours**. Each step includes estimated time and verification steps.

---

## ✅ Step 1: Create Supabase Project (15 minutes)

### Actions:
1. **Go to [supabase.com](https://supabase.com)** and create account
2. **Create new project**:
   - Project name: `cardstore-production`
   - Database password: Generate strong password (save it!)
   - Region: Choose closest to your users
3. **Wait for project setup** (2-3 minutes)
4. **Note these values** from Settings → API:
   - Project URL: `https://[project-id].supabase.co`
   - Anon public key: `eyJ...`
   - Service role key: `eyJ...` (keep secret!)

### Verification:
- [ ] Project is created and shows "Healthy" status
- [ ] You have saved all 3 values above
- [ ] Database is accessible in Supabase dashboard

---

## ✅ Step 2: Configure Production Environment (10 minutes)

### Actions:
1. **Run environment setup script**:
   ```bash
   ./scripts/setup-production-env.sh
   ```

2. **Enter your Supabase values** when prompted:
   - Supabase URL: Your project URL from Step 1
   - Supabase Anon Key: Your anon key from Step 1
   - Supabase Service Role Key: Your service role key from Step 1

3. **For other values, use these for now**:
   - Database URL: `postgresql://postgres:[YOUR-DB-PASSWORD]@db.[PROJECT-ID].supabase.co:5432/postgres`
   - Shopify values: Use placeholders for now (can configure later)
   - CORS Origin: `https://your-app-name.vercel.app` (update after deployment)

### Verification:
- [ ] `.env.production` file is created
- [ ] All Supabase values are correctly set
- [ ] JWT_SECRET is generated and secure

---

## ✅ Step 3: Deploy Database Schema (5 minutes)

### Actions:
1. **Install Supabase CLI** (if not already installed):
   ```bash
   npm install -g supabase
   ```

2. **Login to Supabase**:
   ```bash
   supabase login
   ```

3. **Link your project**:
   ```bash
   supabase link --project-ref [YOUR-PROJECT-ID]
   ```

4. **Deploy database migrations**:
   ```bash
   supabase db push
   ```

### Verification:
- [ ] Migrations run successfully without errors
- [ ] Tables are visible in Supabase dashboard → Table Editor
- [ ] You can see: `users`, `tenants`, `user_roles`, `tenant_invitations` tables

---

## ✅ Step 4: Deploy to Vercel (15 minutes)

### Actions:
1. **Install Vercel CLI**:
   ```bash
   npm install -g vercel
   ```

2. **Login to Vercel**:
   ```bash
   vercel login
   ```

3. **Deploy using our script**:
   ```bash
   DEPLOY_TARGET=vercel ./scripts/deploy-production.sh
   ```

4. **Set environment variables in Vercel**:
   - Go to your Vercel dashboard
   - Select your project → Settings → Environment Variables
   - Add all variables from `.env.production`

5. **Redeploy to apply environment variables**:
   ```bash
   vercel --prod
   ```

### Verification:
- [ ] Deployment completes successfully
- [ ] You receive a production URL (e.g., `https://cardstore.vercel.app`)
- [ ] Health check works: Visit `https://your-url.vercel.app/health`

---

## ✅ Step 5: Configure Authentication in Supabase (5 minutes)

### Actions:
1. **Go to Supabase dashboard** → Authentication → Settings
2. **Configure Site URL**:
   - Site URL: `https://your-vercel-url.vercel.app`
3. **Add Redirect URLs**:
   - `https://your-vercel-url.vercel.app`
   - `https://your-vercel-url.vercel.app/auth/callback`
4. **Enable email confirmations** (optional but recommended)

### Verification:
- [ ] Site URL is set correctly
- [ ] Redirect URLs are configured
- [ ] Authentication settings are saved

---

## ✅ Step 6: Test User Registration Flow (15 minutes)

### Actions:
1. **Visit your production URL**
2. **Test store creation**:
   - Click "Create Store"
   - Fill out registration form
   - Use a real email address
   - Choose a unique subdomain
3. **Check email** for confirmation (if enabled)
4. **Complete store setup**
5. **Test login/logout**

### Verification:
- [ ] Registration form works without errors
- [ ] Email confirmation works (if enabled)
- [ ] User can log in and out successfully
- [ ] Store dashboard loads correctly
- [ ] User info appears in Supabase Auth dashboard

---

## ✅ Step 7: Test Tenant Isolation (10 minutes)

### Actions:
1. **Create second test store**:
   - Use different email address
   - Choose different subdomain
2. **Verify data separation**:
   - Log into first store → check data
   - Log into second store → verify it's empty
   - Confirm no data leakage between stores
3. **Test user roles** (if time permits):
   - Invite a user to one store
   - Verify they can't access other stores

### Verification:
- [ ] Multiple stores can be created
- [ ] Each store has completely separate data
- [ ] Users can only access their own store data
- [ ] Tenant isolation is working correctly

---

## ✅ Step 8: Set Up Monitoring (10 minutes)

### Actions:
1. **Set up uptime monitoring**:
   - Use UptimeRobot, Pingdom, or similar
   - Monitor: `https://your-url.vercel.app/health`
   - Set up email alerts

2. **Configure error tracking** (optional):
   - Sign up for Sentry (free tier)
   - Add Sentry DSN to environment variables
   - Redeploy to enable error tracking

3. **Set up log monitoring**:
   - Check Vercel dashboard → Functions → Logs
   - Bookmark for easy access

### Verification:
- [ ] Uptime monitoring is configured and working
- [ ] You receive test alerts
- [ ] Error tracking is working (if configured)
- [ ] You can access application logs

---

## ✅ Step 9: Final Production Testing (20 minutes)

### Actions:
1. **Complete user journey test**:
   - Register new store
   - Complete onboarding
   - Navigate through all sections
   - Test responsive design on mobile

2. **Performance testing**:
   - Check page load times
   - Test with multiple browser tabs
   - Verify mobile responsiveness

3. **Security verification**:
   - Test authentication boundaries
   - Verify HTTPS is working
   - Check that sensitive data isn't exposed

### Verification:
- [ ] All user flows work smoothly
- [ ] Performance is acceptable
- [ ] Security measures are working
- [ ] Mobile experience is good
- [ ] No console errors or warnings

---

## ✅ Step 10: Go Live! (5 minutes)

### Actions:
1. **Update documentation**:
   - Note your production URL
   - Save admin credentials securely
   - Document any custom configuration

2. **Share with friends**:
   - Send them the production URL
   - Provide the user guide: `docs/USER_GUIDE.md`
   - Let them know they can create their own stores

3. **Monitor initial usage**:
   - Watch for any errors in logs
   - Be available for user questions
   - Monitor system performance

### Verification:
- [ ] Production URL is documented
- [ ] Friends have access to the application
- [ ] Initial user registrations are working
- [ ] System is stable under real usage

---

## 🎉 Success Criteria

Your CardStore is production-ready when:

✅ **Users can register and create stores independently**  
✅ **Multiple stores operate with complete data isolation**  
✅ **Authentication and authorization work correctly**  
✅ **Application handles errors gracefully**  
✅ **Performance meets user expectations**  
✅ **Security measures are properly implemented**  
✅ **Monitoring and alerting are in place**  

---

## 🆘 Troubleshooting

### Common Issues:

**"Supabase URL is required" error**
- Check environment variables are set correctly
- Verify Vercel environment variables match `.env.production`
- Redeploy after setting environment variables

**Authentication not working**
- Verify Supabase Site URL and Redirect URLs
- Check CORS configuration
- Ensure JWT_SECRET is set

**Database connection issues**
- Verify DATABASE_URL format
- Check Supabase project is healthy
- Ensure migrations have run successfully

**CORS errors**
- Update CORS_ORIGIN in environment variables
- Check Supabase authentication settings
- Verify domain configuration

### Getting Help:
1. Check application logs in Vercel dashboard
2. Review Supabase logs in dashboard
3. Test locally with production environment variables
4. Refer to `docs/PRODUCTION_READINESS_GUIDE.md`

---

## 📞 Emergency Contacts

- **Vercel Support**: [vercel.com/support](https://vercel.com/support)
- **Supabase Support**: [supabase.com/support](https://supabase.com/support)
- **Documentation**: `docs/` folder in your project

---

**🚀 Ready to launch? Start with Step 1 and work through each step methodically. Your friends will be managing their card stores professionally in just a few hours!**