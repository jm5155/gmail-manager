"""
main.py — FastAPI Backend Entry Point (Restructured)
Runs on port 8000. Provides OAuth endpoints, email fetching, AI analysis,
security scanning, scam alerts, and email rewriting.
Uses SessionMiddleware to store user_id and gmail_address after login.
"""

import os
import sys
import json
import webbrowser

# Force UTF-8 encoding for stdout/stderr to handle emoji in logs
if sys.platform == 'win32':
    import io
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')
    sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding='utf-8', errors='replace')

from fastapi import FastAPI, Request, Depends
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, HTMLResponse
from starlette.middleware.sessions import SessionMiddleware
import uvicorn

# Import our custom modules
from auth import get_auth_url, handle_callback, is_logged_in, get_credentials, delete_token, get_user_email, migrate_legacy_tokens
from gmail import fetch_emails, analyze_bulk_ordered, trash_email, delete_email
from database import (
    init_db, get_analyzed_emails,
    get_labels, add_label, delete_label,
    reset_database, mark_email_safe,
    get_delete_mode, set_delete_mode,
    update_analyzed_email, get_label_id_by_name,
    _get_connection, _execute, _release_connection,
)
from ai_router import ai_router, REWRITE_PROMPT, CLASSIFICATION_PROMPT
from dependencies import require_auth
from jwt_auth import create_access_token, get_user_from_token

# ---------- APP INITIALIZATION ----------

app = FastAPI(
    title="Gmail Manager API",
    description="Backend API for Gmail Manager desktop application",
    version="2.0.0",
)

# Session middleware for storing user_id after login
# Configure session cookies to work across domains (Vercel frontend → Railway backend)
SESSION_SECRET_KEY = os.getenv("SESSION_SECRET_KEY")
if not SESSION_SECRET_KEY:
    raise RuntimeError(
        "SESSION_SECRET_KEY env var is required. "
        "Generate one with: python -c \"import secrets; print(secrets.token_hex(32))\""
    )

app.add_middleware(
    SessionMiddleware,
    secret_key=SESSION_SECRET_KEY,
    session_cookie="gmail_manager_session",
    max_age=86400 * 7,  # 7 days
    same_site="none",  # Allow cross-site cookies (Vercel → Railway)
    https_only=True,  # Require HTTPS in production
)

# Enable CORS - Fixed for credentials mode
# Wildcard (*) not allowed with credentials, must specify exact origins
# Check multiple Railway environment indicators
IS_PRODUCTION = (
    os.getenv("RAILWAY_ENVIRONMENT") is not None or 
    os.getenv("RAILWAY_PROJECT_ID") is not None or
    os.getenv("PORT") is not None  # Railway sets PORT env var
)

if IS_PRODUCTION:
    # Production: Specific Vercel origin (required for credentials: 'include')
    origins = [
        "https://gmail-manager-gamma.vercel.app",
        "https://gmail-manager-gamma.vercel.app/",  # With trailing slash
        "http://localhost:5173",  # Allow local dev testing against prod backend
        "http://localhost:3000",
        "http://localhost:5174",
    ]
    print(f"[CORS] Production mode - Allowed origins: {origins}")
else:
    # Local dev: Specific localhost origins
    origins = [
        "http://localhost:5173",
        "http://localhost:3000",
        "http://localhost:5174",
        "https://gmail-manager-gamma.vercel.app",  # Allow testing prod frontend
    ]
    print(f"[CORS] Dev mode - Allowed origins: {origins}")

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ---------- HELPER: Get user_id from session ----------

def _get_user_id(request: Request) -> int | None:
    """Extract user_id from the session. Returns None if not logged in."""
    return request.session.get("user_id")


def _request_user_email(request: Request) -> str | None:
    """Extract the authenticated user's email from JWT or session."""
    user_data = get_user_from_token(request)
    if user_data and user_data.get("email"):
        return user_data["email"]
    return request.session.get("gmail_address")


def _is_authenticated(request: Request) -> bool:
    """Return True when the request has a valid JWT or session auth for a known user."""
    user_email = _request_user_email(request)
    if not user_email:
        return False
    return is_logged_in(user_email)


def _require_user_id(request: Request) -> int:
    """
    Extract user_id from JWT/session, raising an error if not found.
    Falls back to fetching from database if session is empty but user is logged in.
    """
    user_data = get_user_from_token(request)
    if user_data and user_data.get("user_id"):
        user_id = user_data["user_id"]
        request.session["user_id"] = user_id
        if user_data.get("email"):
            request.session["gmail_address"] = user_data["email"]
        return user_id

    user_id = request.session.get("user_id")
    if user_id:
        return user_id

    # Fallback: if user is logged in (has valid token) but session lost,
    # re-derive user_id from their email
    user_email = _request_user_email(request)
    if is_logged_in(user_email):
        email = user_email
        if email:
            from database import get_user_id, upsert_user, seed_default_labels
            try:
                user_id = get_user_id(email)
            except ValueError:
                # User exists in token but not in DB (pre-restructuring token)
                # Auto-upsert them
                creds = get_credentials(user_email)
                access_token = creds.token if creds else ""
                user_id = upsert_user(email, access_token)
                seed_default_labels(user_id)
            # Restore session
            request.session["user_id"] = user_id
            request.session["gmail_address"] = email
            return user_id

    return None


PENDING_GMAIL_SYNC_CONDITION = """
          AND status = 'labeled'
          AND label_id IS NOT NULL
          AND (
              applied_to_gmail = 0
              OR applied_to_gmail IS NULL
              OR last_applied_label_id IS NULL
              OR last_applied_label_id <> label_id
          )
"""


# ---------- STARTUP EVENT ----------

@app.on_event("startup")
async def startup_event():
    """Initialize the database on server startup."""
    # Set explicit thread pool size for asyncio.to_thread() to prevent exhaustion
    import asyncio
    from concurrent.futures import ThreadPoolExecutor
    loop = asyncio.get_running_loop()
    loop.set_default_executor(ThreadPoolExecutor(max_workers=32))
    print("[SERVER] Configured asyncio executor with 32 worker threads")
    
    init_db()
    # Import legacy file-based tokens into the DB (no-op on ephemeral hosts with no files)
    try:
        migrate_legacy_tokens()
    except Exception as e:
        print(f"[SERVER] Token migration skipped: {e}")
    print("[SERVER] Gmail Manager API started on port 8000")


# ---------- AUTH ENDPOINTS ----------

@app.get("/auth/login")
async def auth_login():
    """GET /auth/login — Opens Google OAuth in browser."""
    auth_url = get_auth_url()
    webbrowser.open(auth_url)
    return {"auth_url": auth_url, "message": "Opening Google login in browser..."}


@app.get("/auth/callback")
async def auth_callback(request: Request):
    """
    GET /auth/callback
    Google redirects here after user grants permissions.
    Generates JWT token for cross-domain authentication.
    Stores the user's OAuth token in the database (keyed by gmail_address).
    """
    try:
        print(f"[AUTH CALLBACK] Received callback request")
        code = request.query_params.get("code")
        
        if not code:
            print("[AUTH CALLBACK ERROR] No authorization code in request")
            return JSONResponse(
                status_code=400,
                content={"error": "No authorization code received from Google"},
            )
        
        print(f"[AUTH CALLBACK] Processing authorization code (length: {len(code)})")
        result = handle_callback(code)
        print(f"[AUTH CALLBACK] handle_callback result: {result}")
        
        # Store user_id and gmail_address in session (for backward compatibility)
        if result.get("success") and result.get("user_id"):
            user_id = result["user_id"]
            user_email = result["gmail_address"]
            
            print(f"[AUTH CALLBACK] Setting session for user_id={user_id}, email={user_email}")
            request.session["user_id"] = user_id
            request.session["gmail_address"] = user_email

            # Generate JWT token for cross-domain authentication
            print(f"[AUTH CALLBACK] Creating JWT token for {user_email}")
            jwt_token = create_access_token(user_id, user_email)
            print(f"[AUTH CALLBACK] Generated JWT token for {user_email}")

            print(f"[AUTH CALLBACK] Session set: user_id={user_id}, email={user_email}")
            
            # Redirect to frontend with JWT token as URL parameter
            frontend_url = os.getenv("FRONTEND_URL", "https://gmail-manager-gamma.vercel.app")
            redirect_url = f"{frontend_url}/inbox?token={jwt_token}"
            
            html_content = f"""
            <html>
            <head>
                <title>Gmail Manager - Login Success</title>
                <meta http-equiv="refresh" content="1;url={redirect_url}" />
                <script>
                // Automatic redirect after 1 second
                setTimeout(function() {{
                    window.location.href = '{redirect_url}';
                }}, 1000);
                </script>
            </head>
            <body style="display:flex;justify-content:center;align-items:center;height:100vh;
                font-family:Inter,sans-serif;background:#F1F3F6;color:#20242C;">
                <div style="text-align:center;">
                    <h1 style="color:#27AE72;font-size:2.5rem;margin-bottom:1rem;">✓ Login Successful</h1>
                    <p style="color:#687386;font-size:1.1rem;">Redirecting to Inbox...</p>
                    <div style="margin-top:2rem;">
                        <div style="width:200px;height:4px;background:#E1E5EB;border-radius:999px;overflow:hidden;margin:0 auto;">
                            <div style="width:0;height:100%;background:#5B5CE2;border-radius:999px;animation:progress 1s ease-out forwards;"></div>
                        </div>
                    </div>
                </div>
                <style>
                @keyframes progress {{
                    from {{ width: 0%; }}
                    to {{ width: 100%; }}
                }}
                </style>
            </body>
            </html>
            """
            print(f"[AUTH CALLBACK] Returning success HTML redirect")
            return HTMLResponse(content=html_content)
        
        # If authentication failed
        print(f"[AUTH CALLBACK ERROR] Authentication failed: {result.get('message', 'Unknown error')}")
        return JSONResponse(
            status_code=401,
            content={"error": result.get("message", "Authentication failed")}
        )
    
    except Exception as e:
        print(f"[AUTH CALLBACK EXCEPTION] {type(e).__name__}: {str(e)}")
        import traceback
        traceback.print_exc()
        return JSONResponse(
            status_code=500,
            content={"error": f"Authentication error: {str(e)}"}
        )


@app.get("/auth/status")
async def auth_status(request: Request):
    """GET /auth/status — Returns login status and user email. Supports JWT and session auth."""
    # DEBUG: Log authentication headers
    auth_header = request.headers.get("Authorization")
    print(f"[AUTH/STATUS DEBUG] Authorization header: {auth_header[:50] if auth_header else 'None'}...")
    print(f"[AUTH/STATUS DEBUG] Session data: {dict(request.session)}")
    
    # Try JWT authentication first (for cross-domain)
    user_data = get_user_from_token(request)
    
    if user_data:
        # User authenticated via JWT token
        user_email = user_data["email"]
        user_id = user_data["user_id"]
        print(f"[AUTH/STATUS DEBUG] JWT auth successful: {user_email}")
        
        # Verify the Gmail token is still valid
        logged_in = is_logged_in(user_email)
        
        if logged_in:
            return {
                "logged_in": True,
                "email": user_email,
                "user_id": user_id
            }
    
    # Fallback to session authentication (for backward compatibility)
    user_email = request.session.get("gmail_address")
    user_id = request.session.get("user_id")
    
    print(f"[AUTH/STATUS DEBUG] Session auth: user_email={user_email}, user_id={user_id}")
    
    if user_email:
        # User has active session, check if token is valid
        logged_in = is_logged_in(user_email)
        print(f"[AUTH/STATUS DEBUG] Token valid for {user_email}: {logged_in}")
    else:
        # No session, check stored token for the session user
        logged_in = is_logged_in(user_email)
        print(f"[AUTH/STATUS DEBUG] Token check: {logged_in}")
    
    result = {"logged_in": logged_in}
    if logged_in:
        email = user_email or get_user_email(user_email)
        if email:
            result["email"] = email
    
    print(f"[AUTH/STATUS DEBUG] Returning: {result}")
    return result


@app.post("/auth/logout")
async def auth_logout(request: Request):
    """POST /auth/logout — Deletes the stored token and clears session."""
    # Try to get user email from JWT first, then session
    user_email = None
    user_data = get_user_from_token(request)
    if user_data and user_data.get("email"):
        user_email = user_data["email"]
    else:
        user_email = request.session.get("gmail_address")
    
    # Delete user-specific token if we have the email
    if user_email:
        try:
            from auth import delete_token as delete_user_token
            delete_user_token(user_email)
            print(f"[AUTH] Deleted user-specific token for {user_email}")
        except Exception as e:
            print(f"[AUTH] Error deleting user token: {e}")
    
    # Clear session
    request.session.clear()
    
    return {"logged_in": False, "message": "Logged out successfully"}


# ---------- EMAIL ENDPOINTS ----------

@app.get("/emails/fetch")
async def emails_fetch(request: Request, limit: int = 50, page_token: str = None):
    """GET /emails/fetch — Fetches emails from Gmail."""
    if not _is_authenticated(request):
        return JSONResponse(status_code=401, content={"error": "Not logged in."})

    result = fetch_emails(limit=limit, page_token=page_token, user_email=_request_user_email(request))
    return {
        "emails": result["emails"],
        "next_page_token": result["next_page_token"],
        "count": len(result["emails"]),
    }


@app.get("/emails")
async def emails_get(request: Request):
    """GET /emails — Returns all cached analyzed emails from SQLite."""
    try:
        print("[EMAILS-GET] Request received")
        if not _is_authenticated(request):
            print("[EMAILS-GET] Not authenticated")
            return JSONResponse(status_code=401, content={"error": "Not logged in."})

        user_id = _require_user_id(request)
        if not user_id:
            print("[EMAILS-GET] No user_id found")
            return JSONResponse(status_code=401, content={"error": "User session not found."})

        print(f"[EMAILS-GET] Fetching emails for user_id={user_id}")
        emails = get_analyzed_emails(user_id)
        print(f"[EMAILS-GET] Found {len(emails)} emails")
        return {"emails": emails, "count": len(emails)}
    except Exception as e:
        print(f"[EMAILS-GET ERROR] {type(e).__name__}: {str(e)}")
        import traceback
        traceback.print_exc()
        return JSONResponse(status_code=500, content={"error": f"Failed to fetch emails: {str(e)}"})


@app.get("/emails/analyzed")
async def emails_analyzed(request: Request):
    """GET /emails/analyzed — Alias for GET /emails for backward compatibility."""
    if not _is_authenticated(request):
        return JSONResponse(status_code=401, content={"error": "Not logged in."})

    user_id = _require_user_id(request)
    if not user_id:
        return JSONResponse(status_code=401, content={"error": "User session not found."})

    emails = get_analyzed_emails(user_id)
    return {"emails": emails, "count": len(emails)}


# ---------- BULK ANALYSIS ENDPOINT WITH SSE ----------

@app.post("/emails/analyze-bulk")
async def emails_analyze_bulk(request: Request, limit: int = 50):
    """
    POST /emails/analyze-bulk?limit=50
    Runs the AI-only bulk analysis pipeline.
    Streams results back as Server-Sent Events (SSE).
    """
    if not _is_authenticated(request):
        return JSONResponse(status_code=401, content={"error": "Not logged in."})

    limit = min(max(limit, 1), 200)  # clamp to prevent AI/Gmail quota exhaustion

    user_id = _require_user_id(request)
    if not user_id:
        return JSONResponse(status_code=401, content={"error": "User session not found."})

    # Item 1: Block analysis if user has zero labels
    user_labels = get_labels(user_id)
    if not user_labels:
        return JSONResponse(
            status_code=400,
            content={"error": "no_labels", "message": "You must create at least one label before running analysis. Go to Settings to add labels."}
        )

    from starlette.responses import StreamingResponse

    async def sse_stream():
        async for event in analyze_bulk_ordered(limit=limit, user_id=user_id):
            event_type = event.get("type", "message")
            if event_type == "email_done":
                event_type = "progress"
            event_data = json.dumps(event)
            yield f"event: {event_type}\ndata: {event_data}\n\n"

    return StreamingResponse(
        sse_stream(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
        },
    )


@app.post("/emails/fetch-only")
async def emails_fetch_only(request: Request, limit: int = 50):
    """POST /emails/fetch-only - Fetch emails from Gmail, save as status='fetched' (no AI)"""
    if not _is_authenticated(request):
        return JSONResponse(status_code=401, content={"error": "Not logged in."})
    
    user_id = _require_user_id(request)
    if not user_id:
        return JSONResponse(status_code=401, content={"error": "User session not found."})
    
    from gmail import fetch_only_pipeline
    
    final_event = {"fetched": 0, "skipped": 0}
    async for event in fetch_only_pipeline(limit=limit, user_id=user_id):
        final_event = event
    
    return JSONResponse(content=final_event)


@app.post("/emails/label-only")
async def emails_label_only(request: Request, limit: int = None):
    """POST /emails/label-only - Run AI analysis on status='fetched' emails"""
    if not _is_authenticated(request):
        return JSONResponse(status_code=401, content={"error": "Not logged in."})
    
    user_id = _require_user_id(request)
    if not user_id:
        return JSONResponse(status_code=401, content={"error": "User session not found."})
    
    user_labels = get_labels(user_id)
    if not user_labels:
        return JSONResponse(status_code=400, content={"error": "no_labels"})
    
    from gmail import label_only_pipeline
    
    final_event = {"analyzed": 0, "failed": 0}
    async for event in label_only_pipeline(limit=limit, user_id=user_id):
        final_event = event
    
    return JSONResponse(content=final_event)



def _apply_label_change(email_id: str, new_label_name: str, user_id: int, service) -> dict:
    """
    Internal function: Apply label change to a single email.
    Updates database and Gmail atomically, with rollback on Gmail failure.
    Returns dict with 'success': bool, 'error': str (if failed).
    Does NOT touch scam_score, scam_indicators, or is_quarantined.
    """
    from database import get_labels, get_analyzed_emails, update_email_label_id
    from gmail import get_or_create_label, change_label

    try:
        # Validate new label exists
        labels = get_labels(user_id)
        new_label = next((l for l in labels if l["label_name"] == new_label_name), None)
        if not new_label:
            return {"success": False, "error": "Label not found"}

        # Get current email state
        emails = get_analyzed_emails(user_id)
        email = next((e for e in emails if e["email_id"] == email_id), None)
        if not email:
            return {"success": False, "error": "Email not found"}

        old_label_id = email.get("label_id")
        old_label = next((l for l in labels if l["label_id"] == old_label_id), None) if old_label_id else None

        # Update database
        try:
            update_email_label_id(email_id, new_label["label_id"])
        except Exception as e:
            return {"success": False, "error": f"db_error: {e}"}

        # Update Gmail
        if not service:
            # Rollback database change
            if old_label_id:
                update_email_label_id(email_id, old_label_id)
            return {"success": False, "error": "gmail_not_authenticated"}

        try:
            # Build Gmail labels cache from actual Gmail labels (prevents 409 conflicts)
            gmail_labels_result = service.users().labels().list(userId="me").execute()
            gmail_labels_cache = {
                lbl["name"]: lbl["id"] for lbl in gmail_labels_result.get("labels", [])
            }
            
            old_gmail_label_id = None
            if old_label:
                old_gmail_label_id = get_or_create_label(service, old_label["label_name"], user_id, gmail_labels_cache)

            new_gmail_label_id = get_or_create_label(service, new_label_name, user_id, gmail_labels_cache)
            if not new_gmail_label_id:
                raise Exception("Failed to get/create Gmail label")

            # Change label in Gmail (remove old, add new)
            change_label(service, email_id, old_gmail_label_id, new_gmail_label_id)

        except Exception as e:
            # Rollback database change
            if old_label_id:
                update_email_label_id(email_id, old_label_id)
            else:
                # If there was no old label, we can't fully rollback - log error
                print(f"[ERROR] Gmail label change failed, but can't rollback to NULL label: {e}")
            return {"success": False, "error": f"gmail_api_error: {e}"}

        return {"success": True}

    except Exception as e:
        return {"success": False, "error": f"unexpected_error: {e}"}


def _sync_label_to_gmail(email_id: str, user_id: int, service, gmail_labels_cache: dict[str, str]) -> dict:
    """
    Sync email's current label_id to Gmail, removing old label if needed.

    Reads current label_id and last_applied_label_id from DB:
    - If last_applied_label_id is NULL: first-ever apply, just add new label
    - If last_applied_label_id differs from current label_id: remove old + add new
    - If same: no-op (already synced)

    On success: updates both applied_to_gmail=1 AND last_applied_label_id=<current label_id>

    Args:
        gmail_labels_cache: Pre-built dict mapping label names to Gmail label IDs (shared across batch)

    Returns dict with 'success': bool, 'error': str (if failed).
    Does NOT touch scam_score, scam_indicators, or is_quarantined.
    """
    from database import get_labels, _get_connection, _release_connection
    from gmail import get_or_create_label, change_label, apply_label

    conn = None
    try:
        # Get current email state from DB
        conn = _get_connection()
        cursor = conn.cursor()
        cursor.execute("""
            SELECT email_id, label_id, last_applied_label_id
            FROM analyzed_emails
            WHERE email_id = %s AND user_id = %s
        """, (email_id, user_id))

        row = cursor.fetchone()
        if not row:
            _release_connection(conn)
            return {"success": False, "error": "Email not found"}

        current_label_id = row['label_id']
        last_applied_label_id = row['last_applied_label_id']

        # If already synced, ensure the legacy applied flag is also correct.
        if last_applied_label_id == current_label_id and current_label_id is not None:
            cursor.execute("""
                UPDATE analyzed_emails
                SET applied_to_gmail = 1
                WHERE email_id = %s AND user_id = %s
            """, (email_id, user_id))
            conn.commit()
            _release_connection(conn)
            return {"success": True}  # Already synced, nothing else to do

        # Get label names
        labels = get_labels(user_id)
        current_label = next((l for l in labels if l["label_id"] == current_label_id), None)

        if not current_label:
            _release_connection(conn)
            return {"success": False, "error": "Current label not found"}

        current_label_name = current_label["label_name"]

        # Get Gmail label ID for new label (reuse shared cache)
        new_gmail_label_id = get_or_create_label(service, current_label_name, user_id, gmail_labels_cache)
        if not new_gmail_label_id:
            _release_connection(conn)
            return {"success": False, "error": "Failed to get/create Gmail label"}

        # Determine if we need to remove old label
        if last_applied_label_id is None:
            # First-ever apply: just add new label
            apply_label(service, email_id, new_gmail_label_id)

        elif last_applied_label_id != current_label_id:
            # Label changed: remove old + add new
            old_label = next((l for l in labels if l["label_id"] == last_applied_label_id), None)

            if old_label:
                old_gmail_label_id = get_or_create_label(service, old_label["label_name"], user_id, gmail_labels_cache)
            else:
                old_gmail_label_id = None

            # Use existing change_label() from Phase 34
            change_label(service, email_id, old_gmail_label_id, new_gmail_label_id)

        # Update DB: mark as applied and record which label was applied
        cursor.execute("""
            UPDATE analyzed_emails
            SET applied_to_gmail = 1,
                last_applied_label_id = %s
            WHERE email_id = %s
        """, (current_label_id, email_id))
        conn.commit()
        _release_connection(conn)

        return {"success": True}

    except Exception as e:
        # Critical: Release connection on exception to prevent pool exhaustion
        if conn:
            _release_connection(conn)
        return {"success": False, "error": f"gmail_api_error: {e}"}


@app.put("/emails/{email_id}/label")
async def update_email_label(request: Request, email_id: str):
    """
    PUT /emails/{email_id}/label — Update email label (manual override).
    Does NOT touch scam_score, scam_indicators, or is_quarantined.
    Atomically updates both database and Gmail, with rollback on Gmail failure.
    """
    if not _is_authenticated(request):
        return JSONResponse(status_code=401, content={"error": "Not logged in."})

    user_id = _require_user_id(request)
    if not user_id:
        return JSONResponse(status_code=401, content={"error": "User session not found."})

    # Parse request body
    try:
        body = await request.json()
        new_label_name = body.get("label_name")
        if not new_label_name:
            return JSONResponse(status_code=400, content={"error": "label_name is required"})
    except Exception as e:
        return JSONResponse(status_code=400, content={"error": f"Invalid JSON: {e}"})

    # Get Gmail service
    from gmail import get_gmail_service
    service = get_gmail_service(_request_user_email(request))

    # Apply label change using shared logic
    result = _apply_label_change(email_id, new_label_name, user_id, service)

    if not result["success"]:
        return JSONResponse(status_code=500, content={"error": result["error"]})

    # Return updated email
    from database import get_analyzed_emails
    updated_emails = get_analyzed_emails(user_id)
    updated_email = next((e for e in updated_emails if e["email_id"] == email_id), None)

    return {"success": True, "email": updated_email}


@app.post("/emails/batch-label")
async def batch_label_update(request: Request):
    """
    POST /emails/batch-label — Batch update email labels (manual override).
    Does NOT touch scam_score, scam_indicators, or is_quarantined.
    Processes changes sequentially, returns partial success results.
    """
    if not _is_authenticated(request):
        return JSONResponse(status_code=401, content={"error": "Not logged in."})

    user_id = _require_user_id(request)
    if not user_id:
        return JSONResponse(status_code=401, content={"error": "User session not found."})

    # Parse request body
    try:
        body = await request.json()
        changes = body.get("changes", [])
        if not changes:
            return JSONResponse(status_code=400, content={"error": "changes array is required"})
    except Exception as e:
        return JSONResponse(status_code=400, content={"error": f"Invalid JSON: {e}"})

    # Get Gmail service once for all changes
    from gmail import get_gmail_service
    service = get_gmail_service(_request_user_email(request))
    if not service:
        return JSONResponse(status_code=500, content={"error": "gmail_not_authenticated"})

    # Process changes sequentially
    applied = 0
    failed = 0
    errors = []

    for change in changes:
        email_id = change.get("email_id")
        new_label_name = change.get("label_name")

        if not email_id or not new_label_name:
            failed += 1
            errors.append({
                "email_id": email_id or "unknown",
                "error": "Missing email_id or label_name"
            })
            continue

        # Apply label change using shared logic
        result = _apply_label_change(email_id, new_label_name, user_id, service)

        if result["success"]:
            applied += 1
        else:
            failed += 1
            errors.append({
                "email_id": email_id,
                "error": result["error"]
            })

    return {
        "success": True,
        "applied": applied,
        "failed": failed,
        "errors": errors
    }


@app.get("/emails/pending-count")
async def get_pending_count(request: Request):
    """
    GET /emails/pending-count — Count emails needing Gmail sync.
    Returns count of emails where status='labeled' AND applied_to_gmail=0.
    """
    try:
        print("[PENDING-COUNT] Request received")
        if not _is_authenticated(request):
            print("[PENDING-COUNT] Not authenticated")
            return JSONResponse(status_code=401, content={"error": "Not logged in."})

        user_id = _require_user_id(request)
        if not user_id:
            print("[PENDING-COUNT] No user_id found")
            return JSONResponse(status_code=401, content={"error": "User session not found."})

        print(f"[PENDING-COUNT] Fetching count for user_id={user_id}")
        conn = _get_connection()
        try:
            cursor = conn.cursor()
            _execute(cursor, f"""
                SELECT COUNT(*) as count
                FROM analyzed_emails
                WHERE user_id = %s
    {PENDING_GMAIL_SYNC_CONDITION}
            """, (user_id,))

            result = cursor.fetchone()
            count = result['count'] if isinstance(result, dict) else result[0]
            print(f"[PENDING-COUNT] Count={count}")
            return {"pending_count": count}
        finally:
            _release_connection(conn)
    except Exception as e:
        print(f"[PENDING-COUNT ERROR] {type(e).__name__}: {str(e)}")
        import traceback
        traceback.print_exc()
        return JSONResponse(status_code=500, content={"error": f"Failed to fetch pending count: {str(e)}"})


@app.post("/emails/apply-all-pending")
async def apply_all_pending(request: Request):
    """
    POST /emails/apply-all-pending — Apply all unapplied labels to Gmail.
    Processes all emails where status='labeled' AND applied_to_gmail=0.
    Uses _sync_label_to_gmail() which handles label removal correctly.
    """
    if not _is_authenticated(request):
        return JSONResponse(status_code=401, content={"error": "Not logged in."})

    user_id = _require_user_id(request)
    if not user_id:
        return JSONResponse(status_code=401, content={"error": "User session not found."})

    # Get all pending email IDs from DB
    conn = _get_connection()
    cursor = conn.cursor()
    _execute(cursor, f"""
        SELECT email_id
        FROM analyzed_emails
        WHERE user_id = %s
{PENDING_GMAIL_SYNC_CONDITION}
    """, (user_id,))

    pending_emails = [row['email_id'] for row in cursor.fetchall()]
    _release_connection(conn)

    # Get Gmail service once
    from gmail import get_gmail_service
    service = get_gmail_service(_request_user_email(request))
    if not service:
        return JSONResponse(status_code=500, content={"error": "gmail_not_authenticated"})

    # Build gmail_labels_cache once for the entire batch (same pattern as analyze_bulk_ordered)
    import asyncio
    gmail_labels_result = await asyncio.to_thread(
        lambda: service.users().labels().list(userId="me").execute()
    )
    gmail_labels_cache = {
        lbl["name"]: lbl["id"] for lbl in gmail_labels_result.get("labels", [])
    }

    # Apply each using corrected _sync_label_to_gmail()
    applied = 0
    failed = 0
    errors = []

    for email_id in pending_emails:
        result = _sync_label_to_gmail(email_id, user_id, service, gmail_labels_cache)

        if result["success"]:
            applied += 1
        else:
            failed += 1
            errors.append({"email_id": email_id, "error": result["error"]})

    return {
        "success": True,
        "applied": applied,
        "failed": failed,
        "errors": errors
    }


# ---------- CUSTOM LABELS ENDPOINTS ----------

@app.get("/labels")
async def get_custom_labels(request: Request):
    """GET /labels — Returns all labels for the current user."""
    if not _is_authenticated(request):
        return JSONResponse(status_code=401, content={"error": "Not logged in."})

    user_id = _require_user_id(request)
    if not user_id:
        return JSONResponse(status_code=401, content={"error": "User session not found."})

    return {"labels": get_labels(user_id)}


@app.get("/settings/labels")
async def get_settings_labels(request: Request):
    """GET /settings/labels — Alias for GET /labels for backward compatibility."""
    if not _is_authenticated(request):
        return JSONResponse(status_code=401, content={"error": "Not logged in."})

    user_id = _require_user_id(request)
    if not user_id:
        return JSONResponse(status_code=401, content={"error": "User session not found."})

    return {"labels": get_labels(user_id)}


@app.post("/labels")
async def create_label(request: Request):
    """POST /labels — Create a new custom label."""
    if not _is_authenticated(request):
        return JSONResponse(status_code=401, content={"error": "Not logged in."})

    user_id = _require_user_id(request)
    if not user_id:
        return JSONResponse(status_code=401, content={"error": "User session not found."})

    data = await request.json()
    label_name = data.get("name") or data.get("label_name")
    if not label_name:
        return JSONResponse(status_code=400, content={"error": "Label name is required"})

    bg_color = data.get("bg_color", "#3B82F6")
    text_color = data.get("text_color", "#FFFFFF")

    label_id = add_label(user_id, label_name, bg_color, text_color)
    return {
        "message": "Label created",
        "label": {
            "label_id": label_id,
            "label_name": label_name,
            "bg_color": bg_color,
            "text_color": text_color,
        },
    }


@app.post("/settings/labels")
async def create_settings_label(request: Request):
    """POST /settings/labels — Alias for POST /labels for backward compatibility."""
    if not _is_authenticated(request):
        return JSONResponse(status_code=401, content={"error": "Not logged in."})

    user_id = _require_user_id(request)
    if not user_id:
        return JSONResponse(status_code=401, content={"error": "User session not found."})

    data = await request.json()
    label_name = data.get("name") or data.get("label_name")
    if not label_name:
        return JSONResponse(status_code=400, content={"error": "Label name is required"})

    bg_color = data.get("bg_color", "#3B82F6")
    text_color = data.get("text_color", "#FFFFFF")

    label_id = add_label(user_id, label_name, bg_color, text_color)
    return {
        "message": "Label created",
        "label": {
            "label_id": label_id,
            "label_name": label_name,
            "bg_color": bg_color,
            "text_color": text_color,
        },
    }


@app.delete("/labels/{label_id}")
async def remove_label(label_id: int, request: Request):
    """DELETE /labels/{label_id} — Delete a custom label."""
    if not _is_authenticated(request):
        return JSONResponse(status_code=401, content={"error": "Not logged in."})

    user_id = _require_user_id(request)
    if not user_id:
        return JSONResponse(status_code=401, content={"error": "User session not found."})

    delete_label(label_id, user_id)
    return {"message": "Label deleted"}


@app.delete("/settings/labels/{label_name}")
async def remove_settings_label(label_name: str, request: Request):
    """DELETE /settings/labels/{label_name} — Backward compat delete by name."""
    if not _is_authenticated(request):
        return JSONResponse(status_code=401, content={"error": "Not logged in."})

    user_id = _require_user_id(request)
    if not user_id:
        return JSONResponse(status_code=401, content={"error": "User session not found."})

    from database import get_label_id_by_name
    try:
        label_id = get_label_id_by_name(user_id, label_name)
        delete_label(label_id, user_id)
        return {"message": "Label deleted"}
    except ValueError:
        return JSONResponse(status_code=404, content={"error": "Label not found"})


# ---------- SETTINGS ENDPOINTS ----------

@app.post("/settings/reset-database")
async def reset_database_endpoint(request: Request):
    """POST /settings/reset-database — Wipes analysis data for the current user."""
    if not _is_authenticated(request):
        return JSONResponse(status_code=401, content={"error": "Not logged in."})

    user_id = _require_user_id(request)
    if not user_id:
        return JSONResponse(status_code=401, content={"error": "User session not found."})

    reset_database(user_id)
    return {"message": "Database wiped successfully. You can now re-fetch emails from the beginning."}


# ---------- DELETE MODE ENDPOINTS ----------

@app.get("/settings/delete-mode")
async def get_delete_mode_endpoint(request: Request, user: dict = Depends(require_auth)):
    """GET /settings/delete-mode — Returns current delete mode ('trash' or 'permanent')."""
    user_id = user["user_id"]
    mode = get_delete_mode(user_id)
    return {"delete_mode": mode}


@app.put("/settings/delete-mode")
async def update_delete_mode_endpoint(request: Request):
    """PUT /settings/delete-mode — Update delete mode to 'trash' or 'permanent'."""
    if not _is_authenticated(request):
        return JSONResponse(status_code=401, content={"error": "Not logged in."})

    user_id = _require_user_id(request)
    if not user_id:
        return JSONResponse(status_code=401, content={"error": "User session not found."})

    data = await request.json()
    mode = data.get("delete_mode", "trash")

    if mode not in ("trash", "permanent"):
        return JSONResponse(status_code=400, content={"error": "delete_mode must be 'trash' or 'permanent'."})

    set_delete_mode(user_id, mode)
    return {"message": f"Delete mode set to '{mode}'.", "delete_mode": mode}


# ---------- MARK EMAIL SAFE ----------

@app.patch("/emails/{email_id}/mark-safe")
async def patch_mark_email_safe(email_id: str, request: Request):
    """PATCH /emails/{email_id}/mark-safe — Mark an email as safe."""
    if not _is_authenticated(request):
        return JSONResponse(status_code=401, content={"error": "Not logged in."})

    user_id = _require_user_id(request)
    if not user_id:
        return JSONResponse(status_code=401, content={"error": "User session not found."})

    mark_email_safe(email_id, user_id)
    return {"success": True, "message": f"Email {email_id} marked as safe."}


# ---------- AI REWRITE ENDPOINT ----------

@app.post("/ai/rewrite")
async def ai_rewrite(request: Request):
    """POST /ai/rewrite — Rewrite email text using AI."""
    data = await request.json()
    text = data.get("text", "")
    instruction = data.get("instruction", "")

    if not text:
        return JSONResponse(status_code=400, content={"error": "No text provided."})

    prompt = REWRITE_PROMPT.format(instruction=instruction, text=text)
    result = await ai_router.analyze(prompt)

    if "error" in result:
        return JSONResponse(status_code=503, content=result)

    return {
        "rewritten": result["response"],
        "provider_used": result["provider_used"],
        "character_count_original": len(text),
        "character_count_rewritten": len(result["response"]),
    }


@app.get("/ai/status")
async def ai_status():
    """GET /ai/status — Returns which AI providers have valid API keys."""
    gemini_keys = [
        os.getenv(f"GEMINI_API_KEY_{index}")
        for index in range(1, 18)
    ]
    status = {
        "groq": {"configured": bool(os.getenv("GROQ_API_KEY"))},
        "nvidia": {"configured": bool(os.getenv("NVIDIA_API_KEY"))},
        "gemini": {"configured": bool(
            os.getenv("GEMINI_API_KEY") or any(gemini_keys)
        )},
        "cohere": {"configured": bool(os.getenv("COHERE_API_KEY"))},
        "openrouter": {"configured": bool(os.getenv("OPENROUTER_API_KEY"))},
        "safebrowsing": {"configured": bool(os.getenv("GOOGLE_SAFE_BROWSING_KEY"))},
    }
    return {"providers": status}


# ---------- SECURITY SCAN ENDPOINT ----------

@app.post("/security/scan-email")
async def security_scan_email(request: Request):
    """POST /security/scan-email — Scan email URLs for threats."""
    if not _is_authenticated(request):
        return JSONResponse(status_code=401, content={"error": "Not logged in."})

    from security import extract_urls, scan_url
    import httpx
    import asyncio

    data = await request.json()
    email_id = data.get("email_id", "")
    body = data.get("body", "")

    urls = extract_urls(body)
    threats = []
    
    api_semaphore = asyncio.Semaphore(10)
    async with httpx.AsyncClient(timeout=10.0) as client:
        for url in urls:
            result = await scan_url(url, email_id, client, api_semaphore)
            if result["is_safe"] == 0:
                threats.append(result)

    return {
        "email_id": email_id,
        "urls_checked": len(urls),
        "threats_found": len(threats),
        "threats": threats,
    }


# ---------- QUARANTINE ENDPOINTS ----------

@app.get("/quarantine")
async def quarantine_list(request: Request):
    """GET /quarantine — Returns all quarantined emails."""
    if not _is_authenticated(request):
        return JSONResponse(status_code=401, content={"error": "Not logged in."})

    user_id = _require_user_id(request)
    if not user_id:
        return JSONResponse(status_code=401, content={"error": "User session not found."})

    emails = get_analyzed_emails(user_id)
    quarantined = [e for e in emails if e.get("is_quarantined") == 1]
    return {"emails": quarantined, "count": len(quarantined)}


@app.post("/quarantine/{email_id}/safe")
async def quarantine_mark_safe(email_id: str, request: Request, user: dict = Depends(require_auth)):
    """POST /quarantine/{email_id}/safe — Removes quarantine flag."""
    user_id = user["user_id"]
    mark_email_safe(email_id, user_id)
    return {"success": True, "message": f"Email {email_id} marked as safe."}


@app.delete("/quarantine/{email_id}")
async def quarantine_delete(email_id: str, request: Request):
    """DELETE /quarantine/{email_id} — Delete email using user's preferred mode."""
    if not _is_authenticated(request):
        return JSONResponse(status_code=401, content={"error": "Not logged in."})

    user_id = _require_user_id(request)
    if not user_id:
        return JSONResponse(status_code=401, content={"error": "User session not found."})

    mode = get_delete_mode(user_id)
    success = delete_email(email_id, user_id, user_email=_request_user_email(request))
    if success:
        mark_email_safe(email_id, user_id)
        action = "permanently deleted" if mode == "permanent" else "moved to trash"
        return {"success": True, "message": f"Email {email_id} {action}."}
    return JSONResponse(status_code=500, content={"error": "Failed to delete email."})


# ---------- SCAM ALERTS ENDPOINT ----------

@app.get("/scam/alerts")
async def scam_alerts(request: Request, min_score: int = 30, user: dict = Depends(require_auth)):
    """GET /scam/alerts?min_score=30 — Returns flagged emails sorted by scam score."""
    user_id = user["user_id"]
    emails = get_analyzed_emails(user_id)
    flagged = [e for e in emails if (e.get("scam_score") or 0) >= min_score]
    flagged.sort(key=lambda x: (x.get("scam_score") or 0), reverse=True)
    return {"emails": flagged, "count": len(flagged)}


@app.post("/scam/reanalyze/{email_id}")
async def reanalyze_scam_email(email_id: str, request: Request, user: dict = Depends(require_auth)):
    """
    POST /scam/reanalyze/{email_id} — Re-run AI scam analysis on a single email.
    Reuses the same classification pipeline (URL scan + AI cascade) and persists the
    new scam_score, indicators, label, and quarantine flag.
    Returns { scam_score, reason, indicators, label, is_quarantined } for the UI.
    """
    import httpx
    import asyncio

    user_id = user["user_id"]

    # Fetch the email's current data
    emails = get_analyzed_emails(user_id)
    email = next((e for e in emails if e["email_id"] == email_id), None)
    if not email:
        return JSONResponse(status_code=404, content={"error": "Email not found"})

    body = email.get("body", "") or ""
    sender = email.get("sender", "") or ""
    subject = email.get("subject", "") or ""
    snippet = email.get("snippet", "") or ""
    
    # Fallback: fetch body from Gmail if DB has empty body (metadata-only fetch)
    if not body:
        from gmail import get_gmail_service, _get_email_body
        user_email = _request_user_email(request)
        service = get_gmail_service(user_email)
        if service:
            body = await asyncio.to_thread(_get_email_body, service, email_id)

    # Available labels for classification
    available_labels_list = get_labels(user_id)
    available_label_names = [lbl["label_name"] for lbl in available_labels_list]
    if not available_label_names:
        return JSONResponse(
            status_code=400,
            content={"error": "no_labels", "message": "You must create at least one label before analysis."},
        )
    default_label = available_label_names[0]

    # Step B — URL extraction and Google Safe Browsing scan
    from security import extract_urls, scan_url
    urls = extract_urls(body)
    url_threat_found = False
    if urls:
        async with httpx.AsyncClient(timeout=10.0) as url_client:
            url_semaphore = asyncio.Semaphore(10)
            scan_tasks = [scan_url(url, email_id, url_client, url_semaphore) for url in urls]
            results = await asyncio.gather(*scan_tasks)
            url_threat_found = any(r["is_safe"] == 0 for r in results)

    # Step C — AI cascade classification and scam scoring
    prompt = CLASSIFICATION_PROMPT.format(
        sender=sender,
        subject=subject,
        body=body[:1500],
        url_threat_found=url_threat_found,
        available_labels=", ".join(available_label_names),
    )
    ai_result = await ai_router.analyze_json(prompt)
    provider_used = ai_result.get("provider_used")

    # Defaults — use first available label as fallback
    label = default_label
    scam_score = 0
    scam_indicators = []
    reasoning = ""

    if ai_result.get("data"):
        data = ai_result["data"]
        label = data.get("label", default_label)
        scam_score = data.get("scam_score", 0)
        scam_indicators = data.get("scam_indicators", [])
        reasoning = data.get("reasoning", "")
    elif ai_result.get("error"):
        return JSONResponse(status_code=503, content={"error": ai_result["error"]})

    # Validate label
    if label not in available_label_names:
        label = default_label

    # Validate scam_score (0-100)
    if not isinstance(scam_score, int):
        try:
            scam_score = int(scam_score)
        except (ValueError, TypeError):
            scam_score = 0
    scam_score = max(0, min(100, scam_score))

    # Validate indicators
    if scam_indicators is None or not isinstance(scam_indicators, list):
        scam_indicators = []

    # Quarantine flag — same rule as the bulk pipeline
    is_quarantined = 0
    label_is_spam_like = label == "Spam" or "scam" in label.lower()
    if scam_score >= 70 and url_threat_found and label_is_spam_like:
        is_quarantined = 1

    # Resolve label_id and persist
    label_id = get_label_id_by_name(user_id, label)
    update_analyzed_email(
        email_id=email_id,
        label_id=label_id,
        scam_score=scam_score,
        scam_indicators=json.dumps(scam_indicators),
        is_quarantined=is_quarantined,
        status='labeled',
    )

    print(f"[SCAM REANALYZE] {email_id[:12]}... -> label={label}, scam={scam_score}, quarantine={is_quarantined}")
    return {
        "email_id": email_id,
        "scam_score": scam_score,
        "reason": reasoning,
        "indicators": scam_indicators,
        "label": label,
        "is_quarantined": is_quarantined,
        "provider_used": provider_used,
    }


# ---------- BATCH DELETE ENDPOINT ----------

@app.post("/emails/batch-delete")
async def emails_batch_delete(request: Request):
    """POST /emails/batch-delete — Trash and delete matching emails."""
    if not _is_authenticated(request):
        return JSONResponse(status_code=401, content={"error": "Not logged in."})

    user_id = _require_user_id(request)
    if not user_id:
        return JSONResponse(status_code=401, content={"error": "User session not found."})

    data = await request.json()
    mode = data.get("mode")
    value = data.get("value")

    if not mode or not value:
        return JSONResponse(status_code=400, content={"error": "Both 'mode' and 'value' are required."})

    # Get all emails for this user, then filter
    emails = get_analyzed_emails(user_id)

    if mode == "label":
        matching = [e for e in emails if e.get("label_name") == value]
    elif mode == "sender":
        matching = [e for e in emails if value.lower() in (e.get("sender", "")).lower()]
    else:
        return JSONResponse(status_code=400, content={"error": "mode must be 'label' or 'sender'."})

    deleted = 0
    failed = 0

    for email in matching:
        success = delete_email(email["email_id"], user_id, user_email=_request_user_email(request))
        if success:
            deleted += 1
        else:
            failed += 1

    return {"deleted": deleted, "failed": failed, "total": len(matching)}


# ---------- STATS ENDPOINT ----------

@app.get("/emails/stats")
async def emails_stats(request: Request):
    """GET /emails/stats — Returns summary statistics."""
    if not _is_authenticated(request):
        return JSONResponse(status_code=401, content={"error": "Not logged in."})

    user_id = _require_user_id(request)
    if not user_id:
        return {"total_analyzed": 0, "total_quarantined": 0, "total_flagged": 0}

    emails = get_analyzed_emails(user_id)
    total_analyzed = len(emails)
    total_quarantined = sum(1 for e in emails if e.get("is_quarantined") == 1)
    total_flagged = sum(1 for e in emails if (e.get("scam_score") or 0) >= 30)

    return {
        "total_analyzed": total_analyzed,
        "total_quarantined": total_quarantined,
        "total_flagged": total_flagged,
    }


# ---------- HEALTH CHECK ----------

@app.get("/")
async def root():
    """GET / — Simple health check endpoint."""
    return {
        "app": "Gmail Manager API",
        "version": "2.0.0",
        "status": "running",
    }


# ---------- RUN SERVER ----------

if __name__ == "__main__":
    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=8000,
        reload=True,
        log_level="info",
    )
