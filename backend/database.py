"""
database.py — Database Module (Postgres Compatible)
Multi-user schema with 6 tables: users, custom_labels, scan_cursor,
analyzed_emails, url_cache, retry_queue.
All queries are parameterized to prevent SQL injection.
Supports both SQLite (local dev) and Postgres (production/Railway).
"""

import os
import json
from pathlib import Path
from datetime import datetime, timedelta

# Detect database type from environment
DATABASE_URL = os.getenv("DATABASE_URL")  # Railway Postgres connection string
USE_POSTGRES = DATABASE_URL is not None

if USE_POSTGRES:
    import psycopg2
    from psycopg2.extras import RealDictCursor
    print("[DB] Using Postgres (DATABASE_URL detected)")
else:
    import sqlite3
    DB_PATH = Path(__file__).parent / "gmail_manager.db"
    print(f"[DB] Using SQLite (local dev mode): {DB_PATH}")


def _get_connection():
    """
    Create a database connection (Postgres or SQLite based on environment).
    Returns a connection with dict-like row access.
    """
    if USE_POSTGRES:
        # Postgres connection (Railway production)
        conn = psycopg2.connect(DATABASE_URL, cursor_factory=RealDictCursor)
        return conn
    else:
        # SQLite connection (local development)
        conn = sqlite3.connect(str(DB_PATH), timeout=30.0)
        conn.row_factory = sqlite3.Row
        conn.execute("PRAGMA foreign_keys = ON")
        conn.execute("PRAGMA journal_mode = WAL")
        return conn


def init_db():
    """
    Initialize the database (Postgres or SQLite).
    Creates all 6 tables in the required order if they don't already exist.
    Called at FastAPI startup.
    """
    conn = _get_connection()
    try:
        cursor = conn.cursor()

        # Determine SQL syntax based on database type
        pk_syntax = "SERIAL PRIMARY KEY" if USE_POSTGRES else "INTEGER PRIMARY KEY AUTOINCREMENT"
        timestamp_default = "DEFAULT NOW()" if USE_POSTGRES else "DEFAULT CURRENT_TIMESTAMP"

        # TABLE 1: users
        cursor.execute(f"""
            CREATE TABLE IF NOT EXISTS users (
                user_id {pk_syntax},
                gmail_address TEXT UNIQUE NOT NULL,
                access_token TEXT,
                delete_mode TEXT DEFAULT 'trash',
                created_at TIMESTAMP {timestamp_default}
            )
        """)

        # Migration: add delete_mode column if table already exists without it (SQLite only)
        if not USE_POSTGRES:
            try:
                cursor.execute("ALTER TABLE users ADD COLUMN delete_mode TEXT DEFAULT 'trash'")
                print("[DB] Migrated: added delete_mode column to users table")
            except Exception:
                pass  # Column already exists

        # TABLE 2: custom_labels
        cursor.execute(f"""
            CREATE TABLE IF NOT EXISTS custom_labels (
                label_id {pk_syntax},
                user_id INTEGER NOT NULL,
                label_name TEXT NOT NULL,
                bg_color TEXT DEFAULT '#3B82F6',
                text_color TEXT DEFAULT '#FFFFFF',
                created_at TIMESTAMP {timestamp_default},
                FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE
            )
        """)

        # TABLE 3: scan_cursor
        cursor.execute(f"""
            CREATE TABLE IF NOT EXISTS scan_cursor (
                cursor_id {pk_syntax},
                user_id INTEGER NOT NULL UNIQUE,
                last_page_token TEXT,
                last_scan_at TIMESTAMP {timestamp_default},
                FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE
            )
        """)

        # TABLE 4: analyzed_emails
        cursor.execute(f"""
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
                analyzed_at TIMESTAMP {timestamp_default},
                body TEXT,
                applied_to_gmail INTEGER DEFAULT 0,
                last_applied_label_id INTEGER DEFAULT NULL,
                FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE,
                FOREIGN KEY (label_id) REFERENCES custom_labels(label_id) ON DELETE RESTRICT
            )
        """)

        # TABLE 5: url_cache
        cursor.execute(f"""
            CREATE TABLE IF NOT EXISTS url_cache (
                url_id {pk_syntax},
                email_id TEXT NOT NULL,
                url TEXT NOT NULL,
                is_safe INTEGER DEFAULT 1,
                threat_type TEXT,
                checked_at TIMESTAMP {timestamp_default},
                FOREIGN KEY (email_id) REFERENCES analyzed_emails(email_id) ON DELETE CASCADE
            )
        """)

        # TABLE 6: retry_queue
        cursor.execute(f"""
            CREATE TABLE IF NOT EXISTS retry_queue (
                retry_id {pk_syntax},
                email_id TEXT NOT NULL UNIQUE,
                retry_count INTEGER DEFAULT 0,
                last_attempted TIMESTAMP,
                error_reason TEXT,
                FOREIGN KEY (email_id) REFERENCES analyzed_emails(email_id) ON DELETE CASCADE
            )
        """)

        # Migration: add applied_to_gmail and last_applied_label_id columns if not exist (Phase 38)
        if USE_POSTGRES:
            # Postgres: use information_schema to check column existence
            cursor.execute("""
                SELECT column_name FROM information_schema.columns
                WHERE table_name = %s ORDER BY ordinal_position
            """, ('analyzed_emails',))
            columns = [row['column_name'] for row in cursor.fetchall()]
        else:
            # SQLite: use PRAGMA table_info
            cursor.execute("PRAGMA table_info(analyzed_emails)")
            columns = [row[1] for row in cursor.fetchall()]

        if 'applied_to_gmail' not in columns:
            print("[DB MIGRATION] Adding applied_to_gmail column to analyzed_emails...")
            cursor.execute("""
                ALTER TABLE analyzed_emails
                ADD COLUMN applied_to_gmail INTEGER DEFAULT 0
            """)
            conn.commit()
            print("[DB MIGRATION] applied_to_gmail column added successfully.")

        if 'last_applied_label_id' not in columns:
            print("[DB MIGRATION] Adding last_applied_label_id column to analyzed_emails...")
            cursor.execute("""
                ALTER TABLE analyzed_emails
                ADD COLUMN last_applied_label_id INTEGER DEFAULT NULL
            """)
            conn.commit()
            print("[DB MIGRATION] last_applied_label_id column added successfully.")

        conn.commit()
        db_type = "Postgres" if USE_POSTGRES else "SQLite"
        db_location = DATABASE_URL[:50] + "..." if USE_POSTGRES else str(DB_PATH)
        print(f"[DB] Database initialized ({db_type}): {db_location}")
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()


# ---------- SEED DEFAULT LABELS ----------

def seed_default_labels(user_id: int):
    """
    Seed 8 default labels for a user if they have zero labels.
    Called after a user logs in for the first time.
    """
    conn = _get_connection()
    try:
        cursor = conn.cursor()

        cursor.execute("SELECT COUNT(*) FROM custom_labels WHERE user_id = %s", (user_id,))
        count = cursor.fetchone()['count']

        if count == 0:
            defaults = [
                (user_id, "Work", "#1D4ED8", "#FFFFFF"),
                (user_id, "Finance", "#15803D", "#FFFFFF"),
                (user_id, "Newsletter", "#7C3AED", "#FFFFFF"),
                (user_id, "Promotional", "#B45309", "#FFFFFF"),
                (user_id, "Personal", "#0369A1", "#FFFFFF"),
                (user_id, "Spam", "#DC2626", "#FFFFFF"),
                (user_id, "Social", "#0891B2", "#FFFFFF"),
                (user_id, "Receipt", "#065F46", "#FFFFFF"),
            ]
            cursor.executemany(
                "INSERT INTO custom_labels (user_id, label_name, bg_color, text_color) VALUES (%s, %s, %s, %s)",
                defaults,
            )
            conn.commit()
            print(f"[DB] Seeded 8 default labels for user_id={user_id}")
        else:
            print(f"[DB] User {user_id} already has {count} labels, skipping seed.")
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()


# ---------- USER MANAGEMENT ----------

def upsert_user(gmail_address: str, access_token: str) -> int:
    """Insert or update user, return user_id."""
    conn = _get_connection()
    try:
        cursor = conn.cursor()

        cursor.execute(
            """
            INSERT INTO users (gmail_address, access_token)
            VALUES (%s, %s)
            ON CONFLICT(gmail_address) DO UPDATE SET access_token = excluded.access_token
            """,
            (gmail_address, access_token),
        )
        conn.commit()

        cursor.execute("SELECT user_id FROM users WHERE gmail_address = %s", (gmail_address,))
        user_id = cursor.fetchone()['user_id']

        print(f"[DB] Upserted user '{gmail_address}' -> user_id={user_id}")
        return user_id
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()


def get_user_id(gmail_address: str) -> int:
    """Return user_id for given gmail_address."""
    conn = _get_connection()
    try:
        cursor = conn.cursor()
        cursor.execute("SELECT user_id FROM users WHERE gmail_address = %s", (gmail_address,))
        row = cursor.fetchone()

        if row is None:
            raise ValueError(f"User not found: {gmail_address}")
        return row['user_id']
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()


# ---------- LABEL MANAGEMENT ----------

def get_labels(user_id: int) -> list[dict]:
    """Return list of {label_id, label_name, bg_color, text_color} for a user."""
    conn = _get_connection()
    try:
        cursor = conn.cursor()
        cursor.execute(
            "SELECT label_id, label_name, bg_color, text_color FROM custom_labels WHERE user_id = %s ORDER BY created_at ASC",
            (user_id,),
        )
        rows = cursor.fetchall()
        return [dict(row) for row in rows]
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()


def get_label_id_by_name(user_id: int, label_name: str) -> int:
    """
    Return label_id for given label_name and user_id.
    If exact name not found, try case-insensitive match, then fall back
    to the first available custom label for that user.
    """
    conn = _get_connection()
    try:
        cursor = conn.cursor()

        # 1. Exact match
        cursor.execute(
            "SELECT label_id FROM custom_labels WHERE user_id = %s AND label_name = %s",
            (user_id, label_name),
        )
        row = cursor.fetchone()
        if row:
            return row['label_id']

        # 2. Case-insensitive match (AI may return "work" instead of "Work")
        cursor.execute(
            "SELECT label_id FROM custom_labels WHERE user_id = %s AND LOWER(label_name) = LOWER(%s)",
            (user_id, label_name),
        )
        ci_row = cursor.fetchone()
        if ci_row:
            return ci_row['label_id']

        # 3. Fallback — first available label for this user
        cursor.execute(
            "SELECT label_id, label_name FROM custom_labels WHERE user_id = %s ORDER BY label_id ASC LIMIT 1",
            (user_id,),
        )
        fallback = cursor.fetchone()

        if fallback:
            print(f"[DB] Label '{label_name}' not found, falling back to '{fallback[1]}' (id={fallback[0]})")
            return fallback[0]

        raise ValueError(f"No labels found for user_id={user_id}. Create at least one label.")
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()


def add_label(user_id: int, label_name: str, bg_color: str, text_color: str) -> int:
    """Insert new label, return label_id."""
    conn = _get_connection()
    try:
        cursor = conn.cursor()
        cursor.execute(
            "INSERT INTO custom_labels (user_id, label_name, bg_color, text_color) VALUES (%s, %s, %s, %s)",
            (user_id, label_name, bg_color, text_color),
        )
        conn.commit()
        label_id = cursor.lastrowid
        print(f"[DB] Added label '{label_name}' (id={label_id}) for user_id={user_id}")
        return label_id
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()


def delete_label(label_id: int, user_id: int) -> None:
    """Delete label only if user_id matches."""
    conn = _get_connection()
    try:
        cursor = conn.cursor()
        cursor.execute(
            "DELETE FROM custom_labels WHERE label_id = %s AND user_id = %s",
            (label_id, user_id),
        )
        conn.commit()
        print(f"[DB] Deleted label_id={label_id} for user_id={user_id}")
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()


# ---------- ANALYZED EMAILS ----------

def save_analyzed_email(email_id: str, user_id: int, label_id: int, scam_score: int,
                         scam_indicators: str, is_quarantined: int,
                         snippet: str, sender: str, subject: str,
                         status: str = 'labeled', body: str = None) -> None:
    """Insert or update (upsert) analyzed_email record."""
    conn = _get_connection()
    try:
        cursor = conn.cursor()
        
        if USE_POSTGRES:
            # Postgres: Use ON CONFLICT for upsert
            cursor.execute("""
                INSERT INTO analyzed_emails
                (email_id, user_id, label_id, scam_score, scam_indicators, is_quarantined, snippet, sender, subject, status, body)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                ON CONFLICT (email_id) DO UPDATE SET
                    user_id = EXCLUDED.user_id,
                    label_id = EXCLUDED.label_id,
                    scam_score = EXCLUDED.scam_score,
                    scam_indicators = EXCLUDED.scam_indicators,
                    is_quarantined = EXCLUDED.is_quarantined,
                    snippet = EXCLUDED.snippet,
                    sender = EXCLUDED.sender,
                    subject = EXCLUDED.subject,
                    status = EXCLUDED.status,
                    body = EXCLUDED.body
            """, (email_id, user_id, label_id, scam_score, scam_indicators, is_quarantined, snippet, sender, subject, status, body))
        else:
            # SQLite: Use INSERT OR REPLACE
            cursor.execute("""
                INSERT OR REPLACE INTO analyzed_emails
                (email_id, user_id, label_id, scam_score, scam_indicators, is_quarantined, snippet, sender, subject, status, body)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
            """, (email_id, user_id, label_id, scam_score, scam_indicators, is_quarantined, snippet, sender, subject, status, body))
        
        conn.commit()
        print(f"[DB] Saved email {email_id[:12]}... label_id={label_id}, scam_score={scam_score}, status={status}")
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()


def update_analyzed_email(email_id: str, label_id: int, scam_score: int,
                          scam_indicators: str, is_quarantined: int, status: str = 'labeled') -> None:
    """
    Update an existing analyzed_emails row with AI results.
    Preserves the original analyzed_at timestamp and body.
    Used by label_only_pipeline via _analyze_one(update_mode=True).
    """
    conn = _get_connection()
    try:
        cursor = conn.cursor()
        cursor.execute("""
            UPDATE analyzed_emails
            SET label_id = %s,
                scam_score = %s,
                scam_indicators = %s,
                is_quarantined = %s,
                status = %s
            WHERE email_id = %s
        """, (label_id, scam_score, scam_indicators, is_quarantined, status, email_id))
        conn.commit()
        print(f"[DB] Updated email {email_id[:12]}... to status={status}, label_id={label_id}, score={scam_score}")
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()


def update_email_label_id(email_id: str, label_id: int) -> None:
    """
    Update only the label_id for an email (manual label override).
    Does NOT touch scam_score, scam_indicators, or is_quarantined.
    Sets applied_to_gmail=0 (needs re-applying).
    Does NOT update last_applied_label_id (only _sync_label_to_gmail does that).
    """
    conn = _get_connection()
    try:
        cursor = conn.cursor()
        cursor.execute("""
            UPDATE analyzed_emails
            SET label_id = %s, applied_to_gmail = 0
            WHERE email_id = %s
        """, (label_id, email_id))
        conn.commit()
        print(f"[DB] Updated label_id for email {email_id[:12]}... to {label_id}, marked as pending")
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()


def get_emails_by_status(user_id: int, status: str, limit: int = None) -> list[dict]:
    """
    Return emails with a specific status, ordered by analyzed_at ASC.
    Used by label_only_pipeline to fetch status='fetched' rows.
    """
    conn = _get_connection()
    try:
        cursor = conn.cursor()

        # Parameterized LIMIT
        if limit:
            cursor.execute("""
                SELECT email_id, user_id, snippet, sender, subject, body, analyzed_at
                FROM analyzed_emails
                WHERE user_id = %s AND status = %s
                ORDER BY analyzed_at ASC
                LIMIT %s
            """, (user_id, status, limit))
        else:
            cursor.execute("""
                SELECT email_id, user_id, snippet, sender, subject, body, analyzed_at
                FROM analyzed_emails
                WHERE user_id = %s AND status = %s
                ORDER BY analyzed_at ASC
            """, (user_id, status))

        rows = cursor.fetchall()

        # Convert to dict format expected by _analyze_one
        return [
            {
                "id": row['email_id'],
                "user_id": row['user_id'],
                "snippet": row['snippet'] or "",
                "sender": row['sender'] or "",
                "subject": row['subject'] or "",
                "body": row['body'] or "",
                "analyzed_at": row['analyzed_at'],
                "from": row['sender'] or "",  # Map sender to "from" for compatibility
            }
            for row in rows
        ]
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()



def is_already_analyzed(email_id: str, user_id: int) -> bool:
    """Return True if email_id exists in analyzed_emails for this user_id."""
    conn = _get_connection()
    try:
        cursor = conn.cursor()
        cursor.execute(
            "SELECT 1 FROM analyzed_emails WHERE email_id = %s AND user_id = %s",
            (email_id, user_id),
        )
        result = cursor.fetchone() is not None
        return result
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()


def get_analyzed_emails(user_id: int) -> list[dict]:
    """
    Return all analyzed emails for user joined with custom_labels.
    Excludes emails that are still in the retry_queue (placeholder rows
    saved before analysis completed — they carry false labels).
    Each dict contains: email_id, label_name, bg_color, text_color,
    scam_score, scam_indicators, is_quarantined, snippet, sender, subject, analyzed_at, body,
    applied_to_gmail, last_applied_label_id, label_id
    """
    conn = _get_connection()
    try:
        cursor = conn.cursor()
        cursor.execute(
            """
            SELECT ae.email_id, cl.label_name, cl.bg_color, cl.text_color,
                   ae.scam_score, ae.scam_indicators, ae.is_quarantined,
                   ae.snippet, ae.sender, ae.subject, ae.analyzed_at, ae.body,
                   ae.applied_to_gmail, ae.last_applied_label_id, ae.label_id
            FROM analyzed_emails ae
            LEFT JOIN custom_labels cl ON ae.label_id = cl.label_id
            LEFT JOIN retry_queue rq ON ae.email_id = rq.email_id
            WHERE ae.user_id = %s
              AND rq.email_id IS NULL
            ORDER BY ae.analyzed_at DESC
            """,
            (user_id,),
        )
        rows = cursor.fetchall()
        return [dict(row) for row in rows]
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()


# ---------- URL CACHE ----------

def save_url_result(email_id: str, url: str, is_safe: int, threat_type: str) -> None:
    """Insert one URL result, ignore if same email_id + url already exists."""
    conn = _get_connection()
    try:
        cursor = conn.cursor()

        # Check for existing entry with same email_id + url
        cursor.execute(
            "SELECT 1 FROM url_cache WHERE email_id = %s AND url = %s",
            (email_id, url),
        )
        if cursor.fetchone() is not None:
            return

        cursor.execute(
            "INSERT INTO url_cache (email_id, url, is_safe, threat_type) VALUES (%s, %s, %s, %s)",
            (email_id, url, is_safe, threat_type),
        )
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()


def get_cached_url(url: str) -> dict | None:
    """
    Return most recent url_cache row for this url, or None.
    Only return if checked_at is within last 24 hours.
    """
    conn = _get_connection()
    try:
        cursor = conn.cursor()
        cursor.execute(
            "SELECT url, is_safe, threat_type, checked_at FROM url_cache WHERE url = %s ORDER BY checked_at DESC LIMIT 1",
            (url,),
        )
        row = cursor.fetchone()

        if not row:
            return None

        row_dict = dict(row)

        # Check if cache is less than 24 hours old
        try:
            checked_at = datetime.fromisoformat(row_dict["checked_at"])
            if datetime.now() - checked_at > timedelta(hours=24):
                return None  # Cache expired
        except (ValueError, TypeError):
            return None

        return {
            "url": row_dict["url"],
            "is_safe": row_dict["is_safe"],
            "threat_type": row_dict["threat_type"],
        }
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()


# ---------- RETRY QUEUE ----------

def add_to_retry_queue(email_id: str, error_reason: str) -> None:
    """
    Insert into retry_queue, update retry_count if email_id already exists.
    Do not insert if retry_count >= 3.
    """
    conn = _get_connection()
    try:
        cursor = conn.cursor()

        # Check if already in queue
        cursor.execute("SELECT retry_count FROM retry_queue WHERE email_id = %s", (email_id,))
        row = cursor.fetchone()

        if row is not None:
            if row['retry_count'] >= 3:
                print(f"[DB] Retry limit reached for {email_id[:12]}..., not re-adding")
                return
            cursor.execute(
                """
                UPDATE retry_queue
                SET retry_count = retry_count + 1, last_attempted = CURRENT_TIMESTAMP, error_reason = %s
                WHERE email_id = %s
                """,
                (error_reason, email_id),
            )
        else:
            cursor.execute(
                """
                INSERT INTO retry_queue (email_id, retry_count, last_attempted, error_reason)
                VALUES (%s, 0, CURRENT_TIMESTAMP, %s)
                """,
                (email_id, error_reason),
            )

        conn.commit()
        print(f"[DB] Added/updated {email_id[:12]}... in retry queue")
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()


def get_retry_queue(user_id: int) -> list[dict]:
    """Return retry_queue rows joined with analyzed_emails for this user_id."""
    conn = _get_connection()
    try:
        cursor = conn.cursor()
        cursor.execute(
            """
            SELECT rq.retry_id, rq.email_id, rq.retry_count, rq.last_attempted, rq.error_reason
            FROM retry_queue rq
            JOIN analyzed_emails ae ON rq.email_id = ae.email_id
            WHERE ae.user_id = %s
            ORDER BY rq.last_attempted ASC
            """,
            (user_id,),
        )
        rows = cursor.fetchall()
        return [dict(row) for row in rows]
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()


def remove_from_retry_queue(email_id: str) -> None:
    """Delete row from retry_queue by email_id."""
    conn = _get_connection()
    try:
        cursor = conn.cursor()
        cursor.execute("DELETE FROM retry_queue WHERE email_id = %s", (email_id,))
        conn.commit()
        print(f"[DB] Removed {email_id[:12]}... from retry queue")
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()


# ---------- SCAN CURSOR ----------

def get_scan_cursor(user_id: int) -> str | None:
    """Return last_page_token for user_id, or None."""
    conn = _get_connection()
    try:
        cursor = conn.cursor()
        cursor.execute("SELECT last_page_token FROM scan_cursor WHERE user_id = %s", (user_id,))
        row = cursor.fetchone()
        return row['last_page_token'] if row else None
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()


def save_scan_cursor(user_id: int, last_page_token: str) -> None:
    """Upsert scan_cursor for user_id."""
    conn = _get_connection()
    try:
        cursor = conn.cursor()
        cursor.execute(
            """
            INSERT INTO scan_cursor (user_id, last_page_token, last_scan_at)
            VALUES (%s, %s, CURRENT_TIMESTAMP)
            ON CONFLICT(user_id) DO UPDATE SET last_page_token = excluded.last_page_token,
                                               last_scan_at = CURRENT_TIMESTAMP
            """,
            (user_id, last_page_token),
        )
        conn.commit()
        print(f"[DB] Saved scan cursor for user_id={user_id}: {last_page_token[:20] if last_page_token else 'None'}...")
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()


def clear_scan_cursor(user_id: int) -> None:
    """Set last_page_token to NULL for user_id."""
    conn = _get_connection()
    try:
        cursor = conn.cursor()
        cursor.execute(
            "UPDATE scan_cursor SET last_page_token = NULL WHERE user_id = %s",
            (user_id,),
        )
        conn.commit()
        print(f"[DB] Cleared scan cursor for user_id={user_id}")
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()


# ---------- ADMIN ----------

def reset_database(user_id: int) -> None:
    """
    Delete all analyzed_emails, url_cache, retry_queue, scan_cursor for this user_id.
    Do NOT delete users or custom_labels.
    """
    conn = _get_connection()
    try:
        cursor = conn.cursor()

        # Delete in FK-safe order (children first)
        # url_cache and retry_queue reference analyzed_emails, so delete those first
        cursor.execute(
            "DELETE FROM url_cache WHERE email_id IN (SELECT email_id FROM analyzed_emails WHERE user_id = %s)",
            (user_id,),
        )
        cursor.execute(
            "DELETE FROM retry_queue WHERE email_id IN (SELECT email_id FROM analyzed_emails WHERE user_id = %s)",
            (user_id,),
        )
        cursor.execute("DELETE FROM analyzed_emails WHERE user_id = %s", (user_id,))
        cursor.execute("DELETE FROM scan_cursor WHERE user_id = %s", (user_id,))

        conn.commit()
        print(f"[DB] Reset all analysis data for user_id={user_id}")
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()


def mark_email_safe(email_id: str, user_id: int) -> None:
    """Set is_quarantined = 0 and scam_score = 0 for this email_id and user_id."""
    conn = _get_connection()
    try:
        cursor = conn.cursor()
        cursor.execute(
            "UPDATE analyzed_emails SET is_quarantined = 0, scam_score = 0 WHERE email_id = %s AND user_id = %s",
            (email_id, user_id),
        )
        conn.commit()
        print(f"[DB] Marked email {email_id[:12]}... as safe for user_id={user_id}")
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()


# ---------- DELETE MODE ----------

def get_delete_mode(user_id: int) -> str:
    """Return 'trash' or 'permanent' for the given user_id."""
    conn = _get_connection()
    try:
        cursor = conn.cursor()
        cursor.execute("SELECT delete_mode FROM users WHERE user_id = %s", (user_id,))
        row = cursor.fetchone()
        return row['delete_mode'] if row and row['delete_mode'] else "trash"
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()


def set_delete_mode(user_id: int, mode: str) -> None:
    """Set delete_mode to 'trash' or 'permanent' for user_id."""
    if mode not in ("trash", "permanent"):
        raise ValueError(f"Invalid delete_mode: {mode}")
    conn = _get_connection()
    try:
        cursor = conn.cursor()
        cursor.execute(
            "UPDATE users SET delete_mode = %s WHERE user_id = %s",
            (mode, user_id),
        )
        conn.commit()
        print(f"[DB] Set delete_mode={mode} for user_id={user_id}")
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()
