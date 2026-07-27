CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE organizations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(150) NOT NULL,
    legal_name VARCHAR(200),
    document_number VARCHAR(20),
    email VARCHAR(150),
    phone VARCHAR(30),
    slug VARCHAR(100) UNIQUE NOT NULL,
    status VARCHAR(30) NOT NULL,
    logo_url VARCHAR(500),
    primary_color VARCHAR(7),
    timezone VARCHAR(50) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ
);

CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(150) NOT NULL,
    email VARCHAR(150) UNIQUE NOT NULL,
    phone VARCHAR(30),
    password_hash VARCHAR(255) NOT NULL,
    status VARCHAR(30) NOT NULL,
    last_login_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ
);

CREATE TABLE organization_members (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id),
    user_id UUID NOT NULL REFERENCES users(id),
    role VARCHAR(30) NOT NULL,
    status VARCHAR(30) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ,
    UNIQUE (organization_id, user_id)
);

CREATE TABLE events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id),
    name VARCHAR(200) NOT NULL,
    slug VARCHAR(150) NOT NULL,
    description TEXT,
    venue_name VARCHAR(200),
    address VARCHAR(300),
    city VARCHAR(100),
    state VARCHAR(50),
    country VARCHAR(50),
    starts_at TIMESTAMPTZ NOT NULL,
    ends_at TIMESTAMPTZ NOT NULL,
    sales_start_at TIMESTAMPTZ,
    sales_end_at TIMESTAMPTZ,
    capacity INTEGER,
    status VARCHAR(30) NOT NULL,
    banner_url VARCHAR(500),
    require_document BOOLEAN NOT NULL DEFAULT FALSE,
    allow_manual_checkin BOOLEAN NOT NULL DEFAULT TRUE,
    terms_url VARCHAR(500),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ,
    UNIQUE (organization_id, slug),
    CHECK (ends_at > starts_at),
    CHECK (capacity IS NULL OR capacity > 0)
);

CREATE TABLE ticket_types (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id UUID NOT NULL REFERENCES events(id),
    name VARCHAR(100) NOT NULL,
    description TEXT,
    category VARCHAR(50) NOT NULL,
    price NUMERIC(15,2) NOT NULL,
    service_fee NUMERIC(15,2) NOT NULL DEFAULT 0,
    total_quantity INTEGER NOT NULL,
    sold_quantity INTEGER NOT NULL DEFAULT 0,
    reserved_quantity INTEGER NOT NULL DEFAULT 0,
    max_per_order INTEGER NOT NULL DEFAULT 1,
    wristband_label VARCHAR(100),
    wristband_color_name VARCHAR(50),
    wristband_color_hex VARCHAR(7),
    sales_start_at TIMESTAMPTZ,
    sales_end_at TIMESTAMPTZ,
    status VARCHAR(30) NOT NULL,
    sort_order INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ,
    CHECK (price >= 0), CHECK (service_fee >= 0), CHECK (total_quantity > 0),
    CHECK (sold_quantity >= 0), CHECK (reserved_quantity >= 0),
    CHECK (sold_quantity <= total_quantity), CHECK (sold_quantity + reserved_quantity <= total_quantity), CHECK (max_per_order > 0)
);

CREATE TABLE attendees (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(150) NOT NULL,
    email VARCHAR(150),
    phone VARCHAR(30),
    document_type VARCHAR(20),
    document_number_encrypted TEXT,
    document_number_hash VARCHAR(255),
    birth_date DATE,
    accepted_terms_at TIMESTAMPTZ,
    accepted_privacy_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ
);

CREATE TABLE orders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id),
    event_id UUID NOT NULL REFERENCES events(id),
    buyer_attendee_id UUID NOT NULL REFERENCES attendees(id),
    public_code VARCHAR(30) UNIQUE NOT NULL,
    status VARCHAR(30) NOT NULL,
    subtotal NUMERIC(15,2) NOT NULL,
    service_fee NUMERIC(15,2) NOT NULL DEFAULT 0,
    discount_amount NUMERIC(15,2) NOT NULL DEFAULT 0,
    total_amount NUMERIC(15,2) NOT NULL,
    currency VARCHAR(3) NOT NULL DEFAULT 'BRL',
    expires_at TIMESTAMPTZ,
    paid_at TIMESTAMPTZ,
    canceled_at TIMESTAMPTZ,
    refunded_at TIMESTAMPTZ,
    source VARCHAR(30) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ,
    CHECK (subtotal >= 0), CHECK (service_fee >= 0), CHECK (discount_amount >= 0), CHECK (total_amount >= 0)
);

CREATE TABLE order_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id UUID NOT NULL REFERENCES orders(id),
    ticket_type_id UUID NOT NULL REFERENCES ticket_types(id),
    quantity INTEGER NOT NULL,
    unit_price NUMERIC(15,2) NOT NULL,
    service_fee_unit NUMERIC(15,2) NOT NULL DEFAULT 0,
    discount_amount NUMERIC(15,2) NOT NULL DEFAULT 0,
    total_amount NUMERIC(15,2) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ,
    CHECK (quantity > 0), CHECK (unit_price >= 0), CHECK (service_fee_unit >= 0),
    CHECK (discount_amount >= 0), CHECK (total_amount >= 0)
);

CREATE TABLE payments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id UUID NOT NULL REFERENCES orders(id),
    provider VARCHAR(50) NOT NULL,
    payment_method VARCHAR(30) NOT NULL,
    provider_payment_id VARCHAR(150),
    idempotency_key VARCHAR(150) UNIQUE NOT NULL,
    status VARCHAR(30) NOT NULL,
    amount NUMERIC(15,2) NOT NULL,
    currency VARCHAR(3) NOT NULL DEFAULT 'BRL',
    pix_copy_paste TEXT,
    pix_qr_code_url VARCHAR(500),
    expires_at TIMESTAMPTZ,
    approved_at TIMESTAMPTZ,
    failed_at TIMESTAMPTZ,
    refunded_at TIMESTAMPTZ,
    failure_reason VARCHAR(500),
    provider_response JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ,
    CHECK (amount >= 0)
);

CREATE TABLE payment_webhooks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    provider VARCHAR(50) NOT NULL,
    provider_event_id VARCHAR(150) NOT NULL,
    event_type VARCHAR(100),
    payload JSONB NOT NULL,
    signature VARCHAR(500),
    status VARCHAR(30) NOT NULL,
    received_at TIMESTAMPTZ NOT NULL,
    processed_at TIMESTAMPTZ,
    error_message TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ,
    UNIQUE (provider, provider_event_id)
);

CREATE TABLE tickets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id UUID NOT NULL REFERENCES events(id),
    ticket_type_id UUID NOT NULL REFERENCES ticket_types(id),
    order_id UUID NOT NULL REFERENCES orders(id),
    order_item_id UUID NOT NULL REFERENCES order_items(id),
    attendee_id UUID NOT NULL REFERENCES attendees(id),
    public_code VARCHAR(40) UNIQUE NOT NULL,
    qr_token_hash VARCHAR(255) UNIQUE NOT NULL,
    status VARCHAR(30) NOT NULL,
    issued_at TIMESTAMPTZ,
    valid_from TIMESTAMPTZ,
    valid_until TIMESTAMPTZ,
    checked_in_at TIMESTAMPTZ,
    blocked_at TIMESTAMPTZ,
    block_reason VARCHAR(500),
    canceled_at TIMESTAMPTZ,
    version BIGINT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ
);

CREATE TABLE invitations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id UUID NOT NULL REFERENCES events(id),
    ticket_type_id UUID REFERENCES ticket_types(id),
    attendee_id UUID NOT NULL REFERENCES attendees(id),
    invited_by_user_id UUID NOT NULL REFERENCES users(id),
    code VARCHAR(50) UNIQUE NOT NULL,
    status VARCHAR(30) NOT NULL,
    expires_at TIMESTAMPTZ,
    accepted_at TIMESTAMPTZ,
    converted_order_id UUID REFERENCES orders(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ
);

CREATE TABLE access_points (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id UUID NOT NULL REFERENCES events(id),
    name VARCHAR(100) NOT NULL,
    description VARCHAR(300),
    status VARCHAR(30) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ
);

CREATE TABLE event_staff (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id UUID NOT NULL REFERENCES events(id),
    user_id UUID NOT NULL REFERENCES users(id),
    access_point_id UUID REFERENCES access_points(id),
    role VARCHAR(30) NOT NULL,
    status VARCHAR(30) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ,
    UNIQUE (event_id, user_id, access_point_id)
);

CREATE TABLE checkins (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id UUID NOT NULL REFERENCES events(id),
    ticket_id UUID REFERENCES tickets(id),
    access_point_id UUID REFERENCES access_points(id),
    staff_user_id UUID NOT NULL REFERENCES users(id),
    result VARCHAR(40) NOT NULL,
    scanned_token_hash VARCHAR(255),
    device_identifier VARCHAR(150),
    ip_address VARCHAR(45),
    latitude NUMERIC(10,7),
    longitude NUMERIC(10,7),
    reason VARCHAR(500),
    scanned_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ
);

CREATE TABLE refunds (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    payment_id UUID NOT NULL REFERENCES payments(id),
    order_id UUID NOT NULL REFERENCES orders(id),
    requested_by_user_id UUID REFERENCES users(id),
    provider_refund_id VARCHAR(150),
    amount NUMERIC(15,2) NOT NULL,
    reason VARCHAR(500),
    status VARCHAR(30) NOT NULL,
    requested_at TIMESTAMPTZ NOT NULL,
    processed_at TIMESTAMPTZ,
    provider_response JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ,
    CHECK (amount > 0)
);

CREATE TABLE audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID REFERENCES organizations(id),
    event_id UUID REFERENCES events(id),
    user_id UUID REFERENCES users(id),
    action VARCHAR(100) NOT NULL,
    entity_type VARCHAR(100) NOT NULL,
    entity_id UUID,
    previous_data JSONB,
    new_data JSONB,
    ip_address VARCHAR(45),
    user_agent VARCHAR(500),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ
);

CREATE TABLE refresh_tokens (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id),
    organization_id UUID NOT NULL REFERENCES organizations(id),
    token_hash VARCHAR(255) UNIQUE NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    revoked_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ
);

CREATE TABLE password_reset_tokens (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id),
    token_hash VARCHAR(255) UNIQUE NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    used_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ
);

CREATE INDEX idx_password_reset_token_hash ON password_reset_tokens(token_hash);
CREATE INDEX idx_refresh_tokens_user ON refresh_tokens(user_id);
CREATE INDEX idx_refresh_tokens_org ON refresh_tokens(organization_id);
CREATE INDEX idx_refresh_tokens_expires ON refresh_tokens(expires_at);

CREATE INDEX idx_organizations_slug ON organizations(slug);
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_events_org ON events(organization_id);
CREATE INDEX idx_events_slug ON events(slug);
CREATE UNIQUE INDEX ux_events_public_slug ON events(slug);
CREATE INDEX idx_events_starts ON events(starts_at);
CREATE INDEX idx_events_org_status ON events(organization_id, status);
CREATE INDEX idx_ticket_types_event ON ticket_types(event_id);
CREATE INDEX idx_ticket_types_event_status ON ticket_types(event_id, status);
CREATE INDEX idx_orders_event ON orders(event_id);
CREATE INDEX idx_orders_attendee ON orders(buyer_attendee_id);
CREATE INDEX idx_orders_public_code ON orders(public_code);
CREATE INDEX idx_orders_status ON orders(status);
CREATE INDEX idx_orders_event_status ON orders(event_id, status);
CREATE INDEX idx_payments_order ON payments(order_id);
CREATE INDEX idx_payments_provider_id ON payments(provider_payment_id);
CREATE INDEX idx_payments_status ON payments(status);
CREATE INDEX idx_payments_order_status ON payments(order_id, status);
CREATE INDEX idx_webhooks_provider_event ON payment_webhooks(provider_event_id);
CREATE INDEX idx_tickets_event ON tickets(event_id);
CREATE INDEX idx_tickets_attendee ON tickets(attendee_id);
CREATE INDEX idx_tickets_public_code ON tickets(public_code);
CREATE INDEX idx_tickets_qr_hash ON tickets(qr_token_hash);
CREATE INDEX idx_tickets_status ON tickets(status);
CREATE INDEX idx_tickets_event_status ON tickets(event_id, status);
CREATE INDEX idx_checkins_event ON checkins(event_id);
CREATE INDEX idx_checkins_ticket ON checkins(ticket_id);
CREATE INDEX idx_checkins_scanned ON checkins(scanned_at);
CREATE INDEX idx_checkins_event_scanned ON checkins(event_id, scanned_at);
CREATE INDEX idx_attendees_email ON attendees(email);
CREATE INDEX idx_attendees_phone ON attendees(phone);
CREATE INDEX idx_attendees_document_hash ON attendees(document_number_hash);

CREATE INDEX idx_event_staff_event ON event_staff(event_id);
CREATE INDEX idx_event_staff_user ON event_staff(user_id);
CREATE UNIQUE INDEX ux_event_staff_without_point ON event_staff(event_id, user_id) WHERE access_point_id IS NULL;
CREATE INDEX idx_audit_logs_org_created ON audit_logs(organization_id, created_at);
