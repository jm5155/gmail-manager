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

# Path to store OAuth tokens per user
TOKEN_DIR = Path(__file__).parent / "tokens"
TOKEN_DIR.mkdir(exist_ok=True)  # Create tokens directory if it doesn't exist

def get_token_path(user_email: str) -> Path:
    """Get the token file path for a specific user."""
    # Sanitize email for use as filename
    safe_email = user_email.replace('@', '_at_').replace('.', '_')
    return TOKEN_DIR / f"token_{safe_email}.json"

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

def load_token(user_email: str = None) -> Credentials | None:
    """
    Load saved OAuth token for a specific user.
    If user_email is not provided, tries to load the legacy token.json (for backward compatibility).
    If the token exists and is expired but has a refresh token, auto-refresh it.
    Returns Credentials object or None if no valid token found.
    """
    # Determine which token file to use
    if user_email:
        token_path = get_token_path(user_email)
    else:
        # Fallback to legacy single-user token.json
        token_path = Path(__file__).parent / "token.json"
    
    if not token_path.exists():
        return None

    try:
        creds = Credentials.from_authorized_user_file(str(token_path), SCOPES)

        if creds and creds.expired and creds.refresh_token:
            print(f"[AUTH] Token expired for {user_email or 'legacy user'}, refreshing...")
            creds.refresh(Request())
            save_token(creds, user_email)
            print("[AUTH] Token refreshed successfully.")

        return creds if creds and creds.valid else None

    except Exception as e:
        print(f"[AUTH] Error loading token for {user_email}: {e}")
        return None


def save_token(creds: Credentials, user_email: str = None) -> None:
    """
    Save OAuth credentials to a user-specific token file.
    If user_email is not provided, saves to legacy token.json (for backward compatibility).
    """
    if user_email:
        token_path = get_token_path(user_email)
        print(f"[AUTH] Token saved for user: {user_email}")
    else:
        # Fallback to legacy single-user token.json
        token_path = Path(__file__).parent / "token.json"
        print("[AUTH] Token saved to legacy token.json")
    
    with open(token_path, "w") as f:
        f.write(creds.to_json())


def delete_token(user_email: str = None) -> None:
    """
    Remove the saved token file for a specific user (used for logout).
    If user_email is not provided, deletes legacy token.json.
    """
    if user_email:
        token_path = get_token_path(user_email)
    else:
        token_path = Path(__file__).parent / "token.json"
    
    if token_path.exists():
        token_path.unlink()
        print(f"[AUTH] Token deleted for {user_email or 'legacy user'}.")


def is_logged_in(user_email: str = None) -> bool:
    """
    Check if a valid (non-expired) token exists for a specific user.
    If user_email is not provided, tries legacy token.json for backward compatibility.
    """
    # Try user-specific token first if email provided
    if user_email:
        creds = load_token(user_email)
        return creds is not None and creds.valid
    
    # Otherwise, try legacy token.json for backward compatibility
    creds = load_token(user_email=None)
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
        print(f"[AUTH] Error fetching user email during callback: {e}")

    if not gmail_address:
        print("[AUTH] WARNING: Could not retrieve Gmail address from userinfo endpoint.")
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

    print(f"[AUTH] OAuth callback successful. user_id={user_id}, email={gmail_address}")

    return {
        "success": True,
        "message": "Authentication successful",
        "user_id": user_id,
        "gmail_address": gmail_address,
    }


def get_credentials(user_email: str = None) -> Credentials | None:
    """
    Get valid credentials for making Gmail API calls for a specific user.
    If user_email is not provided, falls back to legacy token.json.
    Returns None if user is not logged in.
    """
    return load_token(user_email)
