# kafka-node

Shared Kafka bootstrap client for Nx apps.

## Usage

Import `KafkaNodeClient`, instantiate it with brokers and client id, then create producer/consumer instances.

```ts
import { KafkaNodeClient } from '@workspace/kafka-node';

const kafkaClient = new KafkaNodeClient({
    clientId: 'url-shortener-service',
    brokers: ['kafka:9092'],
});

const producer = kafkaClient.getProducer();
await producer.connect();
```
