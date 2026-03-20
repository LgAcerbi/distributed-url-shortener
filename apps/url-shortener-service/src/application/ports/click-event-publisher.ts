type ClickEvent = {
    code: string;
    clickedAt: string;
};

interface ClickEventPublisher {
    publish(event: ClickEvent): Promise<void>;
}

export default ClickEventPublisher;
export type { ClickEventPublisher, ClickEvent };
