import { Buffer } from "node:buffer";
import type { CounterRepository } from "../../application";

import * as zookeeper from "node-zookeeper-client";

const {
    COUNTER_KEY = "counter",
    ZOOKEEPER_COUNTER_PATH = "/url-shortener",
    ZOOKEEPER_COUNTER_RANGE_SIZE = "10000",
    ZOOKEEPER_COUNTER_PREFETCH_PERCENT = "20",
    ZOOKEEPER_COUNTER_LEASE_MAX_RETRIES = "12",
    ZOOKEEPER_COUNTER_LEASE_BACKOFF_MS = "5",
} = process.env;

const COUNTER_NODE_PATH = `${ZOOKEEPER_COUNTER_PATH}/${COUNTER_KEY}`;
type CounterRange = { current: number; max: number };

class ZookeeperCounterRepository implements CounterRepository {
    private ensuredCounterNode = false;
    private activeRange: CounterRange = { current: 1, max: 0 };
    private prefetchedRange: CounterRange | null = null;
    private leasePromise: Promise<void> | null = null;
    private nextRangePromise: Promise<void> | null = null;

    constructor(
        private readonly client: zookeeper.Client,
        private readonly counterNodePath: string = COUNTER_NODE_PATH,
        private readonly rangeSize = Number(ZOOKEEPER_COUNTER_RANGE_SIZE),
        private readonly prefetchPercent = Number(ZOOKEEPER_COUNTER_PREFETCH_PERCENT),
        private readonly leaseMaxRetries = Number(ZOOKEEPER_COUNTER_LEASE_MAX_RETRIES),
        private readonly leaseBackoffMs = Number(ZOOKEEPER_COUNTER_LEASE_BACKOFF_MS),
    ) {}

    async getNextValue(): Promise<number> {
        await this.ensureRangeAvailable();

        const nextValue = this.activeRange.current;
        this.activeRange.current += 1;

        if (this.shouldPrefetchNextRange()) {
            this.prefetchNextRange();
        }

        return nextValue;
    }

    private async ensureCounterNode(): Promise<void> {
        if (this.ensuredCounterNode) {
            return;
        }

        await this.ensurePath(ZOOKEEPER_COUNTER_PATH);

        if (await this.exists(this.counterNodePath)) {
            this.ensuredCounterNode = true;
            return;
        }

        try {
            await this.create(this.counterNodePath, Buffer.from("0", "utf-8"));
        } catch (error) {
            if (!this.isNodeExistsError(error)) {
                throw error;
            }
        }

        this.ensuredCounterNode = true;
    }

    private async ensureRangeAvailable(): Promise<void> {
        if (this.activeRange.current <= this.activeRange.max) {
            return;
        }

        await this.acquireLease();
    }

    private async acquireLease(): Promise<void> {
        if (this.prefetchedRange) {
            this.activeRange = this.prefetchedRange;
            this.prefetchedRange = null;
            return;
        }

        if (!this.leasePromise) {
            this.leasePromise = this.leaseRangeFromZooKeeper()
                .then((range) => {
                    this.activeRange = range;
                })
                .finally(() => {
                    this.leasePromise = null;
                });
        }

        await this.leasePromise;
    }

    private shouldPrefetchNextRange(): boolean {
        const remaining = this.activeRange.max - this.activeRange.current + 1;
        const threshold = Math.max(
            1,
            Math.floor(this.normalizedRangeSize * (this.normalizedPrefetchPercent / 100)),
        );

        return (
            remaining <= threshold &&
            !this.prefetchedRange &&
            !this.nextRangePromise &&
            this.activeRange.current <= this.activeRange.max
        );
    }

    private prefetchNextRange(): void {
        this.nextRangePromise = this.leaseRangeFromZooKeeper()
            .then((range) => {
                this.prefetchedRange = range;
            })
            .finally(() => {
                this.nextRangePromise = null;
            });
    }

    private async leaseRangeFromZooKeeper(): Promise<CounterRange> {
        await this.ensureCounterNode();

        for (let attempt = 0; attempt < this.normalizedLeaseMaxRetries; attempt++) {
            const nodeData = await this.getData(this.counterNodePath);
            const currentValue = this.parseCounterValue(nodeData.data);
            const newMax = currentValue + this.normalizedRangeSize;

            try {
                await this.setData(
                    this.counterNodePath,
                    Buffer.from(String(newMax), "utf-8"),
                    nodeData.stat.version,
                );

                return { current: currentValue + 1, max: newMax };
            } catch (error) {
                if (!this.isVersionConflictError(error)) {
                    throw error;
                }

                const jitterMs = Math.floor(Math.random() * this.normalizedLeaseBackoffMs);
                await this.sleep(this.normalizedLeaseBackoffMs + jitterMs);
            }
        }

        throw new Error("Could not lease ZooKeeper counter range after max retries");
    }

    private parseCounterValue(data: Buffer): number {
        const parsed = Number(data.toString("utf-8"));
        return Number.isFinite(parsed) && parsed >= 0 ? parsed : 0;
    }

    private sleep(ms: number): Promise<void> {
        return new Promise((resolve) => {
            setTimeout(resolve, ms);
        });
    }

    private get normalizedRangeSize(): number {
        return Number.isFinite(this.rangeSize) && this.rangeSize > 0 ? Math.floor(this.rangeSize) : 10_000;
    }

    private get normalizedPrefetchPercent(): number {
        if (!Number.isFinite(this.prefetchPercent)) {
            return 20;
        }

        return Math.max(1, Math.min(90, Math.floor(this.prefetchPercent)));
    }

    private get normalizedLeaseMaxRetries(): number {
        return Number.isFinite(this.leaseMaxRetries) && this.leaseMaxRetries > 0
            ? Math.floor(this.leaseMaxRetries)
            : 12;
    }

    private get normalizedLeaseBackoffMs(): number {
        return Number.isFinite(this.leaseBackoffMs) && this.leaseBackoffMs > 0
            ? Math.floor(this.leaseBackoffMs)
            : 5;
    }

    private async ensurePath(path: string): Promise<void> {
        if (path === "/" || path === "") {
            return;
        }

        const segments = path.split("/").filter(Boolean);
        let currentPath = "";

        for (const segment of segments) {
            currentPath = `${currentPath}/${segment}`;

            if (await this.exists(currentPath)) {
                continue;
            }

            try {
                await this.create(currentPath);
            } catch (error) {
                if (!this.isNodeExistsError(error)) {
                    throw error;
                }
            }
        }
    }

    private async exists(path: string): Promise<boolean> {
        return new Promise((resolve, reject) => {
            this.client.exists(path, (error, stat) => {
                if (error) {
                    reject(error);
                    return;
                }

                resolve(Boolean(stat));
            });
        });
    }

    private async create(path: string, data?: Buffer): Promise<string> {
        return new Promise((resolve, reject) => {
            const callback = (error: unknown, createdPath: string) => {
                if (error) {
                    reject(error);
                    return;
                }

                resolve(createdPath);
            };

            if (data) {
                this.client.create(path, data, callback);
                return;
            }

            this.client.create(path, callback);
        });
    }

    private async getData(path: string): Promise<{ data: Buffer; stat: zookeeper.Stat }> {
        return new Promise((resolve, reject) => {
            this.client.getData(path, (error, data, stat) => {
                if (error) {
                    reject(error);
                    return;
                }

                if (!data || !stat) {
                    reject(new Error(`Counter node ${path} has no data`));
                    return;
                }

                resolve({ data, stat });
            });
        });
    }

    private async setData(path: string, data: Buffer, version: number): Promise<zookeeper.Stat> {
        return new Promise((resolve, reject) => {
            this.client.setData(path, data, version, (error, stat) => {
                if (error) {
                    reject(error);
                    return;
                }

                if (!stat) {
                    reject(new Error(`Counter node ${path} update returned no stat`));
                    return;
                }

                resolve(stat);
            });
        });
    }

    private isNodeExistsError(error: unknown): boolean {
        if (!(error instanceof Error)) {
            return false;
        }

        return error.name === "NODE_EXISTS";
    }

    private isVersionConflictError(error: unknown): boolean {
        if (!(error instanceof Error)) {
            return false;
        }

        return error.name === "BAD_VERSION";
    }
}

function createZookeeperClient({
    connectionString,
    sessionTimeout = 10_000,
    connectTimeoutMs = 10_000,
}: {
    connectionString: string;
    sessionTimeout?: number;
    connectTimeoutMs?: number;
}): Promise<zookeeper.Client> {
    return new Promise((resolve, reject) => {
        const client = zookeeper.createClient(connectionString, { sessionTimeout });
        const timeout = setTimeout(() => {
            reject(new Error("ZooKeeper connection timeout"));
        }, connectTimeoutMs);

        const onConnected = () => {
            clearTimeout(timeout);
            resolve(client);
        };

        client.once("connected", onConnected);
        client.connect();
    });
}

export default ZookeeperCounterRepository;
export { ZookeeperCounterRepository, createZookeeperClient };
