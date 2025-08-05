-- Performance Optimization Migration
-- Add critical indexes for query performance

-- Orders table indexes for common queries
CREATE INDEX IF NOT EXISTS "orders_tenant_status_idx" ON "orders"("tenant_id", "status");
CREATE INDEX IF NOT EXISTS "orders_tenant_created_at_idx" ON "orders"("tenant_id", "created_at");
CREATE INDEX IF NOT EXISTS "orders_source_created_at_idx" ON "orders"("source", "created_at");
CREATE INDEX IF NOT EXISTS "orders_customer_id_idx" ON "orders"("customer_id");

-- Products table indexes for search and filtering
CREATE INDEX IF NOT EXISTS "products_tenant_category_idx" ON "products"("tenant_id", "category");
CREATE INDEX IF NOT EXISTS "products_tenant_vendor_idx" ON "products"("tenant_id", "vendor");
CREATE INDEX IF NOT EXISTS "products_tenant_status_idx" ON "products"("tenant_id", "status");

-- Product variants indexes for inventory operations
CREATE INDEX IF NOT EXISTS "product_variants_tenant_sku_idx" ON "product_variants"("tenant_id", "sku");
CREATE INDEX IF NOT EXISTS "product_variants_product_id_idx" ON "product_variants"("product_id");
CREATE INDEX IF NOT EXISTS "product_variants_barcode_idx" ON "product_variants"("barcode") WHERE "barcode" IS NOT NULL;

-- Inventory items indexes for stock queries
CREATE INDEX IF NOT EXISTS "inventory_items_tenant_location_idx" ON "inventory_items"("tenant_id", "location_id");
CREATE INDEX IF NOT EXISTS "inventory_items_variant_location_idx" ON "inventory_items"("variant_id", "location_id");
CREATE INDEX IF NOT EXISTS "inventory_items_on_hand_idx" ON "inventory_items"("on_hand") WHERE "on_hand" > 0;

-- Stock movements indexes for audit and reporting
CREATE INDEX IF NOT EXISTS "stock_movements_tenant_created_at_idx" ON "stock_movements"("tenant_id", "created_at");
CREATE INDEX IF NOT EXISTS "stock_movements_variant_created_at_idx" ON "stock_movements"("variant_id", "created_at");
CREATE INDEX IF NOT EXISTS "stock_movements_type_reason_idx" ON "stock_movements"("type", "reason");

-- Order line items indexes for fulfillment
CREATE INDEX IF NOT EXISTS "order_line_items_order_id_idx" ON "order_line_items"("order_id");
CREATE INDEX IF NOT EXISTS "order_line_items_variant_id_idx" ON "order_line_items"("variant_id");

-- Users table indexes for authentication
CREATE INDEX IF NOT EXISTS "users_tenant_email_idx" ON "users"("tenant_id", "email");
CREATE INDEX IF NOT EXISTS "users_tenant_role_idx" ON "users"("tenant_id", "role");
CREATE INDEX IF NOT EXISTS "users_is_active_idx" ON "users"("is_active") WHERE "is_active" = true;

-- API call logs indexes for analytics (if table exists)
CREATE INDEX IF NOT EXISTS "api_call_logs_tenant_created_at_idx" ON "api_call_logs"("tenant_id", "created_at");
CREATE INDEX IF NOT EXISTS "api_call_logs_endpoint_idx" ON "api_call_logs"("endpoint");
CREATE INDEX IF NOT EXISTS "api_call_logs_status_code_idx" ON "api_call_logs"("status_code");

-- Webhook logs indexes for processing
CREATE INDEX IF NOT EXISTS "webhook_logs_source_topic_idx" ON "webhook_logs"("source", "topic");
CREATE INDEX IF NOT EXISTS "webhook_logs_processed_created_at_idx" ON "webhook_logs"("processed", "created_at");

-- Channel prices indexes for pricing operations
CREATE INDEX IF NOT EXISTS "channel_prices_variant_channel_idx" ON "channel_prices"("variant_id", "channel");
CREATE INDEX IF NOT EXISTS "channel_prices_channel_active_idx" ON "channel_prices"("channel", "is_active") WHERE "is_active" = true;

-- Composite indexes for complex queries
CREATE INDEX IF NOT EXISTS "orders_tenant_status_created_idx" ON "orders"("tenant_id", "status", "created_at");
CREATE INDEX IF NOT EXISTS "products_tenant_category_status_idx" ON "products"("tenant_id", "category", "status");
CREATE INDEX IF NOT EXISTS "inventory_items_tenant_variant_location_idx" ON "inventory_items"("tenant_id", "variant_id", "location_id");