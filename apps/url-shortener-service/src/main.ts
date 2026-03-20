import "dotenv/config"
import { logger } from "@workspace/logger"
import { compose } from "./compositor"

async function main() {
    const {
        DATABASE_URL,
        REDIS_WRITE_URL,
        REDIS_READ_URL,
        ZOOKEEPER_URL,
        KAFKA_BROKERS,
        ZOOKEEPER_COUNTER_RANGE_SIZE,
        ZOOKEEPER_COUNTER_PREFETCH_PERCENT,
        ZOOKEEPER_COUNTER_LEASE_MAX_RETRIES,
        ZOOKEEPER_COUNTER_LEASE_BACKOFF_MS,
        REDIS_CONNECT_TIMEOUT_MS,
        REDIS_MAX_RECONNECT_DELAY_MS,
        ZOOKEEPER_SESSION_TIMEOUT_MS,
        HOST = "0.0.0.0",
        PORT = 80,
    } = process.env

    if (!DATABASE_URL) {
        throw new Error("DATABASE_URL is required")
    }
    
    if (!REDIS_WRITE_URL) {
        throw new Error("REDIS_WRITE_URL is required")
    }

    if (!REDIS_READ_URL) {
        throw new Error("REDIS_READ_URL is required")
    }

    if (!ZOOKEEPER_URL) {
        throw new Error("ZOOKEEPER_URL is required")
    }
    
    if (!KAFKA_BROKERS) {
        throw new Error("KAFKA_BROKERS is required")
    }

    const rangeSize = ZOOKEEPER_COUNTER_RANGE_SIZE ? Number(ZOOKEEPER_COUNTER_RANGE_SIZE) : 10_000
    const prefetchPercent = ZOOKEEPER_COUNTER_PREFETCH_PERCENT ? Number(ZOOKEEPER_COUNTER_PREFETCH_PERCENT) : 20
    const leaseMaxRetries = ZOOKEEPER_COUNTER_LEASE_MAX_RETRIES ? Number(ZOOKEEPER_COUNTER_LEASE_MAX_RETRIES) : 12
    const leaseBackoffMs = ZOOKEEPER_COUNTER_LEASE_BACKOFF_MS ? Number(ZOOKEEPER_COUNTER_LEASE_BACKOFF_MS) : 5

    if (!Number.isFinite(rangeSize) || rangeSize <= 0) {
        throw new Error("ZOOKEEPER_COUNTER_RANGE_SIZE must be a positive number")
    }

    if (!Number.isFinite(prefetchPercent) || prefetchPercent < 1 || prefetchPercent > 90) {
        throw new Error("ZOOKEEPER_COUNTER_PREFETCH_PERCENT must be between 1 and 90")
    }

    if (!Number.isFinite(leaseMaxRetries) || leaseMaxRetries <= 0) {
        throw new Error("ZOOKEEPER_COUNTER_LEASE_MAX_RETRIES must be a positive number")
    }

    if (!Number.isFinite(leaseBackoffMs) || leaseBackoffMs <= 0) {
        throw new Error("ZOOKEEPER_COUNTER_LEASE_BACKOFF_MS must be a positive number")
    }

    const port = Number(PORT)
    const kafkaBrokers = KAFKA_BROKERS.split(",").map((broker) => broker.trim()).filter(Boolean)

    if (kafkaBrokers.length === 0) {
        throw new Error("KAFKA_BROKERS must include at least one broker")
    }

    const server = await compose({
        databaseUrl: DATABASE_URL,
        redisWriteUrl: REDIS_WRITE_URL,
        redisReadUrl: REDIS_READ_URL,
        zookeeperUrl: ZOOKEEPER_URL,
        kafkaBrokers,
        redisConnectTimeoutMs: REDIS_CONNECT_TIMEOUT_MS ? Number(REDIS_CONNECT_TIMEOUT_MS) : undefined,
        redisMaxReconnectDelayMs: REDIS_MAX_RECONNECT_DELAY_MS ? Number(REDIS_MAX_RECONNECT_DELAY_MS) : undefined,
        zookeeperSessionTimeoutMs: ZOOKEEPER_SESSION_TIMEOUT_MS ? Number(ZOOKEEPER_SESSION_TIMEOUT_MS) : undefined,
        httpServerPort: port,
    })

    server.listen({ port, host: HOST }, (err, address) => {
        if (err) {
            server.log.error(err)
            process.exit(1)
        }
        logger.info(`url-shortener-service running on ${address}`)
    })
}

main()