import { NodePgDrizzleClient } from '@workspace/drizzle-node-pg';
import { KafkaNodeClient } from '@workspace/kafka-node';
import { RedisNodeClient } from '@workspace/redis-node';
import {
    createHttpServer,
    shortUrlDbSchema,
    HttpShortUrlController,
    PostgresShortUrlRepository,
    RedisShortUrlCacheRepository,
    ZookeeperCounterRepository,
    createZookeeperClient,
    KafkaClickEventPublisher,
} from './adapters';
import {
    GenerateShortUrlUseCase,
    GetUrlByCodeUseCase,
    PublishShortUrlClickUseCase,
} from './application';

async function compose({
    httpServerPort,
    databaseUrl,
    redisWriteUrl,
    redisReadUrl,
    zookeeperUrl,
    kafkaBrokers,
    zookeeperSessionTimeoutMs = undefined,
    redisConnectTimeoutMs = undefined,
    redisMaxReconnectDelayMs = undefined,
}: {
    httpServerPort: number;
    databaseUrl: string;
    redisWriteUrl: string;
    redisReadUrl: string;
    zookeeperUrl: string;
    kafkaBrokers: string[];
    zookeeperSessionTimeoutMs?: number;
    redisConnectTimeoutMs?: number;
    redisMaxReconnectDelayMs?: number;
}) {
    const pgClient = new NodePgDrizzleClient(databaseUrl, shortUrlDbSchema);
    const dbInstance = pgClient.getDbInstance();

    const redisClient = new RedisNodeClient({
        readUrl: redisReadUrl,
        writeUrl: redisWriteUrl ?? redisReadUrl,
        connectTimeoutMs: redisConnectTimeoutMs,
        maxReconnectDelayMs: redisMaxReconnectDelayMs,
    });
    await redisClient.connect();
    const redisReadClient = redisClient.getReadClient();
    const redisWriteClient = redisClient.getWriteClient();

    const httpServer = await createHttpServer(httpServerPort);
    const kafkaNodeClient = new KafkaNodeClient({
        clientId: 'url-shortener-service',
        brokers: kafkaBrokers,
    });
    const clickEventProducer = kafkaNodeClient.getProducer();
    await clickEventProducer.connect();

    const shortUrlRepository = new PostgresShortUrlRepository(dbInstance);
    const shortUrlCacheRepository = new RedisShortUrlCacheRepository(
        redisReadClient,
        redisWriteClient,
    );
    const zookeeperClient = await createZookeeperClient({
        connectionString: zookeeperUrl,
        sessionTimeout: zookeeperSessionTimeoutMs,
    });
    const counterRepository = new ZookeeperCounterRepository(zookeeperClient);
    const clickEventPublisher = new KafkaClickEventPublisher(clickEventProducer);

    const generateShortUrlUseCase = new GenerateShortUrlUseCase(
        shortUrlRepository,
        counterRepository,
        shortUrlCacheRepository,
    );

    const publishShortUrlClickUseCase = new PublishShortUrlClickUseCase(clickEventPublisher);

    const getUrlByCodeUseCase = new GetUrlByCodeUseCase(
        shortUrlRepository,
        shortUrlCacheRepository,
        publishShortUrlClickUseCase,
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
