/*
  Warnings:

  - You are about to drop the column `sync_type` on the `shopify_inventory_syncs` table. All the data in the column will be lost.
  - Added the required column `syncType` to the `shopify_inventory_syncs` table without a default value. This is not possible if the table is not empty.

*/
-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_shopify_inventory_syncs" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenant_id" TEXT NOT NULL,
    "variant_id" TEXT NOT NULL,
    "shopify_variant_id" TEXT NOT NULL,
    "location_id" TEXT NOT NULL,
    "shopify_location_id" TEXT NOT NULL,
    "syncType" TEXT NOT NULL,
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
INSERT INTO "new_shopify_inventory_syncs" ("error_message", "id", "location_id", "new_quantity", "previous_quantity", "retry_count", "shopify_location_id", "shopify_variant_id", "status", "synced_at", "tenant_id", "variant_id") SELECT "error_message", "id", "location_id", "new_quantity", "previous_quantity", "retry_count", "shopify_location_id", "shopify_variant_id", "status", "synced_at", "tenant_id", "variant_id" FROM "shopify_inventory_syncs";
DROP TABLE "shopify_inventory_syncs";
ALTER TABLE "new_shopify_inventory_syncs" RENAME TO "shopify_inventory_syncs";
CREATE INDEX "shopify_inventory_syncs_tenant_id_idx" ON "shopify_inventory_syncs"("tenant_id");
CREATE INDEX "shopify_inventory_syncs_synced_at_idx" ON "shopify_inventory_syncs"("synced_at");
CREATE INDEX "shopify_inventory_syncs_status_idx" ON "shopify_inventory_syncs"("status");
CREATE INDEX "shopify_inventory_syncs_variant_id_location_id_idx" ON "shopify_inventory_syncs"("variant_id", "location_id");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
