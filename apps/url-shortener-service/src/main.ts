import "dotenv/config"
import { logger } from "@workspace/logger"
import { compose } from "./compositor"

async function main() {
    const { DATABASE_URL, REDIS_WRITE_URL, REDIS_CONNECT_TIMEOUT_MS, REDIS_MAX_RECONNECT_DELAY_MS, PORT = 80 } = process.env

    if (!DATABASE_URL) {
        throw new Error("DATABASE_URL is required")
    }
    if (!REDIS_WRITE_URL) {
        throw new Error("REDIS_WRITE_URL is required")
    }

    const port = Number(PORT)

    const server = await compose({
        databaseUrl: DATABASE_URL,
        redisWriteUrl: REDIS_WRITE_URL,
        redisConnectTimeoutMs: REDIS_CONNECT_TIMEOUT_MS ? Number(REDIS_CONNECT_TIMEOUT_MS) : undefined,
        redisMaxReconnectDelayMs: REDIS_MAX_RECONNECT_DELAY_MS ? Number(REDIS_MAX_RECONNECT_DELAY_MS) : undefined,
        httpServerPort: port,
    })

    server.listen({ port }, (err, address) => {
        if (err) {
            server.log.error(err)
            process.exit(1)
        }
        logger.info(`url-shortener-service running on ${address}`)
    })
}

main()