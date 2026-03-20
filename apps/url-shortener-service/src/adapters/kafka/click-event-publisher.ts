import type { Producer } from 'kafkajs';
import type { ClickEventPublisher, ClickEvent } from '../../application';

const { CLICK_TOPIC = 'url-clicks' } = process.env;

class KafkaClickEventPublisher implements ClickEventPublisher {
    constructor(private readonly producer: Producer) {}

    async publish(event: ClickEvent): Promise<void> {
        await this.producer.send({
            topic: CLICK_TOPIC,
            messages: [{ value: JSON.stringify(event) }],
        });
    }
}

export default KafkaClickEventPublisher;
export { KafkaClickEventPublisher, CLICK_TOPIC };
