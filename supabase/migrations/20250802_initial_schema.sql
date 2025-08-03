-- Initial CardStore Operations Layer Schema
-- Enable necessary extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- Create tenants table
CREATE TABLE IF NOT EXISTS tenants (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  subdomain TEXT UNIQUE NOT NULL,
  plan TEXT DEFAULT 'free',
  settings JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create products table
CREATE TABLE IF NOT EXISTS products (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
  shopify_product_id BIGINT UNIQUE,
  title VARCHAR(500) NOT NULL,
  description TEXT,
  vendor VARCHAR(100),
  category VARCHAR(100),
  tags TEXT[] DEFAULT '{}',
  status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'draft', 'archived')),
  published_at TIMESTAMP WITH TIME ZONE,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  CONSTRAINT chk_products_title_length CHECK (char_length(title) >= 1)
);

-- Create product_variants table
CREATE TABLE IF NOT EXISTS product_variants (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  shopify_variant_id BIGINT UNIQUE,
  sku VARCHAR(100) UNIQUE NOT NULL,
  barcode VARCHAR(50),
  title VARCHAR(255) NOT NULL,
  price DECIMAL(12,2) NOT NULL CHECK (price >= 0),
  compare_at_price DECIMAL(12,2) CHECK (compare_at_price >= 0),
  cost_price DECIMAL(12,2) CHECK (cost_price >= 0),
  weight DECIMAL(8,2) CHECK (weight >= 0),
  weight_unit VARCHAR(10) DEFAULT 'g' CHECK (weight_unit IN ('g', 'kg', 'oz', 'lb')),
  requires_shipping BOOLEAN DEFAULT true,
  taxable BOOLEAN DEFAULT true,
  tax_code VARCHAR(50),
  tcg_attributes JSONB DEFAULT '{}',
  track_inventory BOOLEAN DEFAULT true,
  inventory_policy VARCHAR(20) DEFAULT 'deny' CHECK (inventory_policy IN ('deny', 'continue')),
  option1 VARCHAR(255),
  option2 VARCHAR(255),
  option3 VARCHAR(255),
  status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'draft', 'archived')),
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  CONSTRAINT chk_variants_title_length CHECK (char_length(title) >= 1),
  CONSTRAINT chk_variants_sku_length CHECK (char_length(sku) >= 1)
);

-- Create inventory_locations table
CREATE TABLE IF NOT EXISTS inventory_locations (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  shopify_location_id BIGINT UNIQUE,
  name VARCHAR(100) NOT NULL,
  type VARCHAR(20) NOT NULL CHECK (type IN ('warehouse', 'store', 'virtual', 'consignment')),
  address JSONB,
  is_active BOOLEAN DEFAULT true,
  fulfills_online_orders BOOLEAN DEFAULT true,
  priority INTEGER DEFAULT 0,
  contact_info JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  CONSTRAINT chk_locations_name_length CHECK (char_length(name) >= 1)
);

-- Create inventory_items table
CREATE TABLE IF NOT EXISTS inventory_items (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  variant_id UUID NOT NULL REFERENCES product_variants(id) ON DELETE CASCADE,
  location_id UUID NOT NULL REFERENCES inventory_locations(id) ON DELETE CASCADE,
  on_hand INTEGER NOT NULL DEFAULT 0 CHECK (on_hand >= 0),
  reserved INTEGER NOT NULL DEFAULT 0 CHECK (reserved >= 0),
  available INTEGER GENERATED ALWAYS AS (on_hand - reserved) STORED,
  safety_stock INTEGER DEFAULT 0 CHECK (safety_stock >= 0),
  reorder_point INTEGER DEFAULT 0 CHECK (reorder_point >= 0),
  reorder_quantity INTEGER DEFAULT 0 CHECK (reorder_quantity >= 0),
  channel_buffers JSONB DEFAULT '{}',
  average_cost DECIMAL(12,2) CHECK (average_cost >= 0),
  last_cost DECIMAL(12,2) CHECK (last_cost >= 0),
  last_counted_at TIMESTAMP WITH TIME ZONE,
  last_counted_by UUID,
  cycle_count_due_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(variant_id, location_id),
  CONSTRAINT chk_inventory_reserved_not_exceed_onhand CHECK (reserved <= on_hand)
);

-- Enable Row Level Security
ALTER TABLE tenants ENABLE ROW LEVEL SECURITY;
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_variants ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory_locations ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory_items ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY "Users can only access their tenant" ON tenants
  FOR ALL USING (id = (auth.jwt() ->> 'tenant_id')::UUID);

CREATE POLICY "Users can only access their tenant's products" ON products
  FOR ALL USING (tenant_id = (auth.jwt() ->> 'tenant_id')::UUID);

CREATE POLICY "Users can only access their tenant's variants" ON product_variants
  FOR ALL USING (
    product_id IN (
      SELECT id FROM products WHERE tenant_id = (auth.jwt() ->> 'tenant_id')::UUID
    )
  );

CREATE POLICY "Users can only access their tenant's locations" ON inventory_locations
  FOR ALL USING (tenant_id = (auth.jwt() ->> 'tenant_id')::UUID);

CREATE POLICY "Users can only access their tenant's inventory" ON inventory_items
  FOR ALL USING (
    location_id IN (
      SELECT id FROM inventory_locations WHERE tenant_id = (auth.jwt() ->> 'tenant_id')::UUID
    )
  );

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_products_tenant_id ON products(tenant_id);
CREATE INDEX IF NOT EXISTS idx_products_shopify_id ON products(shopify_product_id) WHERE shopify_product_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_products_status ON products(tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_variants_product_id ON product_variants(product_id);
CREATE INDEX IF NOT EXISTS idx_variants_sku ON product_variants(sku);
CREATE INDEX IF NOT EXISTS idx_locations_tenant_id ON inventory_locations(tenant_id);
CREATE INDEX IF NOT EXISTS idx_inventory_variant_location ON inventory_items(variant_id, location_id);

-- Insert a default tenant for testing
INSERT INTO tenants (name, subdomain, plan) 
VALUES ('CardStore Demo', 'demo', 'free')
ON CONFLICT (subdomain) DO NOTHING;

-- Insert a default location
INSERT INTO inventory_locations (tenant_id, name, type, is_active)
SELECT id, 'Main Store', 'store', true
FROM tenants WHERE subdomain = 'demo'
ON CONFLICT DO NOTHING;