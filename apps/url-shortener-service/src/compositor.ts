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

async function compose({
    databaseUrl,
    redisWriteUrl,
    redisConnectTimeoutMs = undefined,
    redisMaxReconnectDelayMs = undefined,
    httpServerPort = 80,
}: {
    databaseUrl: string;
    redisWriteUrl: string;
    redisConnectTimeoutMs?: number;
    redisMaxReconnectDelayMs?: number;
    httpServerPort: number;
}) {
    const pgClient = new NodePgDrizzleClient(databaseUrl, shortUrlDbSchema);
    const dbInstance = pgClient.getDbInstance();

    const redisClient = new RedisNodeClient({
        writeUrl: redisWriteUrl,
        connectTimeoutMs: redisConnectTimeoutMs,
        maxReconnectDelayMs: redisMaxReconnectDelayMs,
    });
    await redisClient.connect();

    const httpServer = await createHttpServer(httpServerPort);

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
