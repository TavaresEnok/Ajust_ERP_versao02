import { Injectable, Logger } from '@nestjs/common';
import { RedisService } from './redis.service';

/**
 * Caching Service for expensive database queries
 *
 * Provides:
 * - Generic cache get/set with type safety
 * - TTL management (default: 5 minutes for queries)
 * - Cache invalidation patterns
 * - JSON serialization for complex objects
 * - Namespace support to prevent key collisions
 */
@Injectable()
export class CacheService {
  private readonly logger = new Logger(CacheService.name);
  private readonly DEFAULT_TTL_SECONDS = 300; // 5 minutes
  private readonly NAMESPACE_PREFIX = 'cache:';

  constructor(private readonly redis: RedisService) {}

  private errorMessage(error: unknown): string {
    return error instanceof Error ? error.message : String(error);
  }

  /**
   * Get cached value
   * @param key - Cache key
   * @param namespace - Optional namespace to prevent collisions
   * @returns Cached value or null if not found
   */
  async get<T>(key: string, namespace: string = 'default'): Promise<T | null> {
    try {
      const fullKey = this.buildKey(key, namespace);
      const cachedValue = await this.redis.get(fullKey);

      if (!cachedValue) {
        return null;
      }

      return JSON.parse(cachedValue) as T;
    } catch (error) {
      this.logger.error(`Cache GET error for key ${key}: ${this.errorMessage(error)}`);
      return null;
    }
  }

  /**
   * Set cache value
   * @param key - Cache key
   * @param value - Value to cache (will be JSON serialized)
   * @param ttlSeconds - Time to live in seconds (default: 5 min)
   * @param namespace - Optional namespace
   */
  async set<T>(
    key: string,
    value: T,
    ttlSeconds: number = this.DEFAULT_TTL_SECONDS,
    namespace: string = 'default',
  ): Promise<void> {
    try {
      const fullKey = this.buildKey(key, namespace);
      const serialized = JSON.stringify(value);
      await this.redis.set(fullKey, serialized, ttlSeconds);
      this.logger.debug(
        `Cache SET: ${fullKey} (TTL: ${ttlSeconds}s)`,
      );
    } catch (error) {
      this.logger.error(`Cache SET error for key ${key}: ${this.errorMessage(error)}`);
    }
  }

  /**
   * Get or set cache (pattern: get -> if null, execute fn -> set result)
   */
  async getOrSet<T>(
    key: string,
    fn: () => Promise<T>,
    ttlSeconds: number = this.DEFAULT_TTL_SECONDS,
    namespace: string = 'default',
  ): Promise<T> {
    // Try to get from cache
    const cached = await this.get<T>(key, namespace);
    if (cached !== null) {
      return cached;
    }

    // Execute function and cache result
    const result = await fn();
    await this.set(key, result, ttlSeconds, namespace);
    return result;
  }

  /**
   * Invalidate cache by key
   */
  async invalidate(key: string, namespace: string = 'default'): Promise<void> {
    try {
      const fullKey = this.buildKey(key, namespace);
      await this.redis.del(fullKey);
      this.logger.debug(`Cache invalidated: ${fullKey}`);
    } catch (error) {
      this.logger.error(
        `Cache invalidate error for key ${key}: ${this.errorMessage(error)}`,
      );
    }
  }

  /**
   * Invalidate all keys matching a pattern
   * @param pattern - Pattern like 'user:*' or 'service-order:123:*'
   * @param namespace - Optional namespace
   */
  async invalidatePattern(
    pattern: string,
    namespace: string = 'default',
  ): Promise<number> {
    try {
      const fullPattern = this.buildKey(pattern, namespace);
      const deletedCount = await this.redis.delPattern(fullPattern);
      this.logger.debug(
        `Cache pattern invalidated: ${fullPattern} (${deletedCount} keys)`,
      );
      return deletedCount;
    } catch (error) {
      this.logger.error(
        `Cache invalidate pattern error for pattern ${pattern}: ${this.errorMessage(error)}`,
      );
      return 0;
    }
  }

  /**
   * Cache for entity lists with key patterns
   * Example: cacheList('users', userId, async () => ...)
   */
  async getOrSetList<T>(
    entityType: string,
    entityId: string,
    fn: () => Promise<T[]>,
    ttlSeconds: number = this.DEFAULT_TTL_SECONDS,
    namespace: string = 'list',
  ): Promise<T[]> {
    const key = `${entityType}:${entityId}:items`;
    return this.getOrSet(key, fn, ttlSeconds, namespace);
  }

  /**
   * Invalidate entity cache when item is updated
   * Invalidates both the specific item cache and list cache
   */
  async invalidateEntity(
    entityType: string,
    entityId: string,
    relatedEntities?: string[], // e.g., ['user:123', 'tenant:456']
  ): Promise<void> {
    // Invalidate specific entity
    await this.invalidate(entityType, entityId);

    // Invalidate related lists
    if (relatedEntities) {
      for (const related of relatedEntities) {
        const pattern = `${related}:*`;
        await this.invalidatePattern(pattern, 'list');
      }
    }
  }

  /**
   * Get cache statistics for monitoring
   */
  async getStats(): Promise<{
    backend: 'redis' | 'in-memory';
    size: number;
    connected: boolean;
  }> {
    const status = this.redis.getStatus();
    return {
      backend: status.backend,
      size: status.inMemorySize,
      connected: status.connected,
    };
  }

  /**
   * Utility: Build full cache key with namespace
   */
  private buildKey(key: string, namespace: string): string {
    return `${this.NAMESPACE_PREFIX}${namespace}:${key}`;
  }
}
