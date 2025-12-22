-- JARVIS MVP Schema Migration
-- Version: 001
-- Database: jarvis_mvp
-- Created: 2025-12-22

-- Enable UUID extension (usually enabled by default in Cloud SQL)
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- =============================================================================
-- USERS TABLE
-- =============================================================================
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    external_id VARCHAR(255) UNIQUE NOT NULL,
    display_name VARCHAR(255),
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

COMMENT ON TABLE users IS 'User accounts identified by external auth provider ID';

-- =============================================================================
-- SESSIONS TABLE
-- =============================================================================
CREATE TABLE IF NOT EXISTS sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    started_at TIMESTAMPTZ DEFAULT now(),
    ended_at TIMESTAMPTZ,
    metadata JSONB DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_sessions_user_started 
    ON sessions(user_id, started_at DESC);

CREATE INDEX IF NOT EXISTS idx_sessions_active
    ON sessions(user_id) WHERE ended_at IS NULL;

COMMENT ON TABLE sessions IS 'Conversation sessions for each user';

-- =============================================================================
-- MESSAGES TABLE (append-only transcript)
-- =============================================================================
CREATE TABLE IF NOT EXISTS messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
    role VARCHAR(20) NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
    content TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_messages_session 
    ON messages(session_id, created_at);

COMMENT ON TABLE messages IS 'Append-only transcript of conversation messages';

-- =============================================================================
-- MEMORY FACTS TABLE
-- =============================================================================
CREATE TABLE IF NOT EXISTS memory_facts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    fact_key VARCHAR(255) NOT NULL,
    fact_value TEXT NOT NULL,
    confidence DECIMAL(3,2) DEFAULT 1.00 CHECK (confidence >= 0 AND confidence <= 1),
    source_message_id UUID REFERENCES messages(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    
    UNIQUE(user_id, fact_key)
);

CREATE INDEX IF NOT EXISTS idx_memory_facts_user 
    ON memory_facts(user_id);

CREATE INDEX IF NOT EXISTS idx_memory_facts_key 
    ON memory_facts(fact_key);

COMMENT ON TABLE memory_facts IS 'Extracted facts from conversations for memory recall';

-- =============================================================================
-- SCHEMA VERSION TRACKING
-- =============================================================================
CREATE TABLE IF NOT EXISTS schema_migrations (
    version VARCHAR(20) PRIMARY KEY,
    applied_at TIMESTAMPTZ DEFAULT now()
);

INSERT INTO schema_migrations (version) VALUES ('001')
ON CONFLICT (version) DO NOTHING;
