# Distributed URL Shortener

A small distributed systems playground built as an Nx monorepo with two Node.js services:

- `url-shortener-service`: creates short URLs, resolves codes, redirects clients, caches lookups in Redis, and publishes click events to Kafka.
- `url-usage-service`: consumes click events from Kafka and persists analytics data in PostgreSQL.

The project is intentionally simple at the HTTP layer and more interesting in the infrastructure layer: cache-aside reads, async analytics ingestion, shared workspace libraries, and multiple counter strategies for generating short codes.

## What This Project Demonstrates

- A clean split between the synchronous user path and the asynchronous analytics path.
- A workspace-oriented Node.js setup using Nx applications plus shared libs.
- Base62 short code generation from a monotonic counter.
- Redis for read acceleration.
- Kafka for decoupling redirect traffic from analytics writes.
- ZooKeeper and Redis as alternative approaches for globally increasing counters.
- Native Node test tooling with `node:test` and `node:assert/strict` instead of Jest or Vitest.

## Architecture

```mermaid
flowchart LR
    Client -->|POST /short-url| Shortener
    Client -->|GET /:code| Shortener
    Shortener --> Postgres[(PostgreSQL)]
    Shortener --> Redis[(Redis)]
    Shortener --> ZooKeeper[(ZooKeeper)]
    Shortener --> Kafka[(Kafka)]
    Kafka --> Usage
    Usage --> Postgres
```



### Request flow

#### Create a short URL

1. `url-shortener-service` asks the configured counter implementation for the next integer.
2. The integer is converted to Base62 to produce the public short code.
3. The mapping is persisted to `short_urls` in PostgreSQL.
4. The `{ id, url }` payload is cached in Redis by code.
5. The service returns `SHORT_URL_HOST/<code>`.

#### Resolve and track a short URL

1. `url-shortener-service` receives `GET /:code`.
2. It looks up the code in Redis first.
3. On a cache miss, it reads PostgreSQL and repopulates the cache.
4. It immediately responds with `302` to the original URL.
5. In parallel, it publishes a click event to Kafka.
6. `url-usage-service` consumes the event and inserts a row into `url_clicks`.

That split matters: the redirect path is kept fast even if analytics persistence is slower or temporarily unavailable.

## Workspace Layout

```text
apps/
  url-shortener-service/   Fastify API + redirect service
  url-usage-service/       Kafka consumer for click analytics
libs/
  drizzle-node-pg/         Shared Postgres + Drizzle bootstrap
  kafka-node/              Shared Kafka client bootstrap
  redis-node/              Shared Redis client bootstrap
  logger/                  Shared Pino logger
  errors/                  Shared typed application errors
docker/
  postgres/init/           Initial SQL for fresh local databases
```

### Nx projects

- `url-shortener-service`
- `url-usage-service`
- `@workspace/drizzle-node-pg`
- `@workspace/kafka-node`
- `@workspace/redis-node`
- `@workspace/logger`
- `@workspace/errors`

## Tech Stack

- Node.js 22
- TypeScript
- Nx
- Fastify
- PostgreSQL
- Drizzle ORM
- Redis
- Kafka (`kafkajs`)
- ZooKeeper
- Pino
- Native Node test runner

## Quick Start

### Option 1: run the whole stack with Docker Compose

1. Install Node.js 22+ and Docker Desktop.
2. Install dependencies:

```sh
npm ci
```

1. Create `.env` from `.env.example` and adjust values if needed.
2. Start everything:

```sh
docker compose up --build
```

1. Open:

- API: `http://localhost:3000`
- Swagger UI: `http://localhost:3000/docs`
- Adminer: `http://localhost:8080`
- PostgreSQL: `localhost:5432`
- Redis: `localhost:6379`
- Kafka: `localhost:9092`
- ZooKeeper: `localhost:2181`

### Option 2: run infrastructure in Docker, apps via Nx

Start only infrastructure:

```sh
docker compose up -d postgres redis zookeeper kafka adminer
```

Run the API:

```sh
npm exec -- nx serve url-shortener-service
```

Run the analytics consumer in another terminal:

```sh
npm exec -- nx serve url-usage-service
```

## Common Nx Commands

Build both apps:

```sh
npm exec -- nx run-many -t build -p url-shortener-service,url-usage-service
```

Lint both apps:

```sh
npm exec -- nx run-many -t lint -p url-shortener-service,url-usage-service
```

Run tests for the shortener service:

```sh
npm exec -- nx test url-shortener-service
```

Generate HTML coverage for the shortener service:

```sh
npm exec -- nx run url-shortener-service:test:coverage:html
```

Build the Docker images through Nx-aware compose builds:

```sh
docker compose build url-shortener-service url-usage-service
```

## API

### `POST /short-url`

Creates a short URL for an HTTPS target.

Request:

```json
{
  "url": "https://example.com/docs/something/otherthing?test=123456789&another=abcdefgh"
}
```

Response:

```json
{
  "shortUrl": "http://localhost:3000/1fbj1"
}
```

### `GET /:code`

Looks up a code and returns `302` to the original URL.

Example:

```sh
curl -i http://localhost:3000/1fbj1
```

Swagger/OpenAPI is available at `GET /docs`.

## Data Model

### `short_urls`

- `id`: UUID primary key
- `code`: public short code, max length `7`
- `original_url`: original HTTPS URL
- `expires_at`: expiration timestamp
- `created_at`
- `updated_at`
- `deleted_at`

### `url_clicks`

- `id`: UUID primary key
- `short_url_id`: foreign key to `short_urls.id`
- `client_ip`
- `user_agent`
- `referer`
- `kafka_message_id`: stable message identifier in `topic:partition:offset` form
- `clicked_at`: when the redirect happened
- `created_at`: when the analytics service inserted the row

### Database initialization

PostgreSQL init scripts live in `docker/postgres/init`:

- `001_create_short_urls.sql`
- `002_create_url_clicks.sql`

Those scripts only run automatically when the `pgdata` volume is empty. If you change them after the database already exists, wipe the volume and recreate the stack:

```sh
docker compose down -v
docker compose up --build
```

## Environment Variables

`.env.example` is intentionally minimal. In practice, a useful local `.env` for this repo looks more like this:

```dotenv
POSTGRES_USER=postgres
POSTGRES_PASSWORD=postgres
POSTGRES_DB=urlshortener
POSTGRES_PORT=5432

REDIS_PORT=6379
ADMINER_PORT=8080
API_PORT=3000
API_HOST=0.0.0.0

DATABASE_URL=postgresql://postgres:postgres@postgres:5432/urlshortener
REDIS_WRITE_URL=redis://redis:6379
REDIS_READ_URL=redis://redis:6379

KAFKA_BROKERS=kafka:9092
CLICK_TOPIC=url-clicks

SHORT_URL_HOST=http://localhost:3000
EXPIRATION_TIME=2592000000
CACHE_EXPIRATION_TIME=2592000

ZOOKEEPER_URL=zookeeper:2181
ZOOKEEPER_COUNTER_PATH=/url-shortener
ZOOKEEPER_COUNTER_RANGE_SIZE=10000
ZOOKEEPER_COUNTER_PREFETCH_PERCENT=20
ZOOKEEPER_COUNTER_LEASE_MAX_RETRIES=12
ZOOKEEPER_COUNTER_LEASE_BACKOFF_MS=5

REDIS_CONNECT_TIMEOUT_MS=5000
REDIS_MAX_RECONNECT_DELAY_MS=3000
ZOOKEEPER_SESSION_TIMEOUT_MS=10000
```

### Important notes

- `SHORT_URL_HOST` must match the public base URL you want returned by `POST /short-url`.
- `REDIS_WRITE_URL` and `REDIS_READ_URL` can point to the same Redis instance locally.
- `CLICK_TOPIC` defaults to `url-clicks` in both producer and consumer.
- `COUNTER_BACKEND` appears in `docker-compose.yml`, but the current application composition does not switch on it yet. The shortener service currently wires in `ZookeeperCounterRepository` directly.

## Counter Strategy: ZooKeeper vs Redis

The codebase contains three counter implementations:

- `RedisCounterRepository`: one Redis `INCR` per generated URL.
- `RedisRangeCounterRepository`: one Redis `INCRBY` per leased block, then local in-memory consumption.
- `ZookeeperCounterRepository`: leases counter ranges from a ZooKeeper znode using optimistic version checks, then consumes them in memory.

### Why use a monotonic counter at all?

Because the public short code is just Base62 encoding of an integer, the system needs a globally increasing number source. That keeps code generation deterministic, cheap, and collision-free without repeated random retries.

### Redis tradeoffs

Redis is the simplest operational answer for counters:

- `INCR` is atomic.
- It is fast and easy to understand.
- It introduces less coordination complexity than ZooKeeper.
- It is usually the best default if all you need is a reliable monotonic number.

The range-based Redis version goes one step further and reduces write pressure by leasing blocks with `INCRBY`, which is useful when URL creation volume grows.

### ZooKeeper tradeoffs

ZooKeeper is heavier, but it is purpose-built for distributed coordination:

- It makes coordination semantics explicit instead of piggybacking on a cache.
- The repository in this project leases ranges and retries on version conflicts.
- Range prefetching reduces the number of ZooKeeper writes on the hot path.

The downside is operational cost: another distributed system to run, observe, and debug.

### What this repo currently does

Even though Redis-based implementations exist, the current `url-shortener-service` composition uses `ZookeeperCounterRepository`. Redis is still used for URL lookup caching.

If you are evaluating the design pragmatically, the usual guidance is:

- Choose Redis when you want the fewest moving parts.
- Choose ZooKeeper when the counter is part of a broader coordination story and you explicitly want coordination infrastructure.

## Why the Tests Use Native `node:test` and `node:assert/strict`

This repo uses Node's built-in test tooling for the existing unit tests in `url-shortener-service`.

### Why this is a good fit here

- The application code is mostly plain TypeScript classes with dependency injection through interfaces.
- The tests are true unit tests; they do not need DOM emulation, snapshot tooling, or a custom runtime.
- Node's native runner has near-zero conceptual overhead for a backend service.
- There is no Jest/Vitest transform layer to keep in sync with the runtime.
- `node:assert/strict` keeps assertions explicit and standard-library based.
- `tsx` is only used to execute TypeScript test files directly, not to replace the test framework.

### Current test command

`url-shortener-service` runs tests with:

```sh
node --import tsx --test "apps/url-shortener-service/src/**/*.spec.ts"
```

That means:

- `node --test` is the runner
- `tsx` enables direct execution of `.ts` files
- assertions come from the standard library

### Tradeoffs

This approach is lean, but it also means fewer batteries included:

- no snapshot ecosystem
- fewer high-level mocking conveniences
- fewer reporter plugins compared with Jest/Vitest

For this project, that is a reasonable trade: smaller toolchain, faster understanding, and less framework-specific ceremony.

## Caching Strategy

Redis is used as a cache-aside layer for short URL resolution:

- look up code in Redis first
- fall back to PostgreSQL on miss
- repopulate Redis after a successful DB read

The cache value currently stores JSON:

```json
{
  "id": "uuid",
  "url": "https://example.com"
}
```

There is also backward-compatible logic for a legacy plain-string cache value, which lets the reader tolerate older cached entries during transitions.

## Analytics and Kafka Design

Click tracking is intentionally asynchronous:

- the redirect path publishes an event instead of writing analytics directly
- the analytics service consumes from Kafka and writes to PostgreSQL
- the event includes `shortUrlId`, `clickedAt`, and request metadata

The producer still includes `code` in the event payload for logging and correlation, but `url_clicks` stores only `short_url_id` as the canonical relation to `short_urls`.

### Why this split is useful

- user-facing redirects stay responsive
- analytics persistence can scale independently
- failures in analytics do not immediately block redirects
- Kafka gives buffering between traffic spikes and DB writes

### One nuance worth knowing

`url-usage-service` derives a stable `kafka_message_id` from `topic:partition:offset` and stores it with each click row. That is useful for tracing and can support deduplication strategies later. The current schema stores it, but does not yet enforce uniqueness at the database level.

## Shared Libraries

### `@workspace/drizzle-node-pg`

Small wrapper that creates a `pg` pool and exposes a Drizzle database instance for an app-defined schema.

### `@workspace/redis-node`

Shared Redis bootstrap with distinct read and write clients, connection timeout support, and reconnect backoff.

### `@workspace/kafka-node`

Minimal Kafka bootstrap that centralizes producer and consumer creation.

### `@workspace/logger`

Pino-based logger with pretty output in non-production environments.

### `@workspace/errors`

Transport-agnostic application errors such as `NotFoundError` and `ValidationError`.

## Notable Implementation Decisions

### Base62 codes

Codes are derived from a numeric counter using the alphabet:

`0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ`

This keeps URLs compact without needing hashing or collision retries.

### HTTPS-only input validation

The `ShortUrl` entity accepts only URLs starting with `https`. That is a domain rule, not just an HTTP validation rule, so it is enforced even outside the controller layer.

### Redirect path is not blocked on analytics acknowledgement

`PublishShortUrlClickUseCase` intentionally fires the Kafka publish asynchronously and logs errors instead of surfacing them to the redirect client. That favors redirect latency over guaranteed synchronous analytics recording.

## Known Gaps / Future Improvements

- `COUNTER_BACKEND` is present in Compose but is not yet wired to select Redis vs ZooKeeper at runtime.
- Only `url-shortener-service` currently has unit tests.
- `url-usage-service` stores a message id suitable for dedupe, but the database does not yet enforce idempotency with a unique constraint.
- There is no expiration cleanup job yet for expired short URLs.
- The README documents a fuller `.env` than the current `.env.example`; promoting those values into `.env.example` would make first-time setup smoother.

## Useful Commands

Create a short URL:

```sh
curl -X POST http://localhost:3000/short-url \
  -H "content-type: application/json" \
  -d "{\"url\":\"https://example.com\"}"
```

Follow a redirect:

```sh
curl -i http://localhost:3000/1fbj1
```

View logs:

```sh
docker compose logs -f url-shortener-service url-usage-service
```

Reset local state:

```sh
docker compose down -v
docker compose up --build
```

## Summary

This repository is a compact example of a distributed URL shortener that chooses clarity over magic:

- Fastify handles the HTTP edge.
- PostgreSQL stores durable URL and analytics data.
- Redis accelerates lookups.
- Kafka decouples redirect traffic from analytics writes.
- ZooKeeper currently coordinates counter range leasing.
- Nx keeps apps and shared infrastructure libraries organized in one workspace.

If you want to explore the most interesting parts first, start with:

- `apps/url-shortener-service/src/compositor.ts`
- `apps/url-shortener-service/src/application/use-cases/generate-short-url.user-case.ts`
- `apps/url-shortener-service/src/application/use-cases/get-url-by-code.use-case.ts`
- `apps/url-shortener-service/src/adapters/zookeeper/counter-repository.ts`
- `apps/url-usage-service/src/adapters/kafka/click-event-consumer.ts`

