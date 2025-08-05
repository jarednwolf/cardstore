import Redis, { RedisOptions } from 'ioredis';
import { logger } from '../config/logger';
import { env } from '../config/env';

export interface CacheConfig {
  ttl: number;
  tags: string[];
  keyPrefix?: string;
}

export interface CacheStrategy {
  products: CacheConfig;
  inventory: CacheConfig;
  orders: CacheConfig;
  analytics: CacheConfig;
  marketplace: CacheConfig;
}

export class CacheService {
  private redis: Redis;
  private defaultTTL = 300; // 5 minutes

  private strategies: CacheStrategy = {
    products: {
      ttl: 300, // 5 minutes
      tags: ['products', 'inventory'],
      keyPrefix: 'products'
    },
    inventory: {
      ttl: 60, // 1 minute
      tags: ['inventory'],
      keyPrefix: 'inventory'
    },
    orders: {
      ttl: 30, // 30 seconds
      tags: ['orders'],
      keyPrefix: 'orders'
    },
    analytics: {
      ttl: 3600, // 1 hour
      tags: ['analytics'],
      keyPrefix: 'analytics'
    },
    marketplace: {
      ttl: 180, // 3 minutes
      tags: ['marketplace', 'products'],
      keyPrefix: 'marketplace'
    }
  };

  constructor() {
    // Use REDIS_URL if available, otherwise construct from individual parts
    const redisUrl = env.REDIS_URL;
    
    const redisOptions: RedisOptions = {
      enableReadyCheck: false,
      maxRetriesPerRequest: null,
      lazyConnect: true
    };

    this.redis = new Redis(redisUrl, redisOptions);

    this.redis.on('error', (error) => {
      logger.error('Redis connection error:', error);
    });

    this.redis.on('connect', () => {
      logger.info('Redis connected successfully');
    });
  }

  /**
   * Get cached data with automatic JSON parsing
   */
  async get<T>(key: string): Promise<T | null> {
    try {
      const cached = await this.redis.get(key);
      if (!cached) return null;
      
      return JSON.parse(cached) as T;
    } catch (error) {
      logger.error('Cache get error:', { key, error });
      return null;
    }
  }

  /**
   * Set cached data with automatic JSON serialization
   */
  async set(
    key: string, 
    value: any, 
    ttl?: number,
    tags?: string[]
  ): Promise<void> {
    try {
      const serialized = JSON.stringify(value);
      const expiration = ttl || this.defaultTTL;
      
      await this.redis.setex(key, expiration, serialized);
      
      // Add to tag sets for cache invalidation
      if (tags) {
        const pipeline = this.redis.pipeline();
        for (const tag of tags) {
          pipeline.sadd(`tag:${tag}`, key);
          pipeline.expire(`tag:${tag}`, expiration + 60); // Tag expires slightly later
        }
        await pipeline.exec();
      }
      
      logger.debug('Cache set:', { key, ttl: expiration, tags });
    } catch (error) {
      logger.error('Cache set error:', { key, error });
    }
  }

  /**
   * Delete cached data
   */
  async del(key: string): Promise<void> {
    try {
      await this.redis.del(key);
      logger.debug('Cache deleted:', { key });
    } catch (error) {
      logger.error('Cache delete error:', { key, error });
    }
  }

  /**
   * Invalidate cache by tags
   */
  async invalidateByTags(tags: string[]): Promise<void> {
    try {
      const pipeline = this.redis.pipeline();
      
      for (const tag of tags) {
        const keys = await this.redis.smembers(`tag:${tag}`);
        if (keys.length > 0) {
          pipeline.del(...keys);
          pipeline.del(`tag:${tag}`);
        }
      }
      
      await pipeline.exec();
      logger.debug('Cache invalidated by tags:', { tags });
    } catch (error) {
      logger.error('Cache invalidation error:', { tags, error });
    }
  }

  /**
   * Get or set cached data with a fallback function
   */
  async getOrSet<T>(
    key: string,
    fallback: () => Promise<T>,
    strategy?: keyof CacheStrategy
  ): Promise<T> {
    // Try to get from cache first
    const cached = await this.get<T>(key);
    if (cached !== null) {
      return cached;
    }

    // Execute fallback function
    const data = await fallback();
    
    // Cache the result
    if (strategy && this.strategies[strategy]) {
      const config = this.strategies[strategy];
      await this.set(key, data, config.ttl, config.tags);
    } else {
      await this.set(key, data);
    }

    return data;
  }

  /**
   * Generate cache key with tenant scoping
   */
  generateKey(
    prefix: string,
    tenantId: string,
    ...parts: (string | number)[]
  ): string {
    return `${prefix}:${tenantId}:${parts.join(':')}`;
  }

  /**
   * Batch get multiple keys
   */
  async mget<T>(keys: string[]): Promise<(T | null)[]> {
    try {
      if (keys.length === 0) return [];
      
      const values = await this.redis.mget(...keys);
      return values.map(value => {
        if (!value) return null;
        try {
          return JSON.parse(value) as T;
        } catch {
          return null;
        }
      });
    } catch (error) {
      logger.error('Cache mget error:', { keys, error });
      return keys.map(() => null);
    }
  }

  /**
   * Batch set multiple key-value pairs
   */
  async mset(items: Array<{ key: string; value: any; ttl?: number }>): Promise<void> {
    try {
      const pipeline = this.redis.pipeline();
      
      for (const item of items) {
        const serialized = JSON.stringify(item.value);
        const ttl = item.ttl || this.defaultTTL;
        pipeline.setex(item.key, ttl, serialized);
      }
      
      await pipeline.exec();
      logger.debug('Cache mset completed:', { count: items.length });
    } catch (error) {
      logger.error('Cache mset error:', { error });
    }
  }

  /**
   * Get cache statistics
   */
  async getStats(): Promise<{
    memory: string;
    keys: number;
    hits: number;
    misses: number;
    hitRate: number;
  }> {
    try {
      const info = await this.redis.info('memory');
      const stats = await this.redis.info('stats');
      
      const memoryMatch = info.match(/used_memory_human:(.+)/);
      const keysMatch = await this.redis.dbsize();
      const hitsMatch = stats.match(/keyspace_hits:(\d+)/);
      const missesMatch = stats.match(/keyspace_misses:(\d+)/);
      
      const hits = hitsMatch ? parseInt(hitsMatch[1]!) : 0;
      const misses = missesMatch ? parseInt(missesMatch[1]!) : 0;
      const total = hits + misses;
      const hitRate = total > 0 ? (hits / total) * 100 : 0;
      
      return {
        memory: memoryMatch ? memoryMatch[1]!.trim() : 'unknown',
        keys: keysMatch,
        hits,
        misses,
        hitRate: Math.round(hitRate * 100) / 100
      };
    } catch (error) {
      logger.error('Cache stats error:', error);
      return {
        memory: 'unknown',
        keys: 0,
        hits: 0,
        misses: 0,
        hitRate: 0
      };
    }
  }

  /**
   * Clear all cache data (use with caution)
   */
  async flush(): Promise<void> {
    try {
      await this.redis.flushdb();
      logger.warn('Cache flushed - all data cleared');
    } catch (error) {
      logger.error('Cache flush error:', error);
    }
  }

  /**
   * Close Redis connection
   */
  async disconnect(): Promise<void> {
    try {
      await this.redis.quit();
      logger.info('Redis connection closed');
    } catch (error) {
      logger.error('Redis disconnect error:', error);
    }
  }
}

// Singleton instance
export const cacheService = new CacheService();