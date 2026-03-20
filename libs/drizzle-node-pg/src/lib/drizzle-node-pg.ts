import type { NodePgDatabase } from 'drizzle-orm/node-postgres';

import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';

type Schema = Record<string, unknown>;

class NodePgDrizzleClient<TSchema extends Schema> {
    private readonly dbInstance: NodePgDatabase<TSchema>;
    private readonly dbPool: Pool;

    constructor(
        connectionString: string,
        schema: TSchema,
    ) {
        if (!connectionString) {
            throw new Error('Missing database connection string');
        }

        this.dbPool = new Pool({ connectionString });
        this.dbInstance = drizzle(this.dbPool, { schema });
    }

    getDbInstance(): NodePgDatabase<TSchema> {
        return this.dbInstance;
    }

    async close(): Promise<void> {
        await this.dbPool.end();
    }
}

function createNodePgDrizzleClient<TSchema extends Schema>(
    connectionString: string,
    schema: TSchema,
): NodePgDrizzleClient<TSchema> {
    return new NodePgDrizzleClient(connectionString, schema);
}

export { createNodePgDrizzleClient, NodePgDrizzleClient };
