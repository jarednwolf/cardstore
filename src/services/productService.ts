import { PrismaClient } from '@prisma/client';
import { logger } from '../config/logger';
import { 
  Product, 
  ProductVariant, 
  CreateProductRequest, 
  UpdateProductRequest,
  CreateVariantRequest,
  UpdateVariantRequest,
  ProductSearchQuery,
  ProductSearchResult,
  TCGAttributes,
  BulkUpdateResult
} from '../types';

export class ProductService {
  private prisma: PrismaClient;

  constructor(prisma: PrismaClient) {
    this.prisma = prisma;
  }

  // =============================================================================
  // PRODUCT OPERATIONS
  // =============================================================================

  async createProduct(tenantId: string, data: CreateProductRequest): Promise<Product> {
    try {
      const product = await this.prisma.product.create({
        data: {
          tenantId,
          shopifyProductId: data.shopifyProductId,
          title: data.title,
          description: data.description,
          vendor: data.vendor,
          productType: data.productType,
          category: data.category,
          tags: JSON.stringify(data.tags || []),
          status: 'active',
        },
        include: {
          variants: true,
        },
      });

      // Create variants if provided
      if (data.variants && data.variants.length > 0) {
        for (const variantData of data.variants) {
          await this.createVariant(tenantId, product.id, variantData);
        }
      }

      const result = this.transformProduct(product);
      logger.info('Product created', { productId: product.id, tenantId });
      return result;
    } catch (error) {
      logger.error('Failed to create product', { error, tenantId, data });
      throw error;
    }
  }

  async updateProduct(tenantId: string, productId: string, data: UpdateProductRequest): Promise<Product> {
    try {
      const product = await this.prisma.product.update({
        where: { id: productId, tenantId },
        data: {
          title: data.title,
          description: data.description,
          vendor: data.vendor,
          productType: data.productType,
          category: data.category,
          tags: data.tags ? JSON.stringify(data.tags) : undefined,
          status: data.status,
        },
        include: {
          variants: true,
        },
      });

      const result = this.transformProduct(product);
      logger.info('Product updated', { productId, tenantId });
      return result;
    } catch (error) {
      logger.error('Failed to update product', { error, productId, tenantId });
      throw error;
    }
  }

  async getProduct(tenantId: string, productId: string): Promise<Product | null> {
    try {
      const product = await this.prisma.product.findFirst({
        where: { id: productId, tenantId },
        include: {
          variants: {
            include: {
              inventoryItems: {
                include: {
                  location: true,
                },
              },
              channelPrices: true,
            },
          },
        },
      });

      return product ? this.transformProduct(product) : null;
    } catch (error) {
      logger.error('Failed to get product', { error, productId, tenantId });
      throw error;
    }
  }

  async searchProducts(tenantId: string, query: ProductSearchQuery): Promise<ProductSearchResult> {
    try {
      const where: any = { tenantId };

      // Text search
      if (query.query) {
        where.OR = [
          { title: { contains: query.query, mode: 'insensitive' } },
          { description: { contains: query.query, mode: 'insensitive' } },
          { vendor: { contains: query.query, mode: 'insensitive' } },
        ];
      }

      // Filters
      if (query.category) where.category = query.category;
      if (query.vendor) where.vendor = query.vendor;
      if (query.status) where.status = query.status;

      const limit = Math.min(query.limit || 50, 100);
      const products = await this.prisma.product.findMany({
        where,
        include: {
          variants: {
            include: {
              inventoryItems: true,
              channelPrices: true,
            },
          },
        },
        take: limit + 1, // Take one extra to check if there are more
        orderBy: { createdAt: 'desc' },
      });

      const hasNextPage = products.length > limit;
      const items = hasNextPage ? products.slice(0, -1) : products;

      return {
        products: items.map(p => this.transformProduct(p)),
        pagination: {
          hasNextPage,
          hasPreviousPage: false, // Simplified for now
          totalCount: items.length,
        },
      };
    } catch (error) {
      logger.error('Failed to search products', { error, tenantId, query });
      throw error;
    }
  }

  async deleteProduct(tenantId: string, productId: string): Promise<void> {
    try {
      await this.prisma.product.delete({
        where: { id: productId, tenantId },
      });

      logger.info('Product deleted', { productId, tenantId });
    } catch (error) {
      logger.error('Failed to delete product', { error, productId, tenantId });
      throw error;
    }
  }

  // =============================================================================
  // VARIANT OPERATIONS
  // =============================================================================

  async createVariant(tenantId: string, productId: string, data: CreateVariantRequest): Promise<ProductVariant> {
    try {
      const variant = await this.prisma.productVariant.create({
        data: {
          tenantId,
          productId,
          sku: data.sku,
          barcode: data.barcode,
          title: data.title,
          price: data.price,
          compareAtPrice: data.compareAtPrice,
          weight: data.weight,
          weightUnit: data.weightUnit || 'g',
          requiresShipping: data.requiresShipping ?? true,
          taxable: data.taxable ?? true,
          tcgAttributes: JSON.stringify(data.tcgAttributes || {}),
        },
        include: {
          product: true,
          inventoryItems: {
            include: {
              location: true,
            },
          },
          channelPrices: true,
        },
      });

      const result = this.transformVariant(variant);
      logger.info('Variant created', { variantId: variant.id, productId, tenantId });
      return result;
    } catch (error) {
      logger.error('Failed to create variant', { error, productId, tenantId, data });
      throw error;
    }
  }

  async updateVariant(tenantId: string, variantId: string, data: UpdateVariantRequest): Promise<ProductVariant> {
    try {
      const variant = await this.prisma.productVariant.update({
        where: { id: variantId, tenantId },
        data: {
          sku: data.sku,
          barcode: data.barcode,
          title: data.title,
          price: data.price,
          compareAtPrice: data.compareAtPrice,
          weight: data.weight,
          weightUnit: data.weightUnit,
          requiresShipping: data.requiresShipping,
          taxable: data.taxable,
          tcgAttributes: data.tcgAttributes ? JSON.stringify(data.tcgAttributes) : undefined,
        },
        include: {
          product: true,
          inventoryItems: {
            include: {
              location: true,
            },
          },
          channelPrices: true,
        },
      });

      const result = this.transformVariant(variant);
      logger.info('Variant updated', { variantId, tenantId });
      return result;
    } catch (error) {
      logger.error('Failed to update variant', { error, variantId, tenantId });
      throw error;
    }
  }

  async getVariant(tenantId: string, variantId: string): Promise<ProductVariant | null> {
    try {
      const variant = await this.prisma.productVariant.findFirst({
        where: { id: variantId, tenantId },
        include: {
          product: true,
          inventoryItems: {
            include: {
              location: true,
            },
          },
          channelPrices: true,
        },
      });

      return variant ? this.transformVariant(variant) : null;
    } catch (error) {
      logger.error('Failed to get variant', { error, variantId, tenantId });
      throw error;
    }
  }

  async searchVariantsByTCGAttributes(tenantId: string, tcgQuery: Partial<TCGAttributes>): Promise<ProductVariant[]> {
    try {
      // For SQLite, we'll do a simple text search in the JSON field
      // In production with PostgreSQL, this would use proper JSONB queries
      const variants = await this.prisma.productVariant.findMany({
        where: {
          tenantId,
          // This is a simplified search - in production we'd use proper JSON queries
        },
        include: {
          product: true,
          inventoryItems: {
            include: {
              location: true,
            },
          },
          channelPrices: true,
        },
      });

      // Filter by TCG attributes in memory (for SQLite compatibility)
      const filtered = variants.filter(variant => {
        try {
          const attrs = JSON.parse(variant.tcgAttributes) as TCGAttributes;
          
          if (tcgQuery.set && attrs.set !== tcgQuery.set) return false;
          if (tcgQuery.rarity && attrs.rarity !== tcgQuery.rarity) return false;
          if (tcgQuery.condition && attrs.condition !== tcgQuery.condition) return false;
          if (tcgQuery.foil !== undefined && attrs.foil !== tcgQuery.foil) return false;
          if (tcgQuery.language && attrs.language !== tcgQuery.language) return false;
          
          return true;
        } catch {
          return false;
        }
      });

      return filtered.map(v => this.transformVariant(v));
    } catch (error) {
      logger.error('Failed to search variants by TCG attributes', { error, tenantId, tcgQuery });
      throw error;
    }
  }

  async updateTCGAttributes(tenantId: string, variantId: string, tcgAttributes: TCGAttributes): Promise<ProductVariant> {
    try {
      const variant = await this.prisma.productVariant.update({
        where: { id: variantId, tenantId },
        data: {
          tcgAttributes: JSON.stringify(tcgAttributes),
        },
        include: {
          product: true,
          inventoryItems: {
            include: {
              location: true,
            },
          },
          channelPrices: true,
        },
      });

      const result = this.transformVariant(variant);
      logger.info('TCG attributes updated', { variantId, tenantId });
      return result;
    } catch (error) {
      logger.error('Failed to update TCG attributes', { error, variantId, tenantId });
      throw error;
    }
  }

  // =============================================================================
  // BULK OPERATIONS
  // =============================================================================

  async bulkUpdateProducts(tenantId: string, updates: Array<{ id: string; data: UpdateProductRequest }>): Promise<BulkUpdateResult> {
    const results: BulkUpdateResult = {
      success: 0,
      failed: 0,
      errors: [],
    };

    for (let i = 0; i < updates.length; i++) {
      try {
        await this.updateProduct(tenantId, updates[i].id, updates[i].data);
        results.success++;
      } catch (error) {
        results.failed++;
        results.errors.push({
          row: i + 1,
          message: error instanceof Error ? error.message : 'Unknown error',
          data: updates[i],
        });
      }
    }

    logger.info('Bulk product update completed', { tenantId, results });
    return results;
  }

  async bulkUpdateVariants(tenantId: string, updates: Array<{ id: string; data: UpdateVariantRequest }>): Promise<BulkUpdateResult> {
    const results: BulkUpdateResult = {
      success: 0,
      failed: 0,
      errors: [],
    };

    for (let i = 0; i < updates.length; i++) {
      try {
        await this.updateVariant(tenantId, updates[i].id, updates[i].data);
        results.success++;
      } catch (error) {
        results.failed++;
        results.errors.push({
          row: i + 1,
          message: error instanceof Error ? error.message : 'Unknown error',
          data: updates[i],
        });
      }
    }

    logger.info('Bulk variant update completed', { tenantId, results });
    return results;
  }

  // =============================================================================
  // SHOPIFY INTEGRATION
  // =============================================================================

  async syncFromShopify(tenantId: string, shopifyProductId: string, shopifyData: any): Promise<Product> {
    try {
      // Check if product already exists
      let product = await this.prisma.product.findFirst({
        where: { tenantId, shopifyProductId },
        include: { variants: true },
      });

      if (product) {
        // Update existing product
        product = await this.prisma.product.update({
          where: { id: product.id },
          data: {
            title: shopifyData.title,
            description: shopifyData.body_html,
            vendor: shopifyData.vendor,
            productType: shopifyData.product_type,
            tags: JSON.stringify(shopifyData.tags?.split(',').map((t: string) => t.trim()) || []),
            status: shopifyData.status,
          },
          include: { variants: true },
        });
      } else {
        // Create new product
        product = await this.prisma.product.create({
          data: {
            tenantId,
            shopifyProductId,
            title: shopifyData.title,
            description: shopifyData.body_html,
            vendor: shopifyData.vendor,
            productType: shopifyData.product_type,
            tags: JSON.stringify(shopifyData.tags?.split(',').map((t: string) => t.trim()) || []),
            status: shopifyData.status,
          },
          include: { variants: true },
        });
      }

      // Sync variants
      if (shopifyData.variants) {
        for (const shopifyVariant of shopifyData.variants) {
          await this.syncVariantFromShopify(tenantId, product.id, shopifyVariant);
        }
      }

      const result = this.transformProduct(product);
      logger.info('Product synced from Shopify', { productId: product.id, shopifyProductId, tenantId });
      return result;
    } catch (error) {
      logger.error('Failed to sync product from Shopify', { error, shopifyProductId, tenantId });
      throw error;
    }
  }

  async syncVariantFromShopify(tenantId: string, productId: string, shopifyVariant: any): Promise<ProductVariant> {
    try {
      // Check if variant already exists
      let variant = await this.prisma.productVariant.findFirst({
        where: { tenantId, shopifyVariantId: shopifyVariant.id.toString() },
        include: {
          product: true,
          inventoryItems: { include: { location: true } },
          channelPrices: true,
        },
      });

      if (variant) {
        // Update existing variant
        variant = await this.prisma.productVariant.update({
          where: { id: variant.id },
          data: {
            sku: shopifyVariant.sku,
            barcode: shopifyVariant.barcode,
            title: shopifyVariant.title,
            price: parseFloat(shopifyVariant.price),
            compareAtPrice: shopifyVariant.compare_at_price ? parseFloat(shopifyVariant.compare_at_price) : null,
            weight: shopifyVariant.weight ? parseFloat(shopifyVariant.weight) : null,
            weightUnit: shopifyVariant.weight_unit || 'g',
            requiresShipping: shopifyVariant.requires_shipping,
            taxable: shopifyVariant.taxable,
          },
          include: {
            product: true,
            inventoryItems: { include: { location: true } },
            channelPrices: true,
          },
        });
      } else {
        // Create new variant
        variant = await this.prisma.productVariant.create({
          data: {
            tenantId,
            productId,
            shopifyVariantId: shopifyVariant.id.toString(),
            sku: shopifyVariant.sku,
            barcode: shopifyVariant.barcode,
            title: shopifyVariant.title,
            price: parseFloat(shopifyVariant.price),
            compareAtPrice: shopifyVariant.compare_at_price ? parseFloat(shopifyVariant.compare_at_price) : null,
            weight: shopifyVariant.weight ? parseFloat(shopifyVariant.weight) : null,
            weightUnit: shopifyVariant.weight_unit || 'g',
            requiresShipping: shopifyVariant.requires_shipping,
            taxable: shopifyVariant.taxable,
            tcgAttributes: '{}', // Empty TCG attributes initially
          },
          include: {
            product: true,
            inventoryItems: { include: { location: true } },
            channelPrices: true,
          },
        });
      }

      const result = this.transformVariant(variant);
      logger.info('Variant synced from Shopify', { variantId: variant.id, shopifyVariantId: shopifyVariant.id, tenantId });
      return result;
    } catch (error) {
      logger.error('Failed to sync variant from Shopify', { error, shopifyVariant, tenantId });
      throw error;
    }
  }

  // =============================================================================
  // HELPER METHODS
  // =============================================================================

  private transformProduct(product: any): Product {
    return {
      id: product.id,
      tenantId: product.tenantId,
      shopifyProductId: product.shopifyProductId,
      title: product.title,
      description: product.description,
      vendor: product.vendor,
      productType: product.productType,
      category: product.category,
      tags: product.tags ? JSON.parse(product.tags) : [],
      status: product.status,
      createdAt: product.createdAt,
      updatedAt: product.updatedAt,
      variants: product.variants?.map((v: any) => this.transformVariant(v)),
    };
  }

  private transformVariant(variant: any): ProductVariant {
    const result: ProductVariant = {
      id: variant.id,
      tenantId: variant.tenantId,
      productId: variant.productId,
      shopifyVariantId: variant.shopifyVariantId,
      sku: variant.sku,
      barcode: variant.barcode,
      title: variant.title,
      price: variant.price,
      compareAtPrice: variant.compareAtPrice,
      weight: variant.weight,
      weightUnit: variant.weightUnit,
      requiresShipping: variant.requiresShipping,
      taxable: variant.taxable,
      tcgAttributes: variant.tcgAttributes ? JSON.parse(variant.tcgAttributes) : {},
      createdAt: variant.createdAt,
      updatedAt: variant.updatedAt,
    };

    if (variant.product) {
      result.product = this.transformProduct(variant.product);
    }

    if (variant.inventoryItems) {
      result.inventoryItems = variant.inventoryItems.map((item: any) => ({
        id: item.id,
        tenantId: item.tenantId,
        variantId: item.variantId,
        locationId: item.locationId,
        onHand: item.onHand,
        reserved: item.reserved,
        available: item.onHand - item.reserved,
        safetyStock: item.safetyStock,
        channelBuffers: item.channelBuffers ? JSON.parse(item.channelBuffers) : {},
        lastCountedAt: item.lastCountedAt,
        updatedAt: item.updatedAt,
        location: item.location,
      }));
    }

    if (variant.channelPrices) {
      result.channelPrices = variant.channelPrices;
    }

    return result;
  }
}