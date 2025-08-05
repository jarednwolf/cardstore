import { PrismaClient, Product, ProductVariant, InventoryItem, InventoryLocation } from '@prisma/client';
import { cacheService } from './cacheService';
import { logger } from '../config/logger';

export interface ProductFilters {
  search?: string;
  category?: string;
  vendor?: string;
  status?: string;
  tags?: string[];
  priceMin?: number;
  priceMax?: number;
  hasInventory?: boolean;
}

export interface ProductSearchResult {
  products: ProductWithVariants[];
  total: number;
  page: number;
  limit: number;
  hasNextPage: boolean;
}

export type ProductWithVariants = Product & {
  variants: ProductVariantWithInventory[];
};

export type ProductVariantWithInventory = ProductVariant & {
  inventoryItems: (InventoryItem & {
    location: Pick<InventoryLocation, 'name'>;
  })[];
  totalInventory: {
    onHand: number;
    reserved: number;
    available: number;
  };
};

export interface RequestContext {
  userId: string;
  tenantId: string;
  userRole: string;
  correlationId: string;
}

export class PerformanceOptimizedProductService {
  constructor(private prisma: PrismaClient) {}

  /**
   * Get products with advanced caching and optimized queries
   */
  async getProductsWithCache(
    tenantId: string,
    filters: ProductFilters = {},
    page: number = 1,
    limit: number = 20
  ): Promise<ProductSearchResult> {
    const cacheKey = cacheService.generateKey(
      'products',
      tenantId,
      JSON.stringify(filters),
      page.toString(),
      limit.toString()
    );

    return await cacheService.getOrSet(
      cacheKey,
      async () => {
        const startTime = Date.now();
        
        // Build optimized where clause
        const where = this.buildProductWhereClause(tenantId, filters);
        
        // Execute optimized queries in parallel
        const [products, total] = await Promise.all([
          this.prisma.product.findMany({
            where,
            include: {
              variants: {
                include: {
                  inventoryItems: {
                    include: {
                      location: {
                        select: { name: true }
                      }
                    }
                  }
                }
              }
            },
            orderBy: { updatedAt: 'desc' },
            skip: (page - 1) * limit,
            take: limit
          }),
          this.prisma.product.count({ where })
        ]);

        // Transform and enrich data
        const enrichedProducts = products.map(product => ({
          ...product,
          variants: product.variants.map(variant => ({
            ...variant,
            inventoryItems: variant.inventoryItems,
            totalInventory: this.calculateTotalInventory(variant.inventoryItems)
          }))
        }));

        const result: ProductSearchResult = {
          products: enrichedProducts,
          total,
          page,
          limit,
          hasNextPage: page * limit < total
        };

        const duration = Date.now() - startTime;
        logger.debug('Product query executed', {
          tenantId,
          filters,
          page,
          limit,
          total,
          duration
        });

        return result;
      },
      'products'
    );
  }

  /**
   * Get single product with caching
   */
  async getProductByIdWithCache(
    productId: string,
    tenantId: string
  ): Promise<ProductWithVariants | null> {
    const cacheKey = cacheService.generateKey('product', tenantId, productId);

    return await cacheService.getOrSet(
      cacheKey,
      async () => {
        const product = await this.prisma.product.findFirst({
          where: {
            id: productId,
            tenantId
          },
          include: {
            variants: {
              include: {
                inventoryItems: {
                  include: {
                    location: {
                      select: { name: true }
                    }
                  }
                }
              }
            }
          }
        });

        if (!product) return null;

        return {
          ...product,
          variants: product.variants.map(variant => ({
            ...variant,
            inventoryItems: variant.inventoryItems,
            totalInventory: this.calculateTotalInventory(variant.inventoryItems)
          }))
        };
      },
      'products'
    );
  }

  /**
   * Batch get products with optimized queries
   */
  async batchGetProducts(
    productIds: string[],
    tenantId: string
  ): Promise<ProductWithVariants[]> {
    if (productIds.length === 0) return [];

    // Try to get from cache first
    const cacheKeys = productIds.map(id => 
      cacheService.generateKey('product', tenantId, id)
    );
    
    const cachedProducts = await cacheService.mget<ProductWithVariants>(cacheKeys);
    
    // Identify missing products
    const missingIndices: number[] = [];
    const missingIds: string[] = [];
    
    cachedProducts.forEach((product, index) => {
      if (product === null) {
        missingIndices.push(index);
        missingIds.push(productIds[index]!);
      }
    });

    // Fetch missing products
    let fetchedProducts: ProductWithVariants[] = [];
    if (missingIds.length > 0) {
      const products = await this.prisma.product.findMany({
        where: {
          id: { in: missingIds },
          tenantId
        },
        include: {
          variants: {
            include: {
              inventoryItems: {
                include: {
                  location: {
                    select: { name: true }
                  }
                }
              }
            }
          }
        }
      });

      fetchedProducts = products.map(product => ({
        ...product,
        variants: product.variants.map(variant => ({
          ...variant,
          inventoryItems: variant.inventoryItems,
          totalInventory: this.calculateTotalInventory(variant.inventoryItems)
        }))
      }));

      // Cache the fetched products
      const cacheItems = fetchedProducts.map(product => ({
        key: cacheService.generateKey('product', tenantId, product.id),
        value: product,
        ttl: 300 // 5 minutes
      }));
      
      await cacheService.mset(cacheItems);
    }

    // Merge cached and fetched results
    const result: ProductWithVariants[] = [];
    let fetchedIndex = 0;

    for (let i = 0; i < productIds.length; i++) {
      if (cachedProducts[i] !== null) {
        result.push(cachedProducts[i]!);
      } else {
        const fetchedProduct = fetchedProducts.find(p => p.id === productIds[i]);
        if (fetchedProduct) {
          result.push(fetchedProduct);
        }
      }
    }

    return result;
  }

  /**
   * Search products with full-text search and caching
   */
  async searchProductsWithCache(
    tenantId: string,
    searchQuery: string,
    filters: ProductFilters = {},
    page: number = 1,
    limit: number = 20
  ): Promise<ProductSearchResult> {
    const cacheKey = cacheService.generateKey(
      'search',
      tenantId,
      searchQuery,
      JSON.stringify(filters),
      page.toString(),
      limit.toString()
    );

    return await cacheService.getOrSet(
      cacheKey,
      async () => {
        const where = {
          ...this.buildProductWhereClause(tenantId, filters),
          OR: [
            { title: { contains: searchQuery, mode: 'insensitive' as const } },
            { description: { contains: searchQuery, mode: 'insensitive' as const } },
            { vendor: { contains: searchQuery, mode: 'insensitive' as const } },
            {
              variants: {
                some: {
                  OR: [
                    { sku: { contains: searchQuery, mode: 'insensitive' as const } },
                    { title: { contains: searchQuery, mode: 'insensitive' as const } },
                    { barcode: { equals: searchQuery } }
                  ]
                }
              }
            }
          ]
        };

        const [products, total] = await Promise.all([
          this.prisma.product.findMany({
            where,
            include: {
              variants: {
                include: {
                  inventoryItems: {
                    include: {
                      location: {
                        select: { name: true }
                      }
                    }
                  }
                }
              }
            },
            orderBy: [
              { updatedAt: 'desc' }
            ],
            skip: (page - 1) * limit,
            take: limit
          }),
          this.prisma.product.count({ where })
        ]);

        const enrichedProducts = products.map(product => ({
          ...product,
          variants: product.variants.map(variant => ({
            ...variant,
            inventoryItems: variant.inventoryItems,
            totalInventory: this.calculateTotalInventory(variant.inventoryItems)
          }))
        }));

        return {
          products: enrichedProducts,
          total,
          page,
          limit,
          hasNextPage: page * limit < total
        };
      },
      'products'
    );
  }

  /**
   * Invalidate product cache when data changes
   */
  async invalidateProductCache(tenantId: string, productId?: string): Promise<void> {
    if (productId) {
      // Invalidate specific product
      const productCacheKey = cacheService.generateKey('product', tenantId, productId);
      await cacheService.del(productCacheKey);
    }
    
    // Invalidate product list caches
    await cacheService.invalidateByTags(['products']);
    
    logger.debug('Product cache invalidated', { tenantId, productId });
  }

  /**
   * Get product performance metrics
   */
  async getProductPerformanceMetrics(tenantId: string): Promise<{
    totalProducts: number;
    activeProducts: number;
    totalVariants: number;
    averageInventoryValue: number;
    lowStockProducts: number;
  }> {
    const cacheKey = cacheService.generateKey('metrics', tenantId, 'products');

    return await cacheService.getOrSet(
      cacheKey,
      async () => {
        const [
          totalProducts,
          activeProducts,
          totalVariants,
          inventoryData,
          lowStockCount
        ] = await Promise.all([
          this.prisma.product.count({ where: { tenantId } }),
          this.prisma.product.count({ where: { tenantId, status: 'active' } }),
          this.prisma.productVariant.count({
            where: { product: { tenantId } }
          }),
          this.prisma.inventoryItem.aggregate({
            where: { tenantId },
            _avg: { onHand: true },
            _sum: { onHand: true }
          }),
          this.prisma.inventoryItem.count({
            where: {
              tenantId,
              onHand: { lte: 5 }
            }
          })
        ]);

        return {
          totalProducts,
          activeProducts,
          totalVariants,
          averageInventoryValue: inventoryData._avg.onHand || 0,
          lowStockProducts: lowStockCount
        };
      },
      'analytics'
    );
  }

  /**
   * Build optimized where clause for product queries
   */
  private buildProductWhereClause(tenantId: string, filters: ProductFilters) {
    const where: any = { tenantId };

    if (filters.category) {
      where.category = filters.category;
    }

    if (filters.vendor) {
      where.vendor = filters.vendor;
    }

    if (filters.status) {
      where.status = filters.status;
    }

    if (filters.tags && filters.tags.length > 0) {
      where.tags = {
        hasEvery: filters.tags
      };
    }

    if (filters.priceMin !== undefined || filters.priceMax !== undefined) {
      where.variants = {
        some: {
          price: {
            ...(filters.priceMin !== undefined && { gte: filters.priceMin }),
            ...(filters.priceMax !== undefined && { lte: filters.priceMax })
          }
        }
      };
    }

    if (filters.hasInventory) {
      where.variants = {
        some: {
          inventoryItems: {
            some: {
              onHand: { gt: 0 }
            }
          }
        }
      };
    }

    return where;
  }

  /**
   * Calculate total inventory across all locations
   */
  private calculateTotalInventory(inventoryItems: InventoryItem[]) {
    return inventoryItems.reduce(
      (total, item) => ({
        onHand: total.onHand + item.onHand,
        reserved: total.reserved + item.reserved,
        available: total.available + (item.onHand - item.reserved)
      }),
      { onHand: 0, reserved: 0, available: 0 }
    );
  }
}

// Export singleton instance
export const performanceOptimizedProductService = new PerformanceOptimizedProductService(
  new PrismaClient()
);