CREATE TABLE IF NOT EXISTS url_clicks (
    id UUID PRIMARY KEY,
    short_url_id UUID NOT NULL REFERENCES short_urls (id),
    client_ip VARCHAR(45),
    user_agent TEXT,
    referer TEXT,
    kafka_message_id VARCHAR(512) NOT NULL
    clicked_at TIMESTAMP NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
);

CREATE INDEX IF NOT EXISTS idx_url_clicks_short_url_id
    ON url_clicks (short_url_id);

CREATE INDEX IF NOT EXISTS idx_url_clicks_clicked_at
    ON url_clicks (clicked_at);
