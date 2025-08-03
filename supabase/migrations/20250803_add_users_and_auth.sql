-- Add users table and authentication setup
-- This migration extends the existing schema with user management

-- Create users table (extends Supabase auth.users)
CREATE TABLE IF NOT EXISTS public.users (
  id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  full_name TEXT,
  avatar_url TEXT,
  tenant_id UUID REFERENCES tenants(id) ON DELETE SET NULL,
  role TEXT DEFAULT 'owner' CHECK (role IN ('owner', 'admin', 'manager', 'staff')),
  is_active BOOLEAN DEFAULT true,
  last_login_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create user_roles table for more granular permissions
CREATE TABLE IF NOT EXISTS user_roles (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('owner', 'admin', 'manager', 'staff', 'viewer')),
  permissions JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, tenant_id)
);

-- Create tenant_invitations table for user onboarding
CREATE TABLE IF NOT EXISTS tenant_invitations (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  role TEXT DEFAULT 'staff' CHECK (role IN ('admin', 'manager', 'staff', 'viewer')),
  invited_by UUID REFERENCES users(id) ON DELETE SET NULL,
  token TEXT UNIQUE NOT NULL,
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  accepted_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(tenant_id, email)
);

-- Update tenants table to include owner reference
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS owner_id UUID REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true;

-- Enable RLS on new tables
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE tenant_invitations ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for users table
CREATE POLICY "Users can view their own profile" ON users
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can update their own profile" ON users
  FOR UPDATE USING (auth.uid() = id);

-- Create RLS policies for user_roles table
CREATE POLICY "Users can view roles in their tenant" ON user_roles
  FOR SELECT USING (
    tenant_id IN (
      SELECT tenant_id FROM users WHERE id = auth.uid()
    )
  );

-- Create RLS policies for tenant_invitations table
CREATE POLICY "Tenant admins can manage invitations" ON tenant_invitations
  FOR ALL USING (
    tenant_id IN (
      SELECT ur.tenant_id FROM user_roles ur 
      WHERE ur.user_id = auth.uid() 
      AND ur.role IN ('owner', 'admin')
    )
  );

-- Create function to handle new user registration
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.users (id, email, full_name, avatar_url)
  VALUES (
    NEW.id,
    NEW.email,
    NEW.raw_user_meta_data->>'full_name',
    NEW.raw_user_meta_data->>'avatar_url'
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger for new user registration
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Create function to handle tenant creation with owner
CREATE OR REPLACE FUNCTION public.create_tenant_with_owner(
  tenant_name TEXT,
  tenant_subdomain TEXT,
  owner_email TEXT,
  owner_full_name TEXT DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
  new_tenant_id UUID;
  owner_user_id UUID;
BEGIN
  -- Create the tenant
  INSERT INTO tenants (name, subdomain, plan)
  VALUES (tenant_name, tenant_subdomain, 'free')
  RETURNING id INTO new_tenant_id;
  
  -- Get or create the user
  SELECT id INTO owner_user_id FROM users WHERE email = owner_email;
  
  IF owner_user_id IS NULL THEN
    -- User doesn't exist, they'll be created when they sign up
    -- For now, we'll leave owner_id as NULL
    NULL;
  ELSE
    -- Update tenant with owner
    UPDATE tenants SET owner_id = owner_user_id WHERE id = new_tenant_id;
    
    -- Update user with tenant
    UPDATE users SET tenant_id = new_tenant_id WHERE id = owner_user_id;
    
    -- Create owner role
    INSERT INTO user_roles (user_id, tenant_id, role)
    VALUES (owner_user_id, new_tenant_id, 'owner')
    ON CONFLICT (user_id, tenant_id) DO UPDATE SET role = 'owner';
  END IF;
  
  RETURN new_tenant_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create function to accept tenant invitation
CREATE OR REPLACE FUNCTION public.accept_tenant_invitation(invitation_token TEXT)
RETURNS BOOLEAN AS $$
DECLARE
  invitation_record tenant_invitations%ROWTYPE;
  user_id UUID;
BEGIN
  -- Get the invitation
  SELECT * INTO invitation_record 
  FROM tenant_invitations 
  WHERE token = invitation_token 
  AND expires_at > NOW() 
  AND accepted_at IS NULL;
  
  IF NOT FOUND THEN
    RETURN FALSE;
  END IF;
  
  -- Get current user
  user_id := auth.uid();
  
  IF user_id IS NULL THEN
    RETURN FALSE;
  END IF;
  
  -- Update user's tenant
  UPDATE users 
  SET tenant_id = invitation_record.tenant_id 
  WHERE id = user_id;
  
  -- Create user role
  INSERT INTO user_roles (user_id, tenant_id, role)
  VALUES (user_id, invitation_record.tenant_id, invitation_record.role)
  ON CONFLICT (user_id, tenant_id) DO UPDATE SET role = invitation_record.role;
  
  -- Mark invitation as accepted
  UPDATE tenant_invitations 
  SET accepted_at = NOW() 
  WHERE id = invitation_record.id;
  
  RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_users_tenant_id ON users(tenant_id);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_user_roles_user_tenant ON user_roles(user_id, tenant_id);
CREATE INDEX IF NOT EXISTS idx_tenant_invitations_token ON tenant_invitations(token);
CREATE INDEX IF NOT EXISTS idx_tenant_invitations_email ON tenant_invitations(email);

-- Create updated_at trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Add updated_at triggers
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_user_roles_updated_at BEFORE UPDATE ON user_roles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Insert default demo user and tenant relationship
DO $$
DECLARE
  demo_tenant_id UUID;
BEGIN
  -- Get demo tenant ID
  SELECT id INTO demo_tenant_id FROM tenants WHERE subdomain = 'demo';
  
  IF demo_tenant_id IS NOT NULL THEN
    -- Create a demo user entry (this will be linked when a real user signs up)
    INSERT INTO users (id, email, full_name, tenant_id, role)
    VALUES (
      gen_random_uuid(),
      'demo@cardstore.com',
      'Demo User',
      demo_tenant_id,
      'owner'
    ) ON CONFLICT (email) DO NOTHING;
  END IF;
END $$;