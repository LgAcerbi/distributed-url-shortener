import type { CounterRepository } from './application/ports/counter.repository';

import { NodePgDrizzleClient } from '@workspace/drizzle-node-pg';
import { RedisNodeClient } from '@workspace/redis-node';
import {
    createHttpServer,
    shortUrlDbSchema,
    HttpShortUrlController,
    PostgresShortUrlRepository,
    RedisCounterRepository,
} from './adapters';
import { GenerateShortUrlUseCase } from './application';

const {
    DATABASE_URL,
    PORT = 80,
    REDIS_WRITE_URL,
    REDIS_READ_URL,
    REDIS_CONNECT_TIMEOUT_MS,
    REDIS_MAX_RECONNECT_DELAY_MS,
} = process.env;

async function compose() {
    const pgClient = new NodePgDrizzleClient(DATABASE_URL ?? '', shortUrlDbSchema);
    const dbInstance = pgClient.getDbInstance();

    const redisClient = new RedisNodeClient({
        writeUrl: REDIS_WRITE_URL ?? '',
        readUrl: REDIS_READ_URL,
        connectTimeoutMs: REDIS_CONNECT_TIMEOUT_MS
            ? Number(REDIS_CONNECT_TIMEOUT_MS)
            : undefined,
        maxReconnectDelayMs: REDIS_MAX_RECONNECT_DELAY_MS
            ? Number(REDIS_MAX_RECONNECT_DELAY_MS)
            : undefined,
    });
    await redisClient.connect();

    const httpServer = await createHttpServer(Number(PORT));

    const shortUrlRepository = new PostgresShortUrlRepository(dbInstance);
    const counterRepository: CounterRepository = new RedisCounterRepository(
        redisClient.getWriteClient(),
    );

    const generateShortUrlUseCase = new GenerateShortUrlUseCase(
        shortUrlRepository,
        counterRepository,
    );

    const httpShortUrlController = new HttpShortUrlController(
        httpServer,
        generateShortUrlUseCase,
    );

    await httpShortUrlController.addRoutes();

    return httpServer;
}

export { compose };
