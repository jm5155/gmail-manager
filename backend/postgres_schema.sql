-- Gmail Intelligence Manager - Postgres Schema
-- Generated: 2026-07-21
-- Purpose: Migration from SQLite to Postgres for Railway deployment
-- Tables: 6 (users, custom_labels, scan_cursor, analyzed_emails, url_cache, retry_queue)

-- Enable UUID extension (optional, for future use)
-- CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- TABLE 1: users
-- Stores Gmail OAuth tokens and user information
CREATE TABLE IF NOT EXISTS users (
    user_id SERIAL PRIMARY KEY,
    gmail_address TEXT UNIQUE NOT NULL,
    access_token TEXT,
    created_at TIMESTAMP DEFAULT NOW(),
    delete_mode TEXT DEFAULT 'trash'
);

-- TABLE 2: custom_labels
-- User-defined email classification labels with colors
CREATE TABLE IF NOT EXISTS custom_labels (
    label_id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL,
    label_name TEXT NOT NULL,
    bg_color TEXT DEFAULT '#3B82F6',
    text_color TEXT DEFAULT '#FFFFFF',
    created_at TIMESTAMP DEFAULT NOW(),
    FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE
);

-- TABLE 3: scan_cursor
-- Pagination state for Gmail API fetching
CREATE TABLE IF NOT EXISTS scan_cursor (
    cursor_id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL UNIQUE,
    last_page_token TEXT,
    last_scan_at TIMESTAMP DEFAULT NOW(),
    FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE
);

-- TABLE 4: analyzed_emails
-- Main email data with AI classification results
CREATE TABLE IF NOT EXISTS analyzed_emails (
    email_id TEXT PRIMARY KEY,
    user_id INTEGER NOT NULL,
    label_id INTEGER,
    scam_score INTEGER,
    scam_indicators TEXT DEFAULT '[]',
    is_quarantined INTEGER DEFAULT 0,
    snippet TEXT,
    sender TEXT,
    subject TEXT,
    status TEXT NOT NULL DEFAULT 'labeled',
    analyzed_at TIMESTAMP DEFAULT NOW(),
    body TEXT,
    applied_to_gmail INTEGER DEFAULT 0,
    last_applied_label_id INTEGER DEFAULT NULL,
    FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE,
    FOREIGN KEY (label_id) REFERENCES custom_labels(label_id) ON DELETE RESTRICT
);

-- TABLE 5: url_cache
-- Security scan results for URLs extracted from emails
CREATE TABLE IF NOT EXISTS url_cache (
    url_id SERIAL PRIMARY KEY,
    email_id TEXT NOT NULL,
    url TEXT NOT NULL,
    is_safe INTEGER DEFAULT 1,
    threat_type TEXT,
    checked_at TIMESTAMP DEFAULT NOW(),
    FOREIGN KEY (email_id) REFERENCES analyzed_emails(email_id) ON DELETE CASCADE
);

-- TABLE 6: retry_queue
-- Failed AI analysis attempts for retry processing
CREATE TABLE IF NOT EXISTS retry_queue (
    retry_id SERIAL PRIMARY KEY,
    email_id TEXT NOT NULL UNIQUE,
    retry_count INTEGER DEFAULT 0,
    last_attempted TIMESTAMP,
    error_reason TEXT,
    FOREIGN KEY (email_id) REFERENCES analyzed_emails(email_id) ON DELETE CASCADE
);

-- Create indexes for performance (optional but recommended)
CREATE INDEX IF NOT EXISTS idx_custom_labels_user_id ON custom_labels(user_id);
CREATE INDEX IF NOT EXISTS idx_analyzed_emails_user_id ON analyzed_emails(user_id);
CREATE INDEX IF NOT EXISTS idx_analyzed_emails_label_id ON analyzed_emails(label_id);
CREATE INDEX IF NOT EXISTS idx_analyzed_emails_status ON analyzed_emails(status);
CREATE INDEX IF NOT EXISTS idx_analyzed_emails_applied_to_gmail ON analyzed_emails(applied_to_gmail);
CREATE INDEX IF NOT EXISTS idx_url_cache_email_id ON url_cache(email_id);
CREATE INDEX IF NOT EXISTS idx_retry_queue_email_id ON retry_queue(email_id);

-- Notes:
-- 1. INTEGER used for boolean fields (0/1) to match SQLite behavior
-- 2. TEXT used for scam_indicators (JSON string) to match SQLite behavior
-- 3. SERIAL used instead of INTEGER PRIMARY KEY AUTOINCREMENT
-- 4. NOW() used instead of CURRENT_TIMESTAMP for Postgres convention
-- 5. All foreign key constraints preserved (CASCADE and RESTRICT)
