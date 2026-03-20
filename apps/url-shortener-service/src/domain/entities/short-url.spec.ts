import test from "node:test";
import assert from "node:assert/strict";

import { ShortUrl } from "./short-url";

test("ShortUrl creates entity and exposes getters", () => {
    const now = new Date();
    const expiresAt = new Date(now.getTime() + 60_000);
    const shortUrl = new ShortUrl(
        "id-1",
        "abc123",
        "https://example.com",
        expiresAt,
        now,
        now,
        null,
    );

    assert.equal(shortUrl.getCode(), "abc123");
    assert.equal(shortUrl.getUrl(), "https://example.com");
});

test("ShortUrl throws when code is longer than 7 characters", () => {
    const now = new Date();
    const expiresAt = new Date(now.getTime() + 60_000);

    assert.throws(
        () => new ShortUrl(
            "id-1",
            "abcdefgh",
            "https://example.com",
            expiresAt,
            now,
            now,
            null,
        ),
        /Code must be less than 7 characters long/,
    );
});

test("ShortUrl throws when url does not start with https", () => {
    const now = new Date();
    const expiresAt = new Date(now.getTime() + 60_000);

    assert.throws(
        () => new ShortUrl(
            "id-1",
            "abc123",
            "http://example.com",
            expiresAt,
            now,
            now,
            null,
        ),
        /URL must start with https/,
    );
});
