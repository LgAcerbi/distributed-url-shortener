import type { ShortUrlRepository } from '../ports/short-url.repository';
import type { ShortUrlCacheRepository } from '../ports/short-url-cache.repository';

import { NotFoundError } from '@workspace/errors';

const { URL_CACHE_EXPIRATION_TIME = 1000 * 60 * 60 * 24 * 30 } = process.env;

class GetUrlByCodeUseCase {
    constructor(private readonly shortUrlRepository: ShortUrlRepository, private readonly shortUrlCacheRepository: ShortUrlCacheRepository) {}

    async execute(code: string): Promise<string> {
        const cachedUrl = await this.shortUrlCacheRepository.getCachedUrlByCode(code);

        if (!cachedUrl) {
            const url = await this.shortUrlRepository.getUrlByCode(code);

            if (!url) {
                throw new NotFoundError('Short URL not found');
            }

            await this.shortUrlCacheRepository.setCachedUrlByCode(code, url, Number(URL_CACHE_EXPIRATION_TIME));

            return url;
        }

        return cachedUrl;
    }
}

export { GetUrlByCodeUseCase };
