import Fastify from "fastify"
import cors from "@fastify/cors"
import swagger from "@fastify/swagger"
import swaggerUi from "@fastify/swagger-ui"
import { logger } from "@workspace/logger"

export const createHttpServer = async (
    port: number,
) => {
    const app = Fastify({
        loggerInstance: logger.child({ service: "url-shortener-service" }),
    })

    await app.register(cors)
    
    await app.register(swagger, {
        openapi: {
            openapi: "3.0.0",
            info: {
                title: "URL Shortener API",
                description: "API documentation",
                version: "1.0.0",
            },
            servers: [{ url: `http://localhost:${port}`, description: "Development" }],
        },
    })

    await app.register(swaggerUi, {
        routePrefix: "/docs",
    })

    return app
}