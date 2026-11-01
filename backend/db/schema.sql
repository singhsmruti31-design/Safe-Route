-- ============================================================
-- Safe Route App - Database Schema
-- Target: PostgreSQL with PostGIS extension (Supabase compatible)
-- ============================================================

-- 1. Enable PostGIS Extension
CREATE EXTENSION IF NOT EXISTS postgis;

-- 2. Places Table (OSM Help Points: Police, Hospitals, Pharmacies, Fuel, 24/7 Shops, ATMs)
CREATE TABLE IF NOT EXISTS places (
    id BIGSERIAL PRIMARY KEY,
    osm_id BIGINT UNIQUE NOT NULL,
    type VARCHAR(50) NOT NULL, -- 'police', 'hospital', 'pharmacy', 'fuel', 'shop24', 'atm'
    name VARCHAR(255),
    geom geography(Point, 4326) NOT NULL,
    opening_hours TEXT,
    is_24_7 BOOLEAN DEFAULT FALSE,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Spatial index on places geometry
CREATE INDEX IF NOT EXISTS idx_places_geom ON places USING GIST (geom);

-- Additional query indexes on places
CREATE INDEX IF NOT EXISTS idx_places_type ON places (type);
CREATE INDEX IF NOT EXISTS idx_places_is_24_7 ON places (is_24_7);

-- 3. Reports Table (Anonymous Community Safety Reports)
CREATE TABLE IF NOT EXISTS reports (
    id BIGSERIAL PRIMARY KEY,
    geom geography(Point, 4326) NOT NULL,
    type VARCHAR(50) NOT NULL, -- 'isolated', 'felt_unsafe', 'dark', 'harassment', 'safe_spot'
    note VARCHAR(200),
    status VARCHAR(20) DEFAULT 'pending', -- 'pending', 'approved', 'rejected'
    ip_hash VARCHAR(64) NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Spatial index on reports geometry
CREATE INDEX IF NOT EXISTS idx_reports_geom ON reports USING GIST (geom);

-- Status & spam prevention index
CREATE INDEX IF NOT EXISTS idx_reports_status ON reports (status);
CREATE INDEX IF NOT EXISTS idx_reports_ip_created ON reports (ip_hash, created_at);

-- 4. Users Table (Authentication & User Profiles)
CREATE TABLE IF NOT EXISTS users (
    id BIGSERIAL PRIMARY KEY,
    full_name VARCHAR(150) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    mobile VARCHAR(30),
    password_hash VARCHAR(255) NOT NULL,
    photo_url TEXT,
    email_verified BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_users_email ON users (LOWER(email));

-- 5. Password Resets Table
CREATE TABLE IF NOT EXISTS password_resets (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT REFERENCES users(id) ON DELETE CASCADE,
    token_hash VARCHAR(64) NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    used BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_password_resets_token ON password_resets (token_hash);

-- 6. Emergency Contacts Table
CREATE TABLE IF NOT EXISTS emergency_contacts (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name VARCHAR(150) NOT NULL,
    phone VARCHAR(50) NOT NULL,
    relationship VARCHAR(50) DEFAULT 'Other',
    is_primary BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_contacts_user_id ON emergency_contacts (user_id);

-- 7. Saved Routes Table
CREATE TABLE IF NOT EXISTS saved_routes (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    summary VARCHAR(255),
    distance NUMERIC,
    duration NUMERIC,
    provider VARCHAR(100),
    safety_score NUMERIC,
    coordinates JSONB DEFAULT '[]'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_saved_routes_user_id ON saved_routes (user_id);
