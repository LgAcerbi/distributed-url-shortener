interface ShortUrlCacheRepository {
    getCachedUrlByCode(code: string): Promise<string | null>;
    setCachedUrlByCode(code: string, url: string, expirationTime: number): Promise<void>;
}

export default ShortUrlCacheRepository;
export type { ShortUrlCacheRepository };