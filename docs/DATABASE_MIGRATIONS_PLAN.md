# Database Migrations Plan for SaaS Transformation

## Overview

This document outlines the database schema changes required to support the SaaS transformation of DeckStack. The migrations are organized by implementation week to align with the development timeline.

## Week 1-2: Foundation Migrations

### Migration 1: Inventory Reservations Table

```sql
-- Create inventory reservations table for proper inventory management
CREATE TABLE inventory_reservations (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    tenant_id TEXT NOT NULL,
    variant_id TEXT NOT NULL,
    location_id TEXT NOT NULL,
    order_id TEXT NOT NULL,
    quantity INTEGER NOT NULL,
    expires_at DATETIME NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    created_by TEXT NOT NULL,
    status TEXT DEFAULT 'active' CHECK (status IN ('active', 'fulfilled', 'expired', 'cancelled')),
    
    FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
    FOREIGN KEY (variant_id) REFERENCES product_variants(id) ON DELETE CASCADE,
    FOREIGN KEY (location_id) REFERENCES inventory_locations(id) ON DELETE CASCADE,
    FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
    FOREIGN KEY (created_by) REFERENCES users(id)
);

CREATE INDEX idx_inventory_reservations_tenant ON inventory_reservations(tenant_id);
CREATE INDEX idx_inventory_reservations_variant ON inventory_reservations(variant_id);
CREATE INDEX idx_inventory_reservations_order ON inventory_reservations(order_id);
CREATE INDEX idx_inventory_reservations_expires ON inventory_reservations(expires_at);
CREATE INDEX idx_inventory_reservations_status ON inventory_reservations(status);
```

### Migration 2: Enhanced Tenant Settings

```sql
-- Add subscription and billing fields to tenant settings
-- This will be stored as JSON in the existing settings field
-- Example structure:
/*
{
  "subscription": {
    "stripeCustomerId": "cus_...",
    "stripeSubscriptionId": "sub_...",
    "planId": "professional",
    "status": "active",
    "currentPeriodStart": "2025-01-01T00:00:00Z",
    "currentPeriodEnd": "2025-02-01T00:00:00Z",
    "cancelAtPeriodEnd": false
  },
  "billing": {
    "email": "billing@example.com",
    "address": {...},
    "taxId": "123456789"
  },
  "features": {
    "multiChannel": true,
    "batchFulfillment": true,
    "advancedAnalytics": false
  },
  "limits": {
    "products": 10000,
    "orders": 1000,
    "locations": 3,
    "users": 5
  },
  "currency": "USD",
  "timezone": "America/New_York"
}
*/

-- No schema change needed, just documentation of JSON structure
```

### Migration 3: User Context Enhancement

```sql
-- Add additional user tracking fields
ALTER TABLE users ADD COLUMN last_activity_at DATETIME;
ALTER TABLE users ADD COLUMN login_count INTEGER DEFAULT 0;
ALTER TABLE users ADD COLUMN preferences TEXT DEFAULT '{}'; -- JSON field

-- Update stock movements to ensure proper user tracking
-- (No schema change needed, just ensure all services use proper user context)
```

## Week 3-4: Inventory Management Enhancements

### Migration 4: Channel Buffer Rules

```sql
-- Create channel buffer rules table
CREATE TABLE channel_buffer_rules (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    tenant_id TEXT NOT NULL,
    variant_id TEXT,  -- NULL means applies to all variants
    channel TEXT NOT NULL,
    buffer_type TEXT NOT NULL CHECK (buffer_type IN ('fixed', 'percentage', 'velocity_based')),
    value REAL NOT NULL,
    min_buffer INTEGER DEFAULT 0,
    max_buffer INTEGER,
    is_active BOOLEAN DEFAULT true,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
    FOREIGN KEY (variant_id) REFERENCES product_variants(id) ON DELETE CASCADE
);

CREATE INDEX idx_channel_buffer_rules_tenant ON channel_buffer_rules(tenant_id);
CREATE INDEX idx_channel_buffer_rules_variant ON channel_buffer_rules(variant_id);
CREATE INDEX idx_channel_buffer_rules_channel ON channel_buffer_rules(channel);
CREATE UNIQUE INDEX idx_channel_buffer_rules_unique ON channel_buffer_rules(tenant_id, variant_id, channel) WHERE variant_id IS NOT NULL;
```

### Migration 5: Inventory Analytics Tables

```sql
-- Create inventory snapshots for historical tracking
CREATE TABLE inventory_snapshots (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    tenant_id TEXT NOT NULL,
    variant_id TEXT NOT NULL,
    location_id TEXT NOT NULL,
    on_hand INTEGER NOT NULL,
    reserved INTEGER NOT NULL,
    available INTEGER NOT NULL,
    safety_stock INTEGER NOT NULL,
    snapshot_date DATE NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
    FOREIGN KEY (variant_id) REFERENCES product_variants(id) ON DELETE CASCADE,
    FOREIGN KEY (location_id) REFERENCES inventory_locations(id) ON DELETE CASCADE
);

CREATE INDEX idx_inventory_snapshots_tenant ON inventory_snapshots(tenant_id);
CREATE INDEX idx_inventory_snapshots_variant ON inventory_snapshots(variant_id);
CREATE INDEX idx_inventory_snapshots_date ON inventory_snapshots(snapshot_date);
CREATE UNIQUE INDEX idx_inventory_snapshots_unique ON inventory_snapshots(tenant_id, variant_id, location_id, snapshot_date);

-- Create sales velocity tracking
CREATE TABLE sales_velocity (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    tenant_id TEXT NOT NULL,
    variant_id TEXT NOT NULL,
    channel TEXT NOT NULL,
    period_start DATE NOT NULL,
    period_end DATE NOT NULL,
    units_sold INTEGER NOT NULL,
    revenue REAL NOT NULL,
    velocity_per_day REAL NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
    FOREIGN KEY (variant_id) REFERENCES product_variants(id) ON DELETE CASCADE
);

CREATE INDEX idx_sales_velocity_tenant ON sales_velocity(tenant_id);
CREATE INDEX idx_sales_velocity_variant ON sales_velocity(variant_id);
CREATE INDEX idx_sales_velocity_channel ON sales_velocity(channel);
CREATE INDEX idx_sales_velocity_period ON sales_velocity(period_start, period_end);
```

## Week 5-6: Order Processing & Fulfillment

### Migration 6: Fulfillment Batches

```sql
-- Create fulfillment batches table
CREATE TABLE fulfillment_batches (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    tenant_id TEXT NOT NULL,
    batch_number TEXT NOT NULL,
    status TEXT DEFAULT 'created' CHECK (status IN ('created', 'picking', 'picked', 'packing', 'shipped', 'completed', 'cancelled')),
    assigned_to TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    started_at DATETIME,
    completed_at DATETIME,
    estimated_completion_time INTEGER, -- minutes
    actual_completion_time INTEGER, -- minutes
    notes TEXT,
    
    FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
    FOREIGN KEY (assigned_to) REFERENCES users(id)
);

CREATE INDEX idx_fulfillment_batches_tenant ON fulfillment_batches(tenant_id);
CREATE INDEX idx_fulfillment_batches_status ON fulfillment_batches(status);
CREATE INDEX idx_fulfillment_batches_assigned ON fulfillment_batches(assigned_to);
CREATE UNIQUE INDEX idx_fulfillment_batches_number ON fulfillment_batches(tenant_id, batch_number);

-- Create batch order associations
CREATE TABLE fulfillment_batch_orders (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    batch_id TEXT NOT NULL,
    order_id TEXT NOT NULL,
    added_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (batch_id) REFERENCES fulfillment_batches(id) ON DELETE CASCADE,
    FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE
);

CREATE INDEX idx_batch_orders_batch ON fulfillment_batch_orders(batch_id);
CREATE INDEX idx_batch_orders_order ON fulfillment_batch_orders(order_id);
CREATE UNIQUE INDEX idx_batch_orders_unique ON fulfillment_batch_orders(batch_id, order_id);

-- Create pick lists
CREATE TABLE pick_lists (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    batch_id TEXT NOT NULL,
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'completed')),
    optimized_route TEXT, -- JSON array of location IDs in optimal order
    estimated_time INTEGER, -- minutes
    actual_time INTEGER, -- minutes
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    started_at DATETIME,
    completed_at DATETIME,
    
    FOREIGN KEY (batch_id) REFERENCES fulfillment_batches(id) ON DELETE CASCADE
);

CREATE INDEX idx_pick_lists_batch ON pick_lists(batch_id);
CREATE INDEX idx_pick_lists_status ON pick_lists(status);

-- Create pick list items
CREATE TABLE pick_list_items (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    pick_list_id TEXT NOT NULL,
    variant_id TEXT NOT NULL,
    location_id TEXT NOT NULL,
    quantity_requested INTEGER NOT NULL,
    quantity_picked INTEGER DEFAULT 0,
    bin_location TEXT,
    sort_order INTEGER,
    picked_at DATETIME,
    picked_by TEXT,
    
    FOREIGN KEY (pick_list_id) REFERENCES pick_lists(id) ON DELETE CASCADE,
    FOREIGN KEY (variant_id) REFERENCES product_variants(id),
    FOREIGN KEY (location_id) REFERENCES inventory_locations(id),
    FOREIGN KEY (picked_by) REFERENCES users(id)
);

CREATE INDEX idx_pick_list_items_list ON pick_list_items(pick_list_id);
CREATE INDEX idx_pick_list_items_variant ON pick_list_items(variant_id);
CREATE INDEX idx_pick_list_items_location ON pick_list_items(location_id);
CREATE INDEX idx_pick_list_items_sort ON pick_list_items(sort_order);
```

### Migration 7: Shipping Labels & Tracking

```sql
-- Create shipping labels table
CREATE TABLE shipping_labels (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    tenant_id TEXT NOT NULL,
    order_id TEXT NOT NULL,
    tracking_number TEXT NOT NULL,
    carrier TEXT NOT NULL,
    service TEXT NOT NULL,
    label_url TEXT,
    label_data TEXT, -- Base64 encoded label
    cost REAL NOT NULL,
    currency TEXT DEFAULT 'USD',
    weight REAL,
    dimensions TEXT, -- JSON: {length, width, height}
    insurance_value REAL,
    signature_required BOOLEAN DEFAULT false,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    voided_at DATETIME,
    
    FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
    FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE
);

CREATE INDEX idx_shipping_labels_tenant ON shipping_labels(tenant_id);
CREATE INDEX idx_shipping_labels_order ON shipping_labels(order_id);
CREATE INDEX idx_shipping_labels_tracking ON shipping_labels(tracking_number);
CREATE INDEX idx_shipping_labels_carrier ON shipping_labels(carrier);

-- Create tracking events table
CREATE TABLE tracking_events (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    tracking_number TEXT NOT NULL,
    status TEXT NOT NULL,
    description TEXT NOT NULL,
    location TEXT,
    timestamp DATETIME NOT NULL,
    carrier TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (tracking_number) REFERENCES shipping_labels(tracking_number)
);

CREATE INDEX idx_tracking_events_tracking ON tracking_events(tracking_number);
CREATE INDEX idx_tracking_events_timestamp ON tracking_events(timestamp);
CREATE INDEX idx_tracking_events_status ON tracking_events(status);
```

## Week 7-8: SaaS Features & Analytics

### Migration 8: Feature Usage Tracking

```sql
-- Create feature usage tracking table
CREATE TABLE feature_usage (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    tenant_id TEXT NOT NULL,
    user_id TEXT,
    feature TEXT NOT NULL,
    action TEXT NOT NULL,
    metadata TEXT DEFAULT '{}', -- JSON
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
    session_id TEXT,
    ip_address TEXT,
    user_agent TEXT,
    
    FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
);

CREATE INDEX idx_feature_usage_tenant ON feature_usage(tenant_id);
CREATE INDEX idx_feature_usage_user ON feature_usage(user_id);
CREATE INDEX idx_feature_usage_feature ON feature_usage(feature);
CREATE INDEX idx_feature_usage_timestamp ON feature_usage(timestamp);
CREATE INDEX idx_feature_usage_session ON feature_usage(session_id);

-- Create usage limits tracking
CREATE TABLE usage_limits (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    tenant_id TEXT NOT NULL,
    resource_type TEXT NOT NULL, -- 'products', 'orders', 'locations', 'users'
    period_start DATE NOT NULL,
    period_end DATE NOT NULL,
    limit_value INTEGER NOT NULL, -- -1 for unlimited
    current_usage INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE
);

CREATE INDEX idx_usage_limits_tenant ON usage_limits(tenant_id);
CREATE INDEX idx_usage_limits_resource ON usage_limits(resource_type);
CREATE INDEX idx_usage_limits_period ON usage_limits(period_start, period_end);
CREATE UNIQUE INDEX idx_usage_limits_unique ON usage_limits(tenant_id, resource_type, period_start);
```

### Migration 9: Onboarding & Customer Success

```sql
-- Create onboarding sessions table
CREATE TABLE onboarding_sessions (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    tenant_id TEXT NOT NULL,
    current_step TEXT,
    completed_steps TEXT DEFAULT '[]', -- JSON array
    data TEXT DEFAULT '{}', -- JSON object with step data
    started_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    completed_at DATETIME,
    abandoned_at DATETIME,
    
    FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE
);

CREATE INDEX idx_onboarding_sessions_tenant ON onboarding_sessions(tenant_id);
CREATE INDEX idx_onboarding_sessions_step ON onboarding_sessions(current_step);
CREATE INDEX idx_onboarding_sessions_started ON onboarding_sessions(started_at);

-- Create customer health scores
CREATE TABLE customer_health_scores (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    tenant_id TEXT NOT NULL,
    score INTEGER NOT NULL CHECK (score >= 0 AND score <= 100),
    factors TEXT NOT NULL, -- JSON object with score factors
    calculated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE
);

CREATE INDEX idx_health_scores_tenant ON customer_health_scores(tenant_id);
CREATE INDEX idx_health_scores_score ON customer_health_scores(score);
CREATE INDEX idx_health_scores_calculated ON customer_health_scores(calculated_at);
```

### Migration 10: Analytics & Reporting

```sql
-- Create daily metrics snapshots
CREATE TABLE daily_metrics (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    tenant_id TEXT,
    metric_date DATE NOT NULL,
    metric_type TEXT NOT NULL, -- 'revenue', 'orders', 'inventory_value', etc.
    value REAL NOT NULL,
    metadata TEXT DEFAULT '{}', -- JSON with additional context
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE
);

CREATE INDEX idx_daily_metrics_tenant ON daily_metrics(tenant_id);
CREATE INDEX idx_daily_metrics_date ON daily_metrics(metric_date);
CREATE INDEX idx_daily_metrics_type ON daily_metrics(metric_type);
CREATE UNIQUE INDEX idx_daily_metrics_unique ON daily_metrics(tenant_id, metric_date, metric_type);

-- Create system-wide metrics (for SaaS analytics)
CREATE TABLE system_metrics (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    metric_date DATE NOT NULL,
    metric_type TEXT NOT NULL, -- 'mrr', 'arr', 'churn_rate', 'dau', 'mau'
    value REAL NOT NULL,
    metadata TEXT DEFAULT '{}',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_system_metrics_date ON system_metrics(metric_date);
CREATE INDEX idx_system_metrics_type ON system_metrics(metric_type);
CREATE UNIQUE INDEX idx_system_metrics_unique ON system_metrics(metric_date, metric_type);
```

## Migration Execution Plan

### Week 1 Migrations
```bash
# Run these migrations at the start of Week 1
npx prisma migrate dev --name "add_inventory_reservations"
npx prisma migrate dev --name "enhance_user_tracking"
```

### Week 3 Migrations
```bash
# Run these migrations at the start of Week 3
npx prisma migrate dev --name "add_channel_buffer_rules"
npx prisma migrate dev --name "add_inventory_analytics"
```

### Week 5 Migrations
```bash
# Run these migrations at the start of Week 5
npx prisma migrate dev --name "add_fulfillment_batches"
npx prisma migrate dev --name "add_shipping_labels"
```

### Week 7 Migrations
```bash
# Run these migrations at the start of Week 7
npx prisma migrate dev --name "add_feature_usage_tracking"
npx prisma migrate dev --name "add_onboarding_analytics"
```

## Data Migration Scripts

### Script 1: Migrate Existing Inventory Data
```typescript
// scripts/migrate-inventory-data.ts
async function migrateInventoryData() {
  // Create default inventory reservations for existing orders
  const existingOrders = await prisma.order.findMany({
    where: { status: 'processing' },
    include: { lineItems: true }
  });
  
  for (const order of existingOrders) {
    for (const lineItem of order.lineItems) {
      // Create reservation if inventory exists
      const inventory = await prisma.inventoryItem.findFirst({
        where: {
          tenantId: order.tenantId,
          variantId: lineItem.variantId
        }
      });
      
      if (inventory && inventory.onHand >= lineItem.quantity) {
        await prisma.inventoryReservation.create({
          data: {
            tenantId: order.tenantId,
            variantId: lineItem.variantId,
            locationId: inventory.locationId,
            orderId: order.id,
            quantity: lineItem.quantity,
            expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
            createdBy: 'migration-script'
          }
        });
        
        // Update reserved quantity
        await prisma.inventoryItem.update({
          where: { id: inventory.id },
          data: { reserved: { increment: lineItem.quantity } }
        });
      }
    }
  }
}
```

### Script 2: Initialize Customer Health Scores
```typescript
// scripts/initialize-health-scores.ts
async function initializeHealthScores() {
  const tenants = await prisma.tenant.findMany({
    where: { isActive: true }
  });
  
  for (const tenant of tenants) {
    const score = await calculateInitialHealthScore(tenant.id);
    
    await prisma.customerHealthScore.create({
      data: {
        tenantId: tenant.id,
        score,
        factors: JSON.stringify({
          onboardingComplete: false,
          recentActivity: false,
          featureAdoption: 0,
          supportTickets: 0
        })
      }
    });
  }
}
```

## Rollback Plans

Each migration includes a corresponding rollback script:

```sql
-- Example rollback for inventory_reservations
DROP TABLE IF EXISTS inventory_reservations;

-- Rollback reserved quantity updates
UPDATE inventory_items SET reserved = 0;
```

## Performance Considerations

### Indexing Strategy
- All foreign keys have corresponding indexes
- Composite indexes for common query patterns
- Partial indexes where appropriate (e.g., active records only)

### Query Optimization
- Use EXPLAIN QUERY PLAN to validate performance
- Monitor slow query log
- Implement query result caching for expensive operations

### Data Retention
- Implement data archival for old tracking events
- Compress historical snapshots
- Set up automated cleanup jobs

## Testing Strategy

### Migration Testing
1. Test each migration on a copy of production data
2. Verify data integrity after migration
3. Test rollback procedures
4. Performance test with realistic data volumes

### Integration Testing
1. Verify all application features work with new schema
2. Test API endpoints with new data structures
3. Validate webhook processing with enhanced data

This migration plan ensures that the database schema evolves systematically to support the SaaS transformation while maintaining data integrity and performance.