# drizzle-node-pg

Shared Drizzle + Node Postgres bootstrap for Nx apps.

## Usage

Import `NodePgDrizzleClient` from the library, keep your schema in the app, and pass it to the client constructor.

```ts
import { NodePgDrizzleClient } from '@url-shortener/drizzle-node-pg';
import { shortUrlSchema } from './short-url.schema';

type DrizzleSchema = {
    shortUrls: typeof shortUrlSchema;
};

const drizzleSchema: DrizzleSchema = {
    shortUrls: shortUrlSchema,
};

const dbClient = new NodePgDrizzleClient(process.env.DATABASE_URL ?? '', drizzleSchema);
const db = dbClient.getDbInstance();
```

Close the connection pool on shutdown:

```ts
await dbClient.close();
```
