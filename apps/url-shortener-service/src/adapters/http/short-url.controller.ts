import type { FastifyRequest, FastifyReply } from 'fastify';
import type {
    GenerateShortUrlUseCase,
    GetUrlByCodeUseCase,
} from '../../application';
import type { createHttpServer } from './server';

class HttpShortUrlController {
    constructor(
        private readonly server: Awaited<ReturnType<typeof createHttpServer>>,
        private readonly generateShortUrlUseCase: GenerateShortUrlUseCase,
        private readonly getUrlByCodeUseCase: GetUrlByCodeUseCase,
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
            handler: async (request: FastifyRequest<{ Body: { url: string } }>, reply: FastifyReply) => {
                const { url } = request.body;

                const shortUrl =
                    await this.generateShortUrlUseCase.execute(url);

                return reply.status(201).send({ shortUrl });
            },
        });

        this.server.route({
            method: 'GET',
            url: '/:code',
            schema: {
                params: {
                    type: 'object',
                    properties: {
                        code: { type: 'string' },
                    },
                },
            },
            handler: async (request: FastifyRequest<{ Params: { code: string } }>, reply: FastifyReply) => {
                const { code } = request.params;

                const url = await this.getUrlByCodeUseCase.execute(code);

                return reply.status(302).redirect(url);
            },
        });
    }
}

export default HttpShortUrlController;
export { HttpShortUrlController };
