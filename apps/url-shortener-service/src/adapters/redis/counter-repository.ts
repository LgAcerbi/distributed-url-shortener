import type { createClient } from "redis"
import type { CounterRepository } from "../../application"

const { COUNTER_KEY = "counter" } = process.env

class RedisCounterRepository implements CounterRepository {
    constructor(
        private readonly redisWriteClient: ReturnType<typeof createClient>,
    ) {}

    async getNextValue(): Promise<number> {
        const value = await this.redisWriteClient.incr(COUNTER_KEY)

        return value
    }
}

export default RedisCounterRepository
export { RedisCounterRepository }