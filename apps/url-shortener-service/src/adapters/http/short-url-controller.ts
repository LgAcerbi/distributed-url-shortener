import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import type { GenerateShortUrlUseCase } from '../../application/use-cases/generate-short-url';

class ShortUrlController {
    constructor(
        private readonly server: FastifyInstance,
        private readonly generateShortUrlUseCase: GenerateShortUrlUseCase,
    ) {}

    public async addRoutes() {
        this.server.route({
            method: 'POST',
            url: '/short-url',
            schema: {
                body: {
                    type: 'object',
                    properties: {
                        url: {
                            type: 'string',
                            format: 'uri',
                        },
                    },
                    required: ['url'],
                },
                response: {
                    '201': {
                        type: 'object',
                        properties: {
                            shortUrl: { type: 'string' },
                        },
                    },
                },
            },
            handler: async (request: FastifyRequest, reply: FastifyReply) => {
                const { url } = request.body;

                const shortUrl =
                    await this.generateShortUrlUseCase.execute(url);

                return reply.status(201).send({ shortUrl });
            },
        });
    }
}

export default ShortUrlController;
export { ShortUrlController };
