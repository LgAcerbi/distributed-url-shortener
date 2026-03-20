import { Kafka } from 'kafkajs';

type KafkaNodeClientOptions = {
    brokers: string[];
    clientId: string;
};

class KafkaNodeClient {
    private readonly kafka: Kafka;

    constructor({ brokers, clientId }: KafkaNodeClientOptions) {
        if (!clientId) {
            throw new Error('Missing Kafka client id');
        }

        if (brokers.length === 0) {
            throw new Error('Missing Kafka brokers');
        }

        this.kafka = new Kafka({
            clientId,
            brokers,
        });
    }

    getProducer() {
        return this.kafka.producer();
    }

    getConsumer(groupId: string) {
        if (!groupId) {
            throw new Error('Missing Kafka consumer group id');
        }

        return this.kafka.consumer({ groupId });
    }
}

function createKafkaNodeClient(options: KafkaNodeClientOptions): KafkaNodeClient {
    return new KafkaNodeClient(options);
}

export { createKafkaNodeClient, KafkaNodeClient };
export type { KafkaNodeClientOptions };
