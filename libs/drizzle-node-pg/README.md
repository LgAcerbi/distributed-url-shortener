# drizzle-node-pg

Shared Drizzle + Node Postgres bootstrap for Nx apps.

## Usage

Import `NodePgDrizzleClient` from the library, keep your schema in the app, and pass it to the client constructor.

```ts
import { NodePgDrizzleClient } from '@workspace/drizzle-node-pg';
import { shortUrlSchema } from './short-url.schema';

const drizzleSchema = {
    shortUrls: shortUrlSchema,
};

type DrizzleSchema = typeof drizzleSchema;

const dbClient = new NodePgDrizzleClient<DrizzleSchema>(
    process.env.DATABASE_URL ?? '',
    drizzleSchema,
);
const db = dbClient.getDbInstance();
```

Close the connection pool on shutdown:

```ts
await dbClient.close();
```
