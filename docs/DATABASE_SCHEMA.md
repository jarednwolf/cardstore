# CardStore Operations Layer - Database Schema Design

## Document Information
- **Version**: 1.0
- **Date**: 2025-08-02
- **Status**: Draft
- **Owner**: Engineering Team
- **Related Documents**: [Technical Design](./TECHNICAL_DESIGN.md), [PRD](./PRD.md)

## Table of Contents
1. [Schema Overview](#schema-overview)
2. [Core Tables](#core-tables)
3. [Indexes and Performance](#indexes-and-performance)
4. [Migration Strategy](#migration-strategy)
5. [Data Relationships](#data-relationships)
6. [Partitioning Strategy](#partitioning-strategy)
7. [Backup and Recovery](#backup-and-recovery)

## Schema Overview

### Database Configuration
- **Database**: PostgreSQL 15+
- **Character Set**: UTF-8
- **Timezone**: UTC
- **Extensions**: uuid-ossp, pg_trgm, btree_gin
- **Connection Pooling**: PgBouncer with transaction pooling

### Naming Conventions
- **Tables**: snake_case, plural nouns (e.g., `product_variants`)
- **Columns**: snake_case (e.g., `created_at`)
- **Indexes**: `idx_table_column(s)` (e.g., `idx_products_tenant_status`)
- **Foreign Keys**: `fk_table_referenced_table` (e.g., `fk_variants_products`)
- **Constraints**: `chk_table_condition` (e.g., `chk_inventory_positive_quantity`)

### Multi-Tenancy
All tables include `tenant_id` for multi-tenant isolation:
```sql
-- Tenant isolation
CREATE TABLE tenants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(100) NOT NULL,
    subdomain VARCHAR(50) UNIQUE NOT NULL,
    settings JSONB DEFAULT '{}',
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Row Level Security (RLS) example
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON products
    USING (tenant_id = current_setting('app.current_tenant_id')::UUID);
```

## Core Tables

### 1. Product Catalog

#### Products Table
```sql
CREATE TABLE products (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    
    -- Shopify Integration
    shopify_product_id BIGINT UNIQUE,
    shopify_handle VARCHAR(255),
    
    -- Product Information
    title VARCHAR(500) NOT NULL,
    description TEXT,
    vendor VARCHAR(100),
    product_type VARCHAR(100),
    category VARCHAR(100),
    tags TEXT[] DEFAULT '{}',
    
    -- SEO and Marketing
    seo_title VARCHAR(255),
    seo_description TEXT,
    
    -- Status and Visibility
    status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'draft', 'archived')),
    published_at TIMESTAMP WITH TIME ZONE,
    
    -- Metadata
    metadata JSONB DEFAULT '{}',
    
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Constraints
    CONSTRAINT chk_products_title_length CHECK (char_length(title) >= 1),
    CONSTRAINT chk_products_status_published CHECK (
        (status = 'active' AND published_at IS NOT NULL) OR 
        (status != 'active')
    )
);

-- Indexes
CREATE INDEX idx_products_tenant_id ON products(tenant_id);
CREATE INDEX idx_products_shopify_id ON products(shopify_product_id) WHERE shopify_product_id IS NOT NULL;
CREATE INDEX idx_products_status ON products(tenant_id, status);
CREATE INDEX idx_products_category ON products(tenant_id, category) WHERE category IS NOT NULL;
CREATE INDEX idx_products_vendor ON products(tenant_id, vendor) WHERE vendor IS NOT NULL;
CREATE INDEX idx_products_tags ON products USING GIN(tags);
CREATE INDEX idx_products_search ON products USING GIN(to_tsvector('english', title || ' ' || COALESCE(description, '')));
```

#### Product Variants Table
```sql
CREATE TABLE product_variants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    
    -- Shopify Integration
    shopify_variant_id BIGINT UNIQUE,
    
    -- Variant Information
    sku VARCHAR(100) UNIQUE NOT NULL,
    barcode VARCHAR(50),
    title VARCHAR(255) NOT NULL,
    
    -- Pricing
    price DECIMAL(12,2) NOT NULL CHECK (price >= 0),
    compare_at_price DECIMAL(12,2) CHECK (compare_at_price >= 0),
    cost_price DECIMAL(12,2) CHECK (cost_price >= 0),
    
    -- Physical Properties
    weight DECIMAL(8,2) CHECK (weight >= 0),
    weight_unit VARCHAR(10) DEFAULT 'g' CHECK (weight_unit IN ('g', 'kg', 'oz', 'lb')),
    
    -- Shipping and Tax
    requires_shipping BOOLEAN DEFAULT true,
    taxable BOOLEAN DEFAULT true,
    tax_code VARCHAR(50),
    
    -- TCG-Specific Attributes
    tcg_attributes JSONB DEFAULT '{}',
    
    -- Inventory Tracking
    track_inventory BOOLEAN DEFAULT true,
    inventory_policy VARCHAR(20) DEFAULT 'deny' CHECK (inventory_policy IN ('deny', 'continue')),
    
    -- Variant Options (size, color, etc.)
    option1 VARCHAR(255),
    option2 VARCHAR(255),
    option3 VARCHAR(255),
    
    -- Status
    status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'draft', 'archived')),
    
    -- Metadata
    metadata JSONB DEFAULT '{}',
    
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Constraints
    CONSTRAINT chk_variants_title_length CHECK (char_length(title) >= 1),
    CONSTRAINT chk_variants_sku_length CHECK (char_length(sku) >= 1)
);

-- Indexes
CREATE INDEX idx_variants_product_id ON product_variants(product_id);
CREATE INDEX idx_variants_shopify_id ON product_variants(shopify_variant_id) WHERE shopify_variant_id IS NOT NULL;
CREATE INDEX idx_variants_sku ON product_variants(sku);
CREATE INDEX idx_variants_barcode ON product_variants(barcode) WHERE barcode IS NOT NULL;
CREATE INDEX idx_variants_status ON product_variants(product_id, status);
CREATE INDEX idx_variants_tcg_attributes ON product_variants USING GIN(tcg_attributes);
CREATE INDEX idx_variants_price_range ON product_variants(price) WHERE status = 'active';
```

#### TCG Attributes Schema
```sql
-- TCG attributes stored in JSONB with defined structure
/*
{
  "language": "English",
  "set": "Alpha",
  "setCode": "LEA",
  "rarity": "Rare",
  "condition": "Near Mint",
  "foil": false,
  "grading": {
    "company": "PSA",
    "grade": "10",
    "certNumber": "12345678",
    "gradedAt": "2023-01-15T00:00:00Z",
    "authenticator": "PSA"
  },
  "serialNumber": "001/100",
  "artist": "Mark Poole",
  "cardNumber": "1",
  "manaCost": "{3}{U}{U}",
  "cardType": "Creature",
  "subType": "Wizard",
  "power": "2",
  "toughness": "2",
  "loyalty": null,
  "cmc": 5,
  "colorIdentity": ["U"],
  "legalities": {
    "standard": "not_legal",
    "modern": "legal",
    "legacy": "legal",
    "vintage": "legal"
  },
  "printings": ["LEA", "LEB", "2ED"],
  "tcgplayerId": 1234,
  "scryfallId": "550c74d4-1fcb-406a-b02a-639a760a4380"
}
*/

-- Validation function for TCG attributes
CREATE OR REPLACE FUNCTION validate_tcg_attributes(attributes JSONB)
RETURNS BOOLEAN AS $$
BEGIN
    -- Validate condition values
    IF attributes ? 'condition' THEN
        IF NOT (attributes->>'condition' IN ('Mint', 'Near Mint', 'Lightly Played', 'Moderately Played', 'Heavily Played', 'Damaged')) THEN
            RETURN FALSE;
        END IF;
    END IF;
    
    -- Validate grading company
    IF attributes ? 'grading' AND attributes->'grading' ? 'company' THEN
        IF NOT (attributes->'grading'->>'company' IN ('PSA', 'BGS', 'SGC', 'CGC', 'HGA')) THEN
            RETURN FALSE;
        END IF;
    END IF;
    
    RETURN TRUE;
END;
$$ LANGUAGE plpgsql;

-- Add constraint to validate TCG attributes
ALTER TABLE product_variants 
ADD CONSTRAINT chk_variants_tcg_attributes 
CHECK (validate_tcg_attributes(tcg_attributes));
```

### 2. Inventory Management

#### Inventory Locations Table
```sql
CREATE TABLE inventory_locations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    
    -- Shopify Integration
    shopify_location_id BIGINT UNIQUE,
    
    -- Location Information
    name VARCHAR(100) NOT NULL,
    type VARCHAR(20) NOT NULL CHECK (type IN ('warehouse', 'store', 'virtual', 'consignment')),
    
    -- Address Information
    address JSONB,
    
    -- Configuration
    is_active BOOLEAN DEFAULT true,
    fulfills_online_orders BOOLEAN DEFAULT true,
    priority INTEGER DEFAULT 0,
    
    -- Contact Information
    contact_info JSONB DEFAULT '{}',
    
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Constraints
    CONSTRAINT chk_locations_name_length CHECK (char_length(name) >= 1)
);

-- Indexes
CREATE INDEX idx_locations_tenant_id ON inventory_locations(tenant_id);
CREATE INDEX idx_locations_shopify_id ON inventory_locations(shopify_location_id) WHERE shopify_location_id IS NOT NULL;
CREATE INDEX idx_locations_type ON inventory_locations(tenant_id, type);
CREATE INDEX idx_locations_active ON inventory_locations(tenant_id, is_active);
```

#### Inventory Items Table
```sql
CREATE TABLE inventory_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    variant_id UUID NOT NULL REFERENCES product_variants(id) ON DELETE CASCADE,
    location_id UUID NOT NULL REFERENCES inventory_locations(id) ON DELETE CASCADE,
    
    -- Quantity Tracking
    on_hand INTEGER NOT NULL DEFAULT 0 CHECK (on_hand >= 0),
    reserved INTEGER NOT NULL DEFAULT 0 CHECK (reserved >= 0),
    available INTEGER GENERATED ALWAYS AS (on_hand - reserved) STORED,
    
    -- Inventory Management
    safety_stock INTEGER DEFAULT 0 CHECK (safety_stock >= 0),
    reorder_point INTEGER DEFAULT 0 CHECK (reorder_point >= 0),
    reorder_quantity INTEGER DEFAULT 0 CHECK (reorder_quantity >= 0),
    
    -- Channel Buffers (JSON: {"ebay": 2, "amazon": 1})
    channel_buffers JSONB DEFAULT '{}',
    
    -- Cost Tracking
    average_cost DECIMAL(12,2) CHECK (average_cost >= 0),
    last_cost DECIMAL(12,2) CHECK (last_cost >= 0),
    
    -- Audit Information
    last_counted_at TIMESTAMP WITH TIME ZONE,
    last_counted_by UUID,
    cycle_count_due_at TIMESTAMP WITH TIME ZONE,
    
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Constraints
    UNIQUE(variant_id, location_id),
    CONSTRAINT chk_inventory_reserved_not_exceed_onhand CHECK (reserved <= on_hand)
);

-- Indexes
CREATE INDEX idx_inventory_variant_location ON inventory_items(variant_id, location_id);
CREATE INDEX idx_inventory_location_variant ON inventory_items(location_id, variant_id);
CREATE INDEX idx_inventory_low_stock ON inventory_items(variant_id) WHERE available <= safety_stock;
CREATE INDEX idx_inventory_negative ON inventory_items(variant_id) WHERE available < 0;
CREATE INDEX idx_inventory_cycle_count ON inventory_items(cycle_count_due_at) WHERE cycle_count_due_at IS NOT NULL;
CREATE INDEX idx_inventory_buffers ON inventory_items USING GIN(channel_buffers);
```

#### Stock Movements Table
```sql
CREATE TABLE stock_movements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    variant_id UUID NOT NULL REFERENCES product_variants(id),
    location_id UUID NOT NULL REFERENCES inventory_locations(id),
    
    -- Movement Details
    type VARCHAR(20) NOT NULL CHECK (type IN ('in', 'out', 'transfer', 'adjustment')),
    quantity INTEGER NOT NULL,
    
    -- Reason and Reference
    reason VARCHAR(50) NOT NULL,
    reference VARCHAR(100),
    reference_type VARCHAR(20), -- 'order', 'po', 'transfer', 'adjustment'
    
    -- Cost Information
    unit_cost DECIMAL(12,2) CHECK (unit_cost >= 0),
    total_cost DECIMAL(12,2) CHECK (total_cost >= 0),
    
    -- Audit Trail
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_by UUID NOT NULL,
    
    -- Batch Information
    batch_id UUID,
    
    -- Notes
    notes TEXT
);

-- Indexes
CREATE INDEX idx_stock_movements_variant_created ON stock_movements(variant_id, created_at DESC);
CREATE INDEX idx_stock_movements_location_created ON stock_movements(location_id, created_at DESC);
CREATE INDEX idx_stock_movements_reference ON stock_movements(reference_type, reference) WHERE reference IS NOT NULL;
CREATE INDEX idx_stock_movements_batch ON stock_movements(batch_id) WHERE batch_id IS NOT NULL;
CREATE INDEX idx_stock_movements_created_by ON stock_movements(created_by, created_at DESC);

-- Partitioning by month for performance
CREATE TABLE stock_movements_y2025m01 PARTITION OF stock_movements
    FOR VALUES FROM ('2025-01-01') TO ('2025-02-01');
```

### 3. Order Management

#### Customers Table
```sql
CREATE TABLE customers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    
    -- Shopify Integration
    shopify_customer_id BIGINT UNIQUE,
    
    -- Customer Information
    email VARCHAR(255) UNIQUE,
    first_name VARCHAR(100),
    last_name VARCHAR(100),
    phone VARCHAR(20),
    
    -- Default Addresses
    default_address JSONB,
    
    -- Customer Metrics
    total_spent DECIMAL(12,2) DEFAULT 0 CHECK (total_spent >= 0),
    order_count INTEGER DEFAULT 0 CHECK (order_count >= 0),
    
    -- Store Credit and Loyalty
    store_credit_balance DECIMAL(12,2) DEFAULT 0 CHECK (store_credit_balance >= 0),
    loyalty_points INTEGER DEFAULT 0 CHECK (loyalty_points >= 0),
    
    -- Customer Status
    status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'disabled', 'invited', 'declined')),
    accepts_marketing BOOLEAN DEFAULT false,
    
    -- Metadata
    tags TEXT[] DEFAULT '{}',
    notes TEXT,
    metadata JSONB DEFAULT '{}',
    
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    last_order_at TIMESTAMP WITH TIME ZONE,
    
    -- Constraints
    CONSTRAINT chk_customers_email_format CHECK (email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$')
);

-- Indexes
CREATE INDEX idx_customers_tenant_id ON customers(tenant_id);
CREATE INDEX idx_customers_shopify_id ON customers(shopify_customer_id) WHERE shopify_customer_id IS NOT NULL;
CREATE INDEX idx_customers_email ON customers(email) WHERE email IS NOT NULL;
CREATE INDEX idx_customers_name ON customers(tenant_id, last_name, first_name);
CREATE INDEX idx_customers_total_spent ON customers(tenant_id, total_spent DESC);
CREATE INDEX idx_customers_tags ON customers USING GIN(tags);
```

#### Orders Table
```sql
CREATE TABLE orders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    
    -- External System Integration
    shopify_order_id BIGINT UNIQUE,
    external_order_id VARCHAR(100),
    
    -- Order Identification
    order_number VARCHAR(50) NOT NULL,
    source VARCHAR(20) NOT NULL CHECK (source IN ('shopify', 'binderpos', 'tcgplayer', 'ebay', 'amazon', 'google', 'manual')),
    
    -- Customer Information
    customer_id UUID REFERENCES customers(id),
    customer_email VARCHAR(255),
    
    -- Order Status
    status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'fulfilled', 'cancelled', 'refunded')),
    financial_status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (financial_status IN ('pending', 'authorized', 'paid', 'partially_paid', 'refunded', 'partially_refunded', 'voided')),
    fulfillment_status VARCHAR(20) NOT NULL DEFAULT 'unfulfilled' CHECK (fulfillment_status IN ('unfulfilled', 'partial', 'fulfilled')),
    
    -- Pricing Information
    subtotal_price DECIMAL(12,2) NOT NULL CHECK (subtotal_price >= 0),
    total_tax DECIMAL(12,2) DEFAULT 0 CHECK (total_tax >= 0),
    total_shipping DECIMAL(12,2) DEFAULT 0 CHECK (total_shipping >= 0),
    total_discounts DECIMAL(12,2) DEFAULT 0 CHECK (total_discounts >= 0),
    total_price DECIMAL(12,2) NOT NULL CHECK (total_price >= 0),
    currency VARCHAR(3) NOT NULL DEFAULT 'USD',
    
    -- Addresses (stored as JSONB)
    shipping_address JSONB,
    billing_address JSONB,
    
    -- Shipping Information
    shipping_method VARCHAR(100),
    tracking_numbers TEXT[] DEFAULT '{}',
    
    -- Order Metadata
    tags TEXT[] DEFAULT '{}',
    notes TEXT,
    channel_data JSONB DEFAULT '{}', -- Channel-specific data
    
    -- Important Dates
    processed_at TIMESTAMP WITH TIME ZONE,
    shipped_at TIMESTAMP WITH TIME ZONE,
    delivered_at TIMESTAMP WITH TIME ZONE,
    cancelled_at TIMESTAMP WITH TIME ZONE,
    
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Constraints
    UNIQUE(tenant_id, order_number),
    CONSTRAINT chk_orders_total_calculation CHECK (
        total_price = subtotal_price + total_tax + total_shipping - total_discounts
    )
);

-- Indexes
CREATE INDEX idx_orders_tenant_id ON orders(tenant_id);
CREATE INDEX idx_orders_shopify_id ON orders(shopify_order_id) WHERE shopify_order_id IS NOT NULL;
CREATE INDEX idx_orders_external_id ON orders(external_order_id) WHERE external_order_id IS NOT NULL;
CREATE INDEX idx_orders_customer_id ON orders(customer_id) WHERE customer_id IS NOT NULL;
CREATE INDEX idx_orders_status ON orders(tenant_id, status);
CREATE INDEX idx_orders_source ON orders(tenant_id, source);
CREATE INDEX idx_orders_created_at ON orders(tenant_id, created_at DESC);
CREATE INDEX idx_orders_fulfillment_status ON orders(tenant_id, fulfillment_status) WHERE fulfillment_status != 'fulfilled';
CREATE INDEX idx_orders_tags ON orders USING GIN(tags);
```

#### Order Line Items Table
```sql
CREATE TABLE order_line_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    variant_id UUID NOT NULL REFERENCES product_variants(id),
    
    -- Line Item Details
    quantity INTEGER NOT NULL CHECK (quantity > 0),
    price DECIMAL(12,2) NOT NULL CHECK (price >= 0),
    total_discount DECIMAL(12,2) DEFAULT 0 CHECK (total_discount >= 0),
    
    -- Fulfillment Tracking
    fulfilled_quantity INTEGER DEFAULT 0 CHECK (fulfilled_quantity >= 0),
    fulfillable_quantity INTEGER GENERATED ALWAYS AS (quantity - fulfilled_quantity) STORED,
    
    -- Product Snapshot (at time of order)
    title VARCHAR(255) NOT NULL,
    sku VARCHAR(100) NOT NULL,
    variant_title VARCHAR(255),
    vendor VARCHAR(100),
    
    -- Tax Information
    taxable BOOLEAN DEFAULT true,
    tax_lines JSONB DEFAULT '[]',
    
    -- Metadata
    properties JSONB DEFAULT '{}', -- Custom properties
    
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Constraints
    CONSTRAINT chk_line_items_fulfilled_not_exceed_quantity CHECK (fulfilled_quantity <= quantity)
);

-- Indexes
CREATE INDEX idx_line_items_order_id ON order_line_items(order_id);
CREATE INDEX idx_line_items_variant_id ON order_line_items(variant_id);
CREATE INDEX idx_line_items_sku ON order_line_items(sku);
CREATE INDEX idx_line_items_unfulfilled ON order_line_items(variant_id) WHERE fulfillable_quantity > 0;
```

### 4. Fulfillment Management

#### Fulfillment Batches Table
```sql
CREATE TABLE fulfillment_batches (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    
    -- Batch Information
    batch_number VARCHAR(50) NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'created' CHECK (status IN ('created', 'picking', 'picked', 'packing', 'shipped', 'completed', 'cancelled')),
    
    -- Assignment
    assigned_to UUID, -- User ID
    location_id UUID REFERENCES inventory_locations(id),
    
    -- Metrics
    total_orders INTEGER DEFAULT 0,
    total_items INTEGER DEFAULT 0,
    estimated_pick_time INTEGER, -- minutes
    
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    started_at TIMESTAMP WITH TIME ZONE,
    completed_at TIMESTAMP WITH TIME ZONE,
    
    -- Constraints
    UNIQUE(tenant_id, batch_number)
);

-- Indexes
CREATE INDEX idx_batches_tenant_status ON fulfillment_batches(tenant_id, status);
CREATE INDEX idx_batches_assigned_to ON fulfillment_batches(assigned_to) WHERE assigned_to IS NOT NULL;
CREATE INDEX idx_batches_location ON fulfillment_batches(location_id) WHERE location_id IS NOT NULL;
```

#### Batch Orders Table (Junction)
```sql
CREATE TABLE batch_orders (
    batch_id UUID NOT NULL REFERENCES fulfillment_batches(id) ON DELETE CASCADE,
    order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    added_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    PRIMARY KEY (batch_id, order_id)
);

-- Indexes
CREATE INDEX idx_batch_orders_batch_id ON batch_orders(batch_id);
CREATE INDEX idx_batch_orders_order_id ON batch_orders(order_id);
```

### 5. Purchasing and Receiving

#### Distributors Table
```sql
CREATE TABLE distributors (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    
    -- Distributor Information
    name VARCHAR(100) NOT NULL,
    code VARCHAR(20) UNIQUE NOT NULL,
    
    -- Contact Information
    contact_info JSONB DEFAULT '{}',
    
    -- Integration Settings
    api_settings JSONB DEFAULT '{}',
    
    -- Business Terms
    payment_terms VARCHAR(50),
    shipping_terms VARCHAR(50),
    minimum_order DECIMAL(12,2),
    
    -- Status
    is_active BOOLEAN DEFAULT true,
    
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_distributors_tenant_id ON distributors(tenant_id);
CREATE INDEX idx_distributors_code ON distributors(code);
CREATE INDEX idx_distributors_active ON distributors(tenant_id, is_active);
```

#### Purchase Orders Table
```sql
CREATE TABLE purchase_orders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    distributor_id UUID NOT NULL REFERENCES distributors(id),
    
    -- PO Information
    po_number VARCHAR(50) NOT NULL,
    external_po_number VARCHAR(50), -- Distributor's PO number
    
    -- Status
    status VARCHAR(20) NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'submitted', 'confirmed', 'partial', 'received', 'cancelled')),
    
    -- Pricing
    subtotal DECIMAL(12,2) DEFAULT 0,
    tax_amount DECIMAL(12,2) DEFAULT 0,
    shipping_amount DECIMAL(12,2) DEFAULT 0,
    total_amount DECIMAL(12,2) DEFAULT 0,
    currency VARCHAR(3) DEFAULT 'USD',
    
    -- Shipping Information
    ship_to_location_id UUID REFERENCES inventory_locations(id),
    shipping_address JSONB,
    
    -- Important Dates
    order_date DATE NOT NULL DEFAULT CURRENT_DATE,
    expected_date DATE,
    submitted_at TIMESTAMP WITH TIME ZONE,
    
    -- Notes
    notes TEXT,
    
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Constraints
    UNIQUE(tenant_id, po_number)
);

-- Indexes
CREATE INDEX idx_purchase_orders_tenant_id ON purchase_orders(tenant_id);
CREATE INDEX idx_purchase_orders_distributor ON purchase_orders(distributor_id);
CREATE INDEX idx_purchase_orders_status ON purchase_orders(tenant_id, status);
CREATE INDEX idx_purchase_orders_order_date ON purchase_orders(tenant_id, order_date DESC);
```

## Indexes and Performance

### Primary Indexes
```sql
-- Full-text search indexes
CREATE INDEX idx_products_fulltext ON products 
USING GIN(to_tsvector('english', title || ' ' || COALESCE(description, '') || ' ' || COALESCE(vendor, '')));

CREATE INDEX idx_variants_fulltext ON product_variants 
USING GIN(to_tsvector('english', title || ' ' || sku || ' ' || COALESCE(barcode, '')));

-- Composite indexes for common queries
CREATE INDEX idx_orders_customer_date ON orders(customer_id, created_at DESC) WHERE customer_id IS NOT NULL;
CREATE INDEX idx_orders_status_date ON orders(tenant_id, status, created_at DESC);
CREATE INDEX idx_inventory_location_available ON inventory_items(location_id, available DESC) WHERE available > 0;

-- Partial indexes for performance
CREATE INDEX idx_products_active ON products(tenant_id, updated_at DESC) WHERE status = 'active';
CREATE INDEX idx_variants_active ON product_variants(product_id, updated_at DESC) WHERE status = 'active';
CREATE INDEX idx_orders_pending ON orders(tenant_id, created_at DESC) WHERE status IN ('pending', 'processing');
```

### Performance Optimization
```sql
-- Materialized view for inventory summary
CREATE MATERIALIZED VIEW inventory_summary AS
SELECT 
    v.id as variant_id,
    v.sku,
    v.title,
    p.title as product_title,
    SUM(i.on_hand) as total_on_hand,
    SUM(i.reserved) as total_reserved,
    SUM(i.available) as total_available,
    COUNT(i.location_id) as location_count,
    MAX(i.updated_at) as last_updated
FROM product_variants v
LEFT JOIN inventory_items i ON v.id = i.variant_id
LEFT JOIN products p ON v.product_id = p.id
WHERE v.status = 'active' AND v.track_inventory = true
GROUP BY v.id, v.sku, v.title, p.title;

CREATE UNIQUE INDEX idx_inventory_summary_variant ON inventory_summary(variant_id);
CREATE INDEX idx_inventory_summary_sku ON inventory_summary(sku);
CREATE INDEX idx_inventory_summary_low_stock ON inventory_summary(total_available) WHERE total_available <= 5;

-- Refresh strategy
CREATE OR REPLACE FUNCTION refresh_inventory_summary()
RETURNS TRIGGER AS $$
BEGIN
    REFRESH MATERIALIZED VIEW CONCURRENTLY inventory_summary;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Trigger to refresh on inventory changes
CREATE TRIGGER trigger_refresh_inventory_summary
    AFTER INSERT OR UPDATE OR DELETE ON inventory_items
    FOR EACH STATEMENT
    EXECUTE FUNCTION refresh_inventory_summary();
```

## Migration Strategy

### Migration Framework
```sql
-- Migration tracking table
CREATE TABLE schema_migrations (
    version VARCHAR(20) PRIMARY KEY,
    applied_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    execution_time_ms INTEGER,
    checksum VARCHAR(64)
);

-- Migration template
/*
-- Migration: 001_initial_schema.sql
-- Description: Create initial database schema
-- Author: Engineering Team
-- Date: 2025-08-02

BEGIN;

-- Create tables, indexes, constraints
-- ... migration code ...

-- Update migration tracking
INSERT INTO schema_migrations (version, checksum) 
VALUES ('001', 'sha256_checksum_here');

COMMIT;
*/
```

### Migration Phases

#### Phase 1: Core Schema (Week 1)
```sql
-- 001_initial_schema.sql
-- - tenants table
-- - products and product_variants tables
-- - Basic indexes

-- 002_inventory_schema.sql
-- - inventory_locations table
-- - inventory_items table
-- - stock_movements table

-- 003_orders_schema.sql
-- - customers table
-- - orders table
-- - order_line_items table
```

#### Phase 2: Advanced Features (Week 2-3)
```sql
-- 004_fulfillment_schema.sql
-- - fulfillment_batches table
-- - batch_orders junction table

-- 005_purchasing_schema.sql
-- - distributors table
-- - purchase_orders table
-- - purchase_order_line_items table

-- 006_performance_indexes.sql
-- - Full-text search indexes
-- - Composite indexes
-- - Materialized views
```

#### Phase 3: Optimization (Week 4+)
```sql
-- 007_partitioning.sql
--