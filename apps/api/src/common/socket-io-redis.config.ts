import { Logger } from '@nestjs/common';
import { Server as SocketIoServer } from 'socket.io';
import { createAdapter } from '@socket.io/redis-adapter';
import { createClient, RedisClientType } from 'redis';

/**
 * Socket.IO Redis Adapter Configuration
 *
 * Allows Socket.IO to work properly in distributed/clustered environments
 * by using Redis to sync events and rooms across multiple servers
 *
 * Enables:
 * - Broadcasting across multiple API instances
 * - Room management across instances
 * - Proper socket deduplication
 * - Session sharing via Redis
 *
 * Usage in main.ts:
 * const io = new SocketIoServer(httpServer, {
 *   cors: { origin: process.env.FRONTEND_URL },
 * });
 * await configureSocketIORedisAdapter(io);
 */
export async function configureSocketIORedisAdapter(
  io: SocketIoServer,
): Promise<void> {
  const logger = new Logger('SocketIORedisAdapter');
  const errorMessage = (error: unknown) => (error instanceof Error ? error.message : String(error));

  const redisUrl = process.env.REDIS_URL || 'redis://redis:6379';

  try {
    // Create pub/sub clients for Socket.IO
    const pubClient = createClient({ url: redisUrl });
    const subClient = pubClient.duplicate();

    pubClient.on('error', (err: Error) => {
      logger.error(`Redis pub error: ${err.message}`);
    });

    subClient.on('error', (err: Error) => {
      logger.error(`Redis sub error: ${err.message}`);
    });

    // Connect both clients
    await Promise.all([pubClient.connect(), subClient.connect()]);

    // Configure Socket.IO to use Redis adapter
    io.adapter(createAdapter(pubClient, subClient));

    logger.log('Socket.IO Redis adapter configured successfully');

    // Handle disconnection
    io.on('error', (error) => {
      logger.error(`Socket.IO error: ${error.message}`);
    });

    // Log when adapter is ready
    io.on('connection', (socket) => {
      logger.debug(`Socket connected: ${socket.id}`);

      socket.on('disconnect', () => {
        logger.debug(`Socket disconnected: ${socket.id}`);
      });
    });
  } catch (error: unknown) {
    logger.error(
      `Failed to configure Socket.IO Redis adapter: ${errorMessage(error)}. Falling back to in-memory adapter.`,
    );
    // In-memory adapter will be used as fallback
  }
}

/**
 * Configuration example for main.ts:
 *
 * import { configureSocketIORedisAdapter } from './common/socket-io-redis.config';
 *
 * async function bootstrap() {
 *   const app = await NestFactory.create(AppModule);
 *
 *   // Create HTTP server for Socket.IO
 *   const server = app.getHttpServer();
 *   const io = new SocketIoServer(server, {
 *     cors: {
 *       origin: process.env.FRONTEND_URL || 'http://localhost:3000',
 *       credentials: true,
 *     },
 *     transports: ['websocket', 'polling'],
 *   });
 *
 *   // Configure Redis adapter for distributed setup
 *   await configureSocketIORedisAdapter(io);
 *
 *   // Rest of bootstrap code...
 * }
 *
 * This ensures that:
 * - All API instances share the same Socket.IO state via Redis
 * - Broadcasting works across multiple server instances
 * - Room membership is consistent across instances
 * - No duplicate event processing
 */
