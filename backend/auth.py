"""
auth.py — Google OAuth 2.0 Authentication Module (Restructured)
Handles the full OAuth flow: login URL generation, callback token exchange,
token persistence (token.json), automatic token refresh, and user upsert.
"""

import os
import json
from pathlib import Path
from google_auth_oauthlib.flow import Flow
from google.auth.transport.requests import Request
from google.oauth2.credentials import Credentials
from dotenv import load_dotenv

# Load environment variables from .env file
load_dotenv()

# ---------- CONFIGURATION ----------

# OAuth 2.0 scopes required for Gmail access
SCOPES = [
    "https://www.googleapis.com/auth/gmail.readonly",    # Read emails
    "https://www.googleapis.com/auth/gmail.labels",       # Manage labels
    "https://www.googleapis.com/auth/gmail.modify",       # Modify emails (move, label, etc.)
    "openid",                                             # OpenID for user info
    "https://www.googleapis.com/auth/userinfo.email",     # Get user email
    "https://www.googleapis.com/auth/userinfo.profile",   # Get user profile
]

# Path to store the OAuth token persistently
TOKEN_PATH = Path(__file__).parent / "token.json"

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


# ---------- TOKEN MANAGEMENT ----------

def load_token() -> Credentials | None:
    """
    Load saved OAuth token from token.json.
    If the token exists and is expired but has a refresh token, auto-refresh it.
    Returns Credentials object or None if no valid token found.
    """
    if not TOKEN_PATH.exists():
        return None

    try:
        creds = Credentials.from_authorized_user_file(str(TOKEN_PATH), SCOPES)

        if creds and creds.expired and creds.refresh_token:
            print("[AUTH] Token expired, refreshing...")
            creds.refresh(Request())
            save_token(creds)
            print("[AUTH] Token refreshed successfully.")

        return creds if creds and creds.valid else None

    except Exception as e:
        print(f"[AUTH] Error loading token: {e}")
        return None


def save_token(creds: Credentials) -> None:
    """Save OAuth credentials to token.json for persistent login."""
    with open(TOKEN_PATH, "w") as f:
        f.write(creds.to_json())
    print("[AUTH] Token saved to token.json")


def delete_token() -> None:
    """Remove the saved token file (used for logout)."""
    if TOKEN_PATH.exists():
        TOKEN_PATH.unlink()
        print("[AUTH] Token deleted.")


def is_logged_in() -> bool:
    """Check if a valid (non-expired) token exists."""
    creds = load_token()
    return creds is not None and creds.valid


def get_user_email() -> str | None:
    """
    Get the authenticated user's email address from their OAuth token.
    Uses the Google userinfo endpoint to fetch the email.
    """
    creds = load_token()
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
            data = resp.json()
            return data.get("email")
    except Exception as e:
        print(f"[AUTH] Error fetching user email: {e}")

    return None


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

    print(f"[AUTH] Login URL generated: {auth_url[:80]}...")
    return auth_url


def handle_callback(authorization_code: str) -> dict:
    """
    Exchange the authorization code for tokens.
    After token exchange:
      1. Extract Gmail address from Google userinfo endpoint
      2. Call upsert_user(gmail_address, access_token) to get user_id
      3. Call seed_default_labels(user_id)
      4. Return user_id and gmail_address for session storage
    """
    from database import upsert_user, seed_default_labels

    flow = Flow.from_client_config(CLIENT_CONFIG, scopes=SCOPES)
    flow.redirect_uri = REDIRECT_URI

    # Exchange the authorization code for tokens
    flow.fetch_token(code=authorization_code)
    creds = flow.credentials

    # Save the token for future sessions
    save_token(creds)

    # Extract Gmail address from Google userinfo endpoint
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
        print(f"[AUTH] Error fetching user email during callback: {e}")

    if not gmail_address:
        print("[AUTH] WARNING: Could not retrieve Gmail address from userinfo endpoint.")
        return {
            "success": False,
            "message": "Could not retrieve Gmail address.",
        }

    # Upsert user in database — returns user_id
    access_token = creds.token
    user_id = upsert_user(gmail_address, access_token)

    # Seed default labels if this user has none
    seed_default_labels(user_id)

    print(f"[AUTH] OAuth callback successful. user_id={user_id}, email={gmail_address}")

    return {
        "success": True,
        "message": "Authentication successful",
        "user_id": user_id,
        "gmail_address": gmail_address,
    }


def get_credentials() -> Credentials | None:
    """
    Get valid credentials for making Gmail API calls.
    Returns None if user is not logged in.
    """
    return load_token()
