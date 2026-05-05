import { Injectable, Logger } from '@nestjs/common';
import { createClient } from 'redis';

/**
 * Centralized Redis Service for:
 * - Distributed rate limiting
 * - Caching layer
 * - Session management
 * - Socket.IO adapter
 *
 * Features:
 * - Automatic reconnection
 * - Connection pooling
 * - Key expiration
 * - Pattern-based key deletion
 * - Fallback to in-memory storage if Redis unavailable
 */
@Injectable()
export class RedisService {
  private client: any = null;
  private isConnected = false;
  private inMemoryStore = new Map<string, { value: any; expiresAt: number }>();
  private readonly logger = new Logger(RedisService.name);
  private errorMessage(error: unknown): string {
    return error instanceof Error ? error.message : String(error);
  }

  async onModuleInit() {
    await this.connect();
  }

  async onModuleDestroy() {
    await this.disconnect();
  }

  /**
   * Connect to Redis with fallback to in-memory storage
   */
  async connect(): Promise<void> {
    const redisUrl = process.env.REDIS_URL || 'redis://redis:6379';

    try {
      this.client = createClient({ url: redisUrl });

      this.client.on('error', (err: Error) => {
        this.logger.error(`Redis Error: ${err.message}`);
        this.isConnected = false;
      });

      this.client.on('connect', () => {
        this.logger.log('Redis connected successfully');
        this.isConnected = true;
      });

      await this.client.connect();
      this.isConnected = true;
      this.logger.log('Redis client initialized');
    } catch (error: unknown) {
      this.logger.warn(
        `Failed to connect to Redis at ${redisUrl}: ${this.errorMessage(error)}. Falling back to in-memory storage.`,
      );
      this.client = null;
      this.isConnected = false;
    }
  }

  /**
   * Disconnect from Redis
   */
  async disconnect(): Promise<void> {
    if (this.client && this.isConnected) {
      try {
        await this.client.quit();
        this.logger.log('Redis client disconnected');
      } catch (error: unknown) {
        this.logger.error(`Error disconnecting from Redis: ${this.errorMessage(error)}`);
      }
    }
  }

  /**
   * Get value from Redis or in-memory fallback
   */
  async get(key: string): Promise<string | null> {
    try {
      if (this.client && this.isConnected) {
        return await this.client.get(key);
      }
    } catch (error: unknown) {
      this.logger.error(`Redis GET error for key ${key}: ${this.errorMessage(error)}`);
    }

    // Fallback to in-memory
    const item = this.inMemoryStore.get(key);
    if (!item) return null;

    if (item.expiresAt && item.expiresAt < Date.now()) {
      this.inMemoryStore.delete(key);
      return null;
    }

    return item.value;
  }

  /**
   * Set value in Redis or in-memory fallback with optional expiration (seconds)
   */
  async set(
    key: string,
    value: string,
    expirationSeconds?: number,
  ): Promise<void> {
    try {
      if (this.client && this.isConnected) {
        if (expirationSeconds) {
          await this.client.setEx(key, expirationSeconds, value);
        } else {
          await this.client.set(key, value);
        }
        return;
      }
    } catch (error: unknown) {
      this.logger.error(`Redis SET error for key ${key}: ${this.errorMessage(error)}`);
    }

    // Fallback to in-memory
    const expiresAt = expirationSeconds
      ? Date.now() + expirationSeconds * 1000
      : Number.POSITIVE_INFINITY;
    this.inMemoryStore.set(key, { value, expiresAt });
  }

  /**
   * Increment counter in Redis or in-memory fallback
   */
  async incr(key: string): Promise<number> {
    try {
      if (this.client && this.isConnected) {
        return await this.client.incr(key);
      }
    } catch (error: unknown) {
      this.logger.error(`Redis INCR error for key ${key}: ${this.errorMessage(error)}`);
    }

    // Fallback to in-memory
    const item = this.inMemoryStore.get(key);
    const currentValue = item ? parseInt(item.value) : 0;
    const newValue = currentValue + 1;
    this.inMemoryStore.set(key, {
      value: newValue.toString(),
      expiresAt: item?.expiresAt || Number.POSITIVE_INFINITY,
    });
    return newValue;
  }

  /**
   * Increment counter with expiration
   */
  async incrEx(
    key: string,
    expirationSeconds: number,
  ): Promise<number> {
    try {
      if (this.client && this.isConnected) {
        const ttl = await this.client.ttl(key);
        const result = await this.client.incr(key);

        // Set expiration only if this is a new key
        if (ttl === -1) {
          await this.client.expire(key, expirationSeconds);
        }

        return result;
      }
    } catch (error: unknown) {
      this.logger.error(
        `Redis INCR with expiration error for key ${key}: ${this.errorMessage(error)}`,
      );
    }

    // Fallback to in-memory
    const item = this.inMemoryStore.get(key);
    const currentValue = item ? parseInt(item.value) : 0;
    const newValue = currentValue + 1;
    const expiresAt = Date.now() + expirationSeconds * 1000;

    this.inMemoryStore.set(key, { value: newValue.toString(), expiresAt });
    return newValue;
  }

  /**
   * Delete key from Redis or in-memory fallback
   */
  async del(key: string): Promise<number> {
    try {
      if (this.client && this.isConnected) {
        return await this.client.del(key);
      }
    } catch (error: unknown) {
      this.logger.error(`Redis DEL error for key ${key}: ${this.errorMessage(error)}`);
    }

    // Fallback to in-memory
    const exists = this.inMemoryStore.has(key);
    if (exists) {
      this.inMemoryStore.delete(key);
      return 1;
    }
    return 0;
  }

  /**
   * Delete multiple keys matching a pattern (uses SCAN in Redis)
   */
  async delPattern(pattern: string): Promise<number> {
    try {
      if (this.client && this.isConnected) {
        let cursor = '0';
        let deletedCount = 0;

        do {
          const reply = await this.client.scan(parseInt(cursor), {
            MATCH: pattern,
          });
          cursor = reply.cursor.toString();

          if (reply.keys && reply.keys.length > 0) {
            deletedCount += await this.client.del(reply.keys);
          }
        } while (cursor !== '0');

        return deletedCount;
      }
    } catch (error: unknown) {
      this.logger.error(
        `Redis SCAN/DEL pattern error for pattern ${pattern}: ${this.errorMessage(error)}`,
      );
    }

    // Fallback to in-memory
    let deletedCount = 0;
    const regex = new RegExp(
      `^${pattern.replace(/\*/g, '.*').replace(/\?/g, '.')}$`,
    );

    for (const key of this.inMemoryStore.keys()) {
      if (regex.test(key)) {
        this.inMemoryStore.delete(key);
        deletedCount++;
      }
    }

    return deletedCount;
  }

  /**
   * Set expiration on existing key
   */
  async expire(key: string, seconds: number): Promise<boolean> {
    try {
      if (this.client && this.isConnected) {
        const result = await this.client.expire(key, seconds);
        return result === 1;
      }
    } catch (error: unknown) {
      this.logger.error(
        `Redis EXPIRE error for key ${key}: ${this.errorMessage(error)}`,
      );
    }

    // Fallback to in-memory
    const item = this.inMemoryStore.get(key);
    if (item) {
      item.expiresAt = Date.now() + seconds * 1000;
      return true;
    }
    return false;
  }

  /**
   * Check if Redis is connected and healthy
   */
  async isHealthy(): Promise<boolean> {
    try {
      if (this.client && this.isConnected) {
        await this.client.ping();
        return true;
      }
    } catch (error: unknown) {
      this.logger.error(`Redis health check failed: ${this.errorMessage(error)}`);
      return false;
    }

    return false; // In-memory fallback is not considered "healthy" for critical operations
  }

  /**
   * Clear all in-memory storage (useful for testing)
   */
  clearInMemory(): void {
    this.inMemoryStore.clear();
  }

  /**
   * Get connection status
   */
  getStatus(): {
    connected: boolean;
    backend: 'redis' | 'in-memory';
    inMemorySize: number;
  } {
    return {
      connected: this.isConnected,
      backend: this.isConnected ? 'redis' : 'in-memory',
      inMemorySize: this.inMemoryStore.size,
    };
  }
}
