import { NodePgDrizzleClient } from '@workspace/drizzle-node-pg';
import { RedisNodeClient } from '@workspace/redis-node';
import {
    createHttpServer,
    shortUrlDbSchema,
    HttpShortUrlController,
    PostgresShortUrlRepository,
    RedisCounterRepository,
    RedisShortUrlCacheRepository,
} from './adapters';
import { GenerateShortUrlUseCase, GetUrlByCodeUseCase } from './application';

async function compose({
    databaseUrl,
    redisWriteUrl,
    redisReadUrl,
    redisConnectTimeoutMs = undefined,
    redisMaxReconnectDelayMs = undefined,
    httpServerPort = 80,
}: {
    databaseUrl: string;
    redisWriteUrl: string;
    redisReadUrl: string;
    redisConnectTimeoutMs?: number;
    redisMaxReconnectDelayMs?: number;
    httpServerPort: number;
}) {
    const pgClient = new NodePgDrizzleClient(databaseUrl, shortUrlDbSchema);
    const dbInstance = pgClient.getDbInstance();

    const redisClient = new RedisNodeClient({
        readUrl: redisReadUrl,
        writeUrl: redisWriteUrl,
        connectTimeoutMs: redisConnectTimeoutMs,
        maxReconnectDelayMs: redisMaxReconnectDelayMs,
    });
    await redisClient.connect();
    const redisReadClient = redisClient.getReadClient();
    const redisWriteClient = redisClient.getWriteClient();

    const httpServer = await createHttpServer(httpServerPort);

    const shortUrlRepository = new PostgresShortUrlRepository(dbInstance);
    const shortUrlCacheRepository = new RedisShortUrlCacheRepository(redisReadClient);
    const counterRepository = new RedisCounterRepository(redisWriteClient);

    const generateShortUrlUseCase = new GenerateShortUrlUseCase(
        shortUrlRepository,
        counterRepository,
    );

    const getUrlByCodeUseCase = new GetUrlByCodeUseCase(
        shortUrlRepository,
        shortUrlCacheRepository,
    );

    const httpShortUrlController = new HttpShortUrlController(
        httpServer,
        generateShortUrlUseCase,
        getUrlByCodeUseCase,
    );

    await httpShortUrlController.addRoutes();

    return httpServer;
}

export { compose };
