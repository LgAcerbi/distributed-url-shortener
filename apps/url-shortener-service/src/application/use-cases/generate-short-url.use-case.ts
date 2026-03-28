import type { ShortUrlRepository } from '../ports/short-url.repository';
import type { ShortUrlCacheRepository } from '../ports/short-url-cache.repository';
import type { CounterRepository } from '../ports/counter.repository';

import { randomUUID } from 'node:crypto';
import { ShortUrl } from '../../domain/entities/short-url';

const { SHORT_URL_HOST, EXPIRATION_TIME = 1000 * 60 * 60 * 24 * 30, CACHE_EXPIRATION_TIME = 1000 * 60 * 60 * 24 * 30 } = process.env;

const BASE62 = '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ';

class GenerateShortUrlUseCase {
    constructor(
        private readonly shortUrlRepository: ShortUrlRepository,
        private readonly counterRepository: CounterRepository,
        private readonly shortUrlCacheRepository: ShortUrlCacheRepository,
    ) {}

    async execute(url: string): Promise<string> {
        const nextValue = await this.counterRepository.getNextValue();

        const shortUrlCode = this.generateBase62Code(nextValue);

        const expiresAt = new Date(Date.now() + Number(EXPIRATION_TIME));

        const shortUrl = new ShortUrl(
            randomUUID(),
            shortUrlCode,
            url,
            expiresAt,
            new Date(),
            new Date(),
            null,
        );

        await this.shortUrlRepository.create(shortUrl);

        await this.shortUrlCacheRepository.setCachedShortUrlByCode(
            shortUrl.getCode(),
            { id: shortUrl.id, url: shortUrl.getUrl() },
            Number(CACHE_EXPIRATION_TIME),
        );

        return `${SHORT_URL_HOST}/${shortUrl.getCode()}`;
    }

    private generateBase62Code(counter: number): string {
        if (counter === 0) return BASE62[0];

        let code = '';

        while (counter > 0) {
            code = BASE62[counter % 62] + code;
            
            counter = Math.floor(counter / 62);
        }

        return code;
    }
}

export default GenerateShortUrlUseCase;
export { GenerateShortUrlUseCase };
