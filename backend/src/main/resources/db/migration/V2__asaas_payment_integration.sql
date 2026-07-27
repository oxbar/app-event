ALTER TABLE payments ALTER COLUMN pix_qr_code_url TYPE TEXT;

ALTER TABLE attendees ADD COLUMN IF NOT EXISTS payment_provider VARCHAR(50);
ALTER TABLE attendees ADD COLUMN IF NOT EXISTS provider_customer_id VARCHAR(150);

CREATE INDEX IF NOT EXISTS idx_attendees_provider_customer
    ON attendees (payment_provider, provider_customer_id)
    WHERE provider_customer_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_payments_provider_payment
    ON payments (provider, provider_payment_id)
    WHERE provider_payment_id IS NOT NULL;
