-- Phase 3 Schema Updates: Add missing tables for advanced inventory management

-- Add Inventory Reservations table
CREATE TABLE "inventory_reservations" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenant_id" TEXT NOT NULL,
    "variant_id" TEXT NOT NULL,
    "location_id" TEXT NOT NULL,
    "order_id" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'active',
    "expires_at" DATETIME NOT NULL,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by" TEXT NOT NULL,
    CONSTRAINT "inventory_reservations_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "inventory_reservations_variant_id_fkey" FOREIGN KEY ("variant_id") REFERENCES "product_variants" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "inventory_reservations_location_id_fkey" FOREIGN KEY ("location_id") REFERENCES "inventory_locations" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "inventory_reservations_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "inventory_reservations_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- Add Inventory Transfers table
CREATE TABLE "inventory_transfers" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenant_id" TEXT NOT NULL,
    "variant_id" TEXT NOT NULL,
    "from_location_id" TEXT NOT NULL,
    "to_location_id" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "reason" TEXT NOT NULL,
    "reference" TEXT,
    "notes" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completed_at" DATETIME,
    "created_by" TEXT NOT NULL,
    "completed_by" TEXT,
    CONSTRAINT "inventory_transfers_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "inventory_transfers_variant_id_fkey" FOREIGN KEY ("variant_id") REFERENCES "product_variants" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "inventory_transfers_from_location_id_fkey" FOREIGN KEY ("from_location_id") REFERENCES "inventory_locations" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "inventory_transfers_to_location_id_fkey" FOREIGN KEY ("to_location_id") REFERENCES "inventory_locations" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "inventory_transfers_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "inventory_transfers_completed_by_fkey" FOREIGN KEY ("completed_by") REFERENCES "users" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- Add Shopify Inventory Sync table
CREATE TABLE "shopify_inventory_syncs" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenant_id" TEXT NOT NULL,
    "variant_id" TEXT NOT NULL,
    "shopify_variant_id" TEXT NOT NULL,
    "location_id" TEXT NOT NULL,
    "shopify_location_id" TEXT NOT NULL,
    "sync_type" TEXT NOT NULL,
    "previous_quantity" INTEGER NOT NULL,
    "new_quantity" INTEGER NOT NULL,
    "status" TEXT NOT NULL,
    "error_message" TEXT,
    "retry_count" INTEGER NOT NULL DEFAULT 0,
    "synced_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "shopify_inventory_syncs_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "shopify_inventory_syncs_variant_id_fkey" FOREIGN KEY ("variant_id") REFERENCES "product_variants" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "shopify_inventory_syncs_location_id_fkey" FOREIGN KEY ("location_id") REFERENCES "inventory_locations" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- Create indexes for inventory_reservations
CREATE INDEX "inventory_reservations_tenant_id_idx" ON "inventory_reservations"("tenant_id");
CREATE INDEX "inventory_reservations_expires_at_status_idx" ON "inventory_reservations"("expires_at", "status");
CREATE INDEX "inventory_reservations_order_id_idx" ON "inventory_reservations"("order_id");
CREATE INDEX "inventory_reservations_variant_id_location_id_idx" ON "inventory_reservations"("variant_id", "location_id");

-- Create indexes for inventory_transfers
CREATE INDEX "inventory_transfers_tenant_id_idx" ON "inventory_transfers"("tenant_id");
CREATE INDEX "inventory_transfers_status_idx" ON "inventory_transfers"("status");
CREATE INDEX "inventory_transfers_created_at_idx" ON "inventory_transfers"("created_at");
CREATE INDEX "inventory_transfers_variant_id_idx" ON "inventory_transfers"("variant_id");

-- Create indexes for shopify_inventory_syncs
CREATE INDEX "shopify_inventory_syncs_tenant_id_idx" ON "shopify_inventory_syncs"("tenant_id");
CREATE INDEX "shopify_inventory_syncs_synced_at_idx" ON "shopify_inventory_syncs"("synced_at");
CREATE INDEX "shopify_inventory_syncs_status_idx" ON "shopify_inventory_syncs"("status");
CREATE INDEX "shopify_inventory_syncs_variant_id_location_id_idx" ON "shopify_inventory_syncs"("variant_id", "location_id");