import type { ShortUrlRepository } from '@url-shortener/ports';
import type { CounterRepository } from '../ports/counter-repository';

import { randomUUID } from 'node:crypto';
import { ShortUrl } from '@url-shortener/entities';

const { SHORT_URL_HOST, EXPIRATION_TIME = 1000 * 60 * 60 * 24 * 30 } = process.env;

class GenerateShortUrlUseCase {
    constructor(
        private readonly shortUrlRepository: ShortUrlRepository,
        private readonly counterRepository: CounterRepository,
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

        return `${SHORT_URL_HOST}/${shortUrl.getCode()}`;
    }

    private generateBase62Code(counter: number): string {
        let code = '';

        while (counter % 62 > 0) {
            code += (counter % 62).toString(62);
            
            counter = Math.floor(counter / 62);
        }

        return code;
    }
}

export default GenerateShortUrlUseCase;
export { GenerateShortUrlUseCase };
