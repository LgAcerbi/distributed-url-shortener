import type { CounterRepository } from "../ports/counter.repository";
import type { ShortUrlCacheRepository } from "../ports/short-url-cache.repository";
import type { ShortUrlRepository } from "../ports/short-url.repository";
import type { ShortUrl } from "../../domain/entities/short-url";

import test from "node:test";
import assert from "node:assert/strict";
import { GenerateShortUrlUseCase } from "./generate-short-url.user-case";

test("GenerateShortUrlUseCase creates and caches short url", async () => {
    let createCallCount = 0;
    let createdCode: string | null = null;
    let createdUrl: string | null = null;
    let cachedPayload: { code: string; url: string; expirationTime: number } | null = null;

    const shortUrlRepository: ShortUrlRepository = {
        async create(shortUrl: ShortUrl): Promise<void> {
            createCallCount += 1;
            createdCode = shortUrl.getCode();
            createdUrl = shortUrl.getUrl();
        },
        async getUrlByCode(): Promise<string | null> {
            return null;
        },
    };

    const counterRepository: CounterRepository = {
        async getNextValue(): Promise<number> {
            return 125;
        },
    };

    const shortUrlCacheRepository: ShortUrlCacheRepository = {
        async getCachedUrlByCode(): Promise<string | null> {
            return null;
        },
        async setCachedUrlByCode(code: string, url: string, expirationTime: number): Promise<void> {
            cachedPayload = { code, url, expirationTime };
        },
    };

    const useCase = new GenerateShortUrlUseCase(
        shortUrlRepository,
        counterRepository,
        shortUrlCacheRepository,
    );

    const result = await useCase.execute("https://example.com/some/route");

    assert.match(result, /\/21$/);
    assert.equal(createCallCount, 1);
    assert.equal(createdCode, "21");
    assert.equal(createdUrl, "https://example.com/some/route");
    assert.deepEqual(cachedPayload, {
        code: "21",
        url: "https://example.com/some/route",
        expirationTime: 1000 * 60 * 60 * 24 * 30,
    });
});
