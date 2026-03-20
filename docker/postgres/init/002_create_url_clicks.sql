CREATE TABLE IF NOT EXISTS url_clicks (
    id UUID PRIMARY KEY,
    short_url_code VARCHAR(7) NOT NULL,
    clicked_at TIMESTAMP NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_url_clicks_code
    ON url_clicks (short_url_code);
