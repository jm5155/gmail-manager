"""
auth.py — Google OAuth 2.0 Authentication Module (Restructured)
Handles the full OAuth flow: login URL generation, callback token exchange,
token persistence (token.json), automatic token refresh, and user upsert.
"""

from logger_setup import get_logger
logger = get_logger(__name__)

import os
import json
from pathlib import Path
from google_auth_oauthlib.flow import Flow
from google.auth.transport.requests import Request
from google.oauth2.credentials import Credentials
from dotenv import load_dotenv
from database import (
    save_user_token,
    get_user_token,
    delete_user_token,
)

# Load environment variables from .env file
load_dotenv()

# ---------- CONFIGURATION ----------

# OAuth 2.0 scopes required for Gmail access
SCOPES = [
    "openid",
    "https://www.googleapis.com/auth/userinfo.email",
    "https://www.googleapis.com/auth/userinfo.profile",
    "https://www.googleapis.com/auth/gmail.readonly",
    "https://www.googleapis.com/auth/gmail.labels",
    "https://www.googleapis.com/auth/gmail.modify",
    "https://www.googleapis.com/auth/gmail.compose",
    "https://www.googleapis.com/auth/gmail.settings.basic",
    "https://www.googleapis.com/auth/gmail.addons.current.action.compose",
    "https://www.googleapis.com/auth/gmail.addons.current.message.action",
    "https://www.googleapis.com/auth/drive.metadata",
    "https://www.googleapis.com/auth/drive.file",
    "https://mail.google.com/",
]

# Google OAuth credentials from environment variables
CLIENT_ID = os.getenv("GOOGLE_CLIENT_ID")
CLIENT_SECRET = os.getenv("GOOGLE_CLIENT_SECRET")
REDIRECT_URI = os.getenv("GOOGLE_REDIRECT_URI", "http://localhost:8000/auth/callback")

# Build the client config dict (equivalent to a client_secret.json file)
CLIENT_CONFIG = {
    "web": {
        "client_id": CLIENT_ID,
        "client_secret": CLIENT_SECRET,
        "auth_uri": "https://accounts.google.com/o/oauth2/auth",
        "token_uri": "https://oauth2.googleapis.com/token",
        "redirect_uris": [REDIRECT_URI],
    }
}


# ---------- TOKEN MANAGEMENT (DB-BACKED, per-user) ----------

def load_token(user_email: str) -> Credentials | None:
    """
    Load a user's saved OAuth token from the database (keyed by gmail_address).
    If the token is expired but has a refresh token, it is auto-refreshed and
    persisted back to the DB. Returns a Credentials object, or None.
    NOTE: user_email is required — there is no shared/legacy file fallback.
    """
    if not user_email:
        return None

    token_json = get_user_token(user_email)
    if not token_json:
        return None

    try:
        creds = Credentials.from_authorized_user_info(json.loads(token_json), SCOPES)

        if creds and creds.expired and creds.refresh_token:
            logger.info(f"[AUTH] Token expired for {user_email}, refreshing...")
            creds.refresh(Request())
            save_token(creds, user_email)
            logger.info(f"[AUTH] Token refreshed for {user_email}.")

        return creds if creds and creds.valid else None

    except Exception as e:
        logger.info(f"[AUTH] Error loading token for {user_email}: {e}")
        return None


def save_token(creds: Credentials, user_email: str) -> None:
    """
    Persist OAuth credentials to the database, keyed by the user's gmail_address.
    Replaces the old shared file-based token storage (security + ephemeral-FS fix).
    """
    if not user_email:
        raise ValueError("user_email is required to save a token (no shared file storage)")

    save_user_token(user_email, creds.to_json())
    logger.info(f"[AUTH] Token saved for user: {user_email}")


def delete_token(user_email: str = None) -> None:
    """
    Remove the saved token for a specific user (used on logout).
    No-op if user_email is not provided.
    """
    if not user_email:
        return
    delete_user_token(user_email)
    logger.info(f"[AUTH] Token deleted for {user_email}.")


def is_logged_in(user_email: str) -> bool:
    """
    Check if a valid (non-expired) token exists for the given user.
    user_email is required.
    """
    if not user_email:
        return False
    creds = load_token(user_email)
    return creds is not None and creds.valid


def _email_from_userinfo(creds: Credentials) -> str | None:
    """Best-effort: resolve the Gmail address from Google's userinfo endpoint."""
    if not creds or not creds.valid:
        return None
    try:
        import requests
        resp = requests.get(
            "https://www.googleapis.com/oauth2/v2/userinfo",
            headers={"Authorization": f"Bearer {creds.token}"},
            timeout=5,
        )
        if resp.status_code == 200:
            return resp.json().get("email")
    except Exception as e:
        logger.info(f"[AUTH] Error fetching user email: {e}")
    return None


def get_user_email(user_email: str) -> str | None:
    """
    Confirm the authenticated user's email address by validating their token
    against the Google userinfo endpoint. Requires user_email to locate the token.
    """
    creds = load_token(user_email)
    if not creds or not creds.valid:
        return None
    return _email_from_userinfo(creds)


def migrate_legacy_tokens() -> None:
    """
    One-time, best-effort migration of old file-based tokens into the DB.
    Scans token.json (legacy single-user) and tokens/token_<email>.json, imports
    each into the DB, then deletes the files. Safe to call on every startup.
    """
    try:
        base = Path(__file__).parent

        # Legacy single-user token.json
        legacy = base / "token.json"
        if legacy.exists():
            try:
                creds = Credentials.from_authorized_user_file(str(legacy), SCOPES)
                email = _email_from_userinfo(creds) if creds else None
                if email:
                    save_token(creds, user_email=email)
                legacy.unlink(missing_ok=True)
                logger.info(f"[AUTH MIGRATE] Imported legacy token.json for {email}.")
            except Exception as e:
                logger.info(f"[AUTH MIGRATE] Skipped legacy token.json: {e}")

        # Per-user tokens/token_<email>.json
        token_dir = base / "tokens"
        if token_dir.exists():
            for f in token_dir.glob("token_*.json"):
                try:
                    creds = Credentials.from_authorized_user_file(str(f), SCOPES)
                    email = _email_from_userinfo(creds) if creds else None
                    if email:
                        save_token(creds, user_email=email)
                    f.unlink(missing_ok=True)
                    logger.info(f"[AUTH MIGRATE] Imported {f.name} for {email}.")
                except Exception as e:
                    logger.info(f"[AUTH MIGRATE] Skipped {f.name}: {e}")
    except Exception as e:
        logger.info(f"[AUTH MIGRATE] Migration failed (non-fatal): {e}")


# ---------- OAUTH FLOW ----------

def get_auth_url() -> str:
    """
    Generate the Google OAuth login URL.
    The user will be redirected to this URL to grant permissions.
    """
    flow = Flow.from_client_config(CLIENT_CONFIG, scopes=SCOPES)
    flow.redirect_uri = REDIRECT_URI

    auth_url, _ = flow.authorization_url(
        access_type="offline",
        include_granted_scopes="true",
        prompt="select_account consent",
    )

    logger.info(f"[AUTH] Login URL generated: {auth_url[:80]}...")
    return auth_url


def handle_callback(authorization_code: str) -> dict:
    """
    Exchange the authorization code for tokens.
    After token exchange:
      1. Extract Gmail address from Google userinfo endpoint
      2. Save token for THIS SPECIFIC USER (multi-user support)
      3. Call upsert_user(gmail_address, access_token) to get user_id
      4. Call seed_default_labels(user_id)
      5. Return user_id and gmail_address for session storage
    """
    from database import upsert_user, seed_default_labels

    flow = Flow.from_client_config(CLIENT_CONFIG, scopes=SCOPES)
    flow.redirect_uri = REDIRECT_URI

    # Exchange the authorization code for tokens
    flow.fetch_token(code=authorization_code)
    creds = flow.credentials

    # Extract Gmail address from Google userinfo endpoint FIRST
    import requests
    gmail_address = None
    try:
        resp = requests.get(
            "https://www.googleapis.com/oauth2/v2/userinfo",
            headers={"Authorization": f"Bearer {creds.token}"},
            timeout=5,
        )
        if resp.status_code == 200:
            gmail_address = resp.json().get("email")
    except Exception as e:
        logger.info(f"[AUTH] Error fetching user email during callback: {e}")

    if not gmail_address:
        logger.info("[AUTH] WARNING: Could not retrieve Gmail address from userinfo endpoint.")
        return {
            "success": False,
            "message": "Could not retrieve Gmail address.",
        }

    # Save the token for THIS SPECIFIC USER (multi-user support)
    save_token(creds, user_email=gmail_address)

    # Upsert user in database — returns user_id
    access_token = creds.token
    user_id = upsert_user(gmail_address, access_token)

    # Seed default labels if this user has none
    seed_default_labels(user_id)

    logger.info(f"[AUTH] OAuth callback successful. user_id={user_id}, email={gmail_address}")

    return {
        "success": True,
        "message": "Authentication successful",
        "user_id": user_id,
        "gmail_address": gmail_address,
    }


def get_credentials(user_email: str = None) -> Credentials | None:
    """
    Get valid credentials for making Gmail API calls for a specific user.
    user_email is required to load that user's token from the database.
    Returns None if the user is not logged in.
    """
    return load_token(user_email)
