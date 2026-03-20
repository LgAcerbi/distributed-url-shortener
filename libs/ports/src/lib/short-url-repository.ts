import type { ShortUrl } from '@url-shortener/entities';

interface ShortUrlRepository {
  create(shortUrl: ShortUrl): Promise<void>;
  getByCode(code: string): Promise<ShortUrl | null>;
}

export default ShortUrlRepository;
export type { ShortUrlRepository };
