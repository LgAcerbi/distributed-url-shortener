import type { createClient } from 'redis';
import type { ShortUrlCacheRepository } from '../../application';

class RedisShortUrlCacheRepository implements ShortUrlCacheRepository {
    constructor(
        private readonly readClient: ReturnType<typeof createClient>,
        private readonly writeClient: ReturnType<typeof createClient>
    ) {}

    async getCachedUrlByCode(code: string): Promise<string | null> {
        const cachedUrl = await this.readClient.get(code);

        if (!cachedUrl) {
            return null;
        }

        return cachedUrl;
    }

    async setCachedUrlByCode(
        code: string,
        url: string,
        expirationTime: number,
    ): Promise<void> {
        await this.writeClient.setEx(code, expirationTime, url);
    }
}

export default RedisShortUrlCacheRepository;
export { RedisShortUrlCacheRepository };
