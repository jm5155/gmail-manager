"""
main.py — FastAPI Backend Entry Point (Restructured)
Runs on port 8000. Provides OAuth endpoints, email fetching, AI analysis,
security scanning, scam alerts, and email rewriting.
Uses SessionMiddleware to store user_id and gmail_address after login.
"""

import os
import json
import webbrowser
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, HTMLResponse
from starlette.middleware.sessions import SessionMiddleware
import uvicorn

# Import our custom modules
from auth import get_auth_url, handle_callback, is_logged_in, get_credentials, delete_token, get_user_email
from gmail import fetch_emails, analyze_bulk_ordered, trash_email, delete_email
from database import (
    init_db, get_analyzed_emails,
    get_labels, add_label, delete_label,
    reset_database, mark_email_safe,
    get_delete_mode, set_delete_mode,
)
from ai_router import ai_router, REWRITE_PROMPT

# ---------- APP INITIALIZATION ----------

app = FastAPI(
    title="Gmail Manager API",
    description="Backend API for Gmail Manager desktop application",
    version="2.0.0",
)

# Session middleware for storing user_id after login
app.add_middleware(SessionMiddleware, secret_key="gmail-manager-session-secret-key-2024")

# Enable CORS - supports both local dev and production deployment
# Set ALLOWED_ORIGIN environment variable to your production frontend URL
ALLOWED_ORIGIN = os.getenv("ALLOWED_ORIGIN", "http://localhost:5173")
origins = [ALLOWED_ORIGIN]

# Support multiple origins if comma-separated
if "," in ALLOWED_ORIGIN:
    origins = [origin.strip() for origin in ALLOWED_ORIGIN.split(",")]

print(f"[CORS] Allowed origins: {origins}")

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


def _require_user_id(request: Request) -> int:
    """
    Extract user_id from session, raising an error if not found.
    Falls back to fetching from database if session is empty but user is logged in.
    """
    user_id = request.session.get("user_id")
    if user_id:
        return user_id

    # Fallback: if user is logged in (has valid token) but session lost,
    # re-derive user_id from their email
    if is_logged_in():
        email = get_user_email()
        if email:
            from database import get_user_id, upsert_user, seed_default_labels
            try:
                user_id = get_user_id(email)
            except ValueError:
                # User exists in token but not in DB (pre-restructuring token)
                # Auto-upsert them
                creds = get_credentials()
                access_token = creds.token if creds else ""
                user_id = upsert_user(email, access_token)
                seed_default_labels(user_id)
            # Restore session
            request.session["user_id"] = user_id
            request.session["gmail_address"] = email
            return user_id

    return None


# ---------- STARTUP EVENT ----------

@app.on_event("startup")
async def startup_event():
    """Initialize the database on server startup."""
    init_db()
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
    Google redirects here after the user grants permissions.
    Stores user_id and gmail_address in the session.
    """
    code = request.query_params.get("code")

    if not code:
        return JSONResponse(
            status_code=400,
            content={"error": "No authorization code received from Google"},
        )

    result = handle_callback(code)

    # Store user_id and gmail_address in session
    if result.get("success") and result.get("user_id"):
        request.session["user_id"] = result["user_id"]
        request.session["gmail_address"] = result["gmail_address"]

    html_content = """
    <html>
    <head><title>Gmail Manager — Login Success</title></head>
    <body style="display:flex;justify-content:center;align-items:center;height:100vh;
                 font-family:Inter,sans-serif;background:#0F172A;color:#F1F5F9;">
        <div style="text-align:center;">
            <h1 style="color:#22C55E;">✓ Login Successful</h1>
            <p>You can close this tab and return to Gmail Manager.</p>
        </div>
    </body>
    </html>
    """
    return HTMLResponse(content=html_content)


@app.get("/auth/status")
async def auth_status(request: Request):
    """GET /auth/status — Returns login status and user email."""
    logged_in = is_logged_in()
    result = {"logged_in": logged_in}
    if logged_in:
        email = request.session.get("gmail_address") or get_user_email()
        if email:
            result["email"] = email
    return result


@app.post("/auth/logout")
async def auth_logout(request: Request):
    """POST /auth/logout — Deletes the stored token and clears session."""
    delete_token()
    request.session.clear()
    return {"logged_in": False, "message": "Logged out successfully"}


# ---------- EMAIL ENDPOINTS ----------

@app.get("/emails/fetch")
async def emails_fetch(request: Request, limit: int = 50, page_token: str = None):
    """GET /emails/fetch — Fetches emails from Gmail."""
    if not is_logged_in():
        return JSONResponse(status_code=401, content={"error": "Not logged in."})

    result = fetch_emails(limit=limit, page_token=page_token)
    return {
        "emails": result["emails"],
        "next_page_token": result["next_page_token"],
        "count": len(result["emails"]),
    }


@app.get("/emails")
async def emails_get(request: Request):
    """GET /emails — Returns all cached analyzed emails from SQLite."""
    if not is_logged_in():
        return JSONResponse(status_code=401, content={"error": "Not logged in."})

    user_id = _require_user_id(request)
    if not user_id:
        return JSONResponse(status_code=401, content={"error": "User session not found."})

    emails = get_analyzed_emails(user_id)
    return {"emails": emails, "count": len(emails)}


@app.get("/emails/analyzed")
async def emails_analyzed(request: Request):
    """GET /emails/analyzed — Alias for GET /emails for backward compatibility."""
    if not is_logged_in():
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
    if not is_logged_in():
        return JSONResponse(status_code=401, content={"error": "Not logged in."})

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
    if not is_logged_in():
        return JSONResponse(status_code=401, content={"error": "Not logged in."})
    
    user_id = _require_user_id(request)
    if not user_id:
        return JSONResponse(status_code=401, content={"error": "User session not found."})
    
    from starlette.responses import StreamingResponse
    from gmail import fetch_only_pipeline
    
    async def sse_stream():
        async for event in fetch_only_pipeline(limit=limit, user_id=user_id):
            yield f"data: {json.dumps(event)}\n\n"
    
    return StreamingResponse(sse_stream(), media_type="text/event-stream")


@app.post("/emails/label-only")
async def emails_label_only(request: Request, limit: int = None):
    """POST /emails/label-only - Run AI analysis on status='fetched' emails"""
    if not is_logged_in():
        return JSONResponse(status_code=401, content={"error": "Not logged in."})
    
    user_id = _require_user_id(request)
    if not user_id:
        return JSONResponse(status_code=401, content={"error": "User session not found."})
    
    user_labels = get_labels(user_id)
    if not user_labels:
        return JSONResponse(status_code=400, content={"error": "no_labels"})
    
    from starlette.responses import StreamingResponse
    from gmail import label_only_pipeline
    
    async def sse_stream():
        async for event in label_only_pipeline(limit=limit, user_id=user_id):
            yield f"data: {json.dumps(event)}\n\n"

    return StreamingResponse(sse_stream(), media_type="text/event-stream")


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
            # Get Gmail label IDs
            old_gmail_label_id = None
            if old_label:
                old_gmail_label_id = get_or_create_label(service, old_label["label_name"], user_id)

            new_gmail_label_id = get_or_create_label(service, new_label_name, user_id)
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


def _sync_label_to_gmail(email_id: str, user_id: int, service) -> dict:
    """
    Sync email's current label_id to Gmail, removing old label if needed.

    Reads current label_id and last_applied_label_id from DB:
    - If last_applied_label_id is NULL: first-ever apply, just add new label
    - If last_applied_label_id differs from current label_id: remove old + add new
    - If same: no-op (already synced)

    On success: updates both applied_to_gmail=1 AND last_applied_label_id=<current label_id>

    Returns dict with 'success': bool, 'error': str (if failed).
    Does NOT touch scam_score, scam_indicators, or is_quarantined.
    """
    from database import get_labels, _get_connection
    from gmail import get_or_create_label, change_label, apply_label

    try:
        # Get current email state from DB
        conn = _get_connection()
        cursor = conn.cursor()
        cursor.execute("""
            SELECT email_id, label_id, last_applied_label_id
            FROM analyzed_emails
            WHERE email_id = ? AND user_id = ?
        """, (email_id, user_id))

        row = cursor.fetchone()
        if not row:
            conn.close()
            return {"success": False, "error": "Email not found"}

        current_label_id = row['label_id']
        last_applied_label_id = row['last_applied_label_id']

        # If already synced, no-op
        if last_applied_label_id == current_label_id and current_label_id is not None:
            conn.close()
            return {"success": True}  # Already synced, nothing to do

        # Get label names
        labels = get_labels(user_id)
        current_label = next((l for l in labels if l["label_id"] == current_label_id), None)

        if not current_label:
            conn.close()
            return {"success": False, "error": "Current label not found"}

        current_label_name = current_label["label_name"]

        # Get Gmail label ID for new label
        new_gmail_label_id = get_or_create_label(service, current_label_name, user_id)
        if not new_gmail_label_id:
            conn.close()
            return {"success": False, "error": "Failed to get/create Gmail label"}

        # Determine if we need to remove old label
        if last_applied_label_id is None:
            # First-ever apply: just add new label
            apply_label(service, email_id, new_gmail_label_id)

        elif last_applied_label_id != current_label_id:
            # Label changed: remove old + add new
            old_label = next((l for l in labels if l["label_id"] == last_applied_label_id), None)

            if old_label:
                old_gmail_label_id = get_or_create_label(service, old_label["label_name"], user_id)
            else:
                old_gmail_label_id = None

            # Use existing change_label() from Phase 34
            change_label(service, email_id, old_gmail_label_id, new_gmail_label_id)

        # Update DB: mark as applied and record which label was applied
        cursor.execute("""
            UPDATE analyzed_emails
            SET applied_to_gmail = 1,
                last_applied_label_id = ?
            WHERE email_id = ?
        """, (current_label_id, email_id))
        conn.commit()
        conn.close()

        return {"success": True}

    except Exception as e:
        return {"success": False, "error": f"gmail_api_error: {e}"}


@app.put("/emails/{email_id}/label")
async def update_email_label(request: Request, email_id: str):
    """
    PUT /emails/{email_id}/label — Update email label (manual override).
    Does NOT touch scam_score, scam_indicators, or is_quarantined.
    Atomically updates both database and Gmail, with rollback on Gmail failure.
    """
    if not is_logged_in():
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
    service = get_gmail_service()

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
    if not is_logged_in():
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
    service = get_gmail_service()
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
    if not is_logged_in():
        return JSONResponse(status_code=401, content={"error": "Not logged in."})

    user_id = _require_user_id(request)
    if not user_id:
        return JSONResponse(status_code=401, content={"error": "User session not found."})

    from database import _get_connection

    conn = _get_connection()
    cursor = conn.cursor()
    cursor.execute("""
        SELECT COUNT(*)
        FROM analyzed_emails
        WHERE user_id = ?
          AND status = 'labeled'
          AND applied_to_gmail = 0
    """, (user_id,))

    count = cursor.fetchone()[0]
    conn.close()

    return {"pending_count": count}


@app.post("/emails/apply-all-pending")
async def apply_all_pending(request: Request):
    """
    POST /emails/apply-all-pending — Apply all unapplied labels to Gmail.
    Processes all emails where status='labeled' AND applied_to_gmail=0.
    Uses _sync_label_to_gmail() which handles label removal correctly.
    """
    if not is_logged_in():
        return JSONResponse(status_code=401, content={"error": "Not logged in."})

    user_id = _require_user_id(request)
    if not user_id:
        return JSONResponse(status_code=401, content={"error": "User session not found."})

    # Get all pending email IDs from DB
    from database import _get_connection
    conn = _get_connection()
    cursor = conn.cursor()
    cursor.execute("""
        SELECT email_id
        FROM analyzed_emails
        WHERE user_id = ?
          AND status = 'labeled'
          AND applied_to_gmail = 0
    """, (user_id,))

    pending_emails = [row['email_id'] for row in cursor.fetchall()]
    conn.close()

    # Get Gmail service once
    from gmail import get_gmail_service
    service = get_gmail_service()
    if not service:
        return JSONResponse(status_code=500, content={"error": "gmail_not_authenticated"})

    # Apply each using corrected _sync_label_to_gmail()
    applied = 0
    failed = 0
    errors = []

    for email_id in pending_emails:
        result = _sync_label_to_gmail(email_id, user_id, service)

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
    if not is_logged_in():
        return JSONResponse(status_code=401, content={"error": "Not logged in."})

    user_id = _require_user_id(request)
    if not user_id:
        return JSONResponse(status_code=401, content={"error": "User session not found."})

    return {"labels": get_labels(user_id)}


@app.get("/settings/labels")
async def get_settings_labels(request: Request):
    """GET /settings/labels — Alias for GET /labels for backward compatibility."""
    if not is_logged_in():
        return JSONResponse(status_code=401, content={"error": "Not logged in."})

    user_id = _require_user_id(request)
    if not user_id:
        return JSONResponse(status_code=401, content={"error": "User session not found."})

    return {"labels": get_labels(user_id)}


@app.post("/labels")
async def create_label(request: Request):
    """POST /labels — Create a new custom label."""
    if not is_logged_in():
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
    if not is_logged_in():
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
    if not is_logged_in():
        return JSONResponse(status_code=401, content={"error": "Not logged in."})

    user_id = _require_user_id(request)
    if not user_id:
        return JSONResponse(status_code=401, content={"error": "User session not found."})

    delete_label(label_id, user_id)
    return {"message": "Label deleted"}


@app.delete("/settings/labels/{label_name}")
async def remove_settings_label(label_name: str, request: Request):
    """DELETE /settings/labels/{label_name} — Backward compat delete by name."""
    if not is_logged_in():
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
    if not is_logged_in():
        return JSONResponse(status_code=401, content={"error": "Not logged in."})

    user_id = _require_user_id(request)
    if not user_id:
        return JSONResponse(status_code=401, content={"error": "User session not found."})

    reset_database(user_id)
    return {"message": "Database wiped successfully. You can now re-fetch emails from the beginning."}


# ---------- DELETE MODE ENDPOINTS ----------

@app.get("/settings/delete-mode")
async def get_delete_mode_endpoint(request: Request):
    """GET /settings/delete-mode — Returns current delete mode ('trash' or 'permanent')."""
    if not is_logged_in():
        return JSONResponse(status_code=401, content={"error": "Not logged in."})

    user_id = _require_user_id(request)
    if not user_id:
        return JSONResponse(status_code=401, content={"error": "User session not found."})

    mode = get_delete_mode(user_id)
    return {"delete_mode": mode}


@app.put("/settings/delete-mode")
async def update_delete_mode_endpoint(request: Request):
    """PUT /settings/delete-mode — Update delete mode to 'trash' or 'permanent'."""
    if not is_logged_in():
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
    if not is_logged_in():
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
    status = ai_router.get_status()
    return {"providers": status}


# ---------- SECURITY SCAN ENDPOINT ----------

@app.post("/security/scan-email")
async def security_scan_email(request: Request):
    """POST /security/scan-email — Scan email URLs for threats."""
    if not is_logged_in():
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
    if not is_logged_in():
        return JSONResponse(status_code=401, content={"error": "Not logged in."})

    user_id = _require_user_id(request)
    if not user_id:
        return JSONResponse(status_code=401, content={"error": "User session not found."})

    emails = get_analyzed_emails(user_id)
    quarantined = [e for e in emails if e.get("is_quarantined") == 1]
    return {"emails": quarantined, "count": len(quarantined)}


@app.post("/quarantine/{email_id}/safe")
async def quarantine_mark_safe(email_id: str, request: Request):
    """POST /quarantine/{email_id}/safe — Removes quarantine flag."""
    if not is_logged_in():
        return JSONResponse(status_code=401, content={"error": "Not logged in."})

    user_id = _require_user_id(request)
    if not user_id:
        return JSONResponse(status_code=401, content={"error": "User session not found."})

    mark_email_safe(email_id, user_id)
    return {"success": True, "message": f"Email {email_id} marked as safe."}


@app.delete("/quarantine/{email_id}")
async def quarantine_delete(email_id: str, request: Request):
    """DELETE /quarantine/{email_id} — Delete email using user's preferred mode."""
    if not is_logged_in():
        return JSONResponse(status_code=401, content={"error": "Not logged in."})

    user_id = _require_user_id(request)
    if not user_id:
        return JSONResponse(status_code=401, content={"error": "User session not found."})

    mode = get_delete_mode(user_id)
    success = delete_email(email_id, user_id)
    if success:
        mark_email_safe(email_id, user_id)
        action = "permanently deleted" if mode == "permanent" else "moved to trash"
        return {"success": True, "message": f"Email {email_id} {action}."}
    return JSONResponse(status_code=500, content={"error": "Failed to delete email."})


# ---------- SCAM ALERTS ENDPOINT ----------

@app.get("/scam/alerts")
async def scam_alerts(request: Request, min_score: int = 30):
    """GET /scam/alerts?min_score=30 — Returns flagged emails sorted by scam score."""
    if not is_logged_in():
        return JSONResponse(status_code=401, content={"error": "Not logged in."})

    user_id = _require_user_id(request)
    if not user_id:
        return JSONResponse(status_code=401, content={"error": "User session not found."})

    emails = get_analyzed_emails(user_id)
    flagged = [e for e in emails if e.get("scam_score", 0) >= min_score]
    flagged.sort(key=lambda x: x.get("scam_score", 0), reverse=True)
    return {"emails": flagged, "count": len(flagged)}


# ---------- BATCH DELETE ENDPOINT ----------

@app.post("/emails/batch-delete")
async def emails_batch_delete(request: Request):
    """POST /emails/batch-delete — Trash and delete matching emails."""
    if not is_logged_in():
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
        success = delete_email(email["email_id"], user_id)
        if success:
            deleted += 1
        else:
            failed += 1

    return {"deleted": deleted, "failed": failed, "total": len(matching)}


# ---------- STATS ENDPOINT ----------

@app.get("/emails/stats")
async def emails_stats(request: Request):
    """GET /emails/stats — Returns summary statistics."""
    if not is_logged_in():
        return JSONResponse(status_code=401, content={"error": "Not logged in."})

    user_id = _require_user_id(request)
    if not user_id:
        return {"total_analyzed": 0, "total_quarantined": 0, "total_flagged": 0}

    emails = get_analyzed_emails(user_id)
    total_analyzed = len(emails)
    total_quarantined = sum(1 for e in emails if e.get("is_quarantined") == 1)
    total_flagged = sum(1 for e in emails if e.get("scam_score", 0) >= 30)

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
