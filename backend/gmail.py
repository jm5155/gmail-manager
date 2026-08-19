"""
gmail.py — Gmail API Integration Module (Restructured)
Fetches emails from the user's Gmail inbox using the Gmail API.
Uses the OAuth token from auth.py for authentication.
Includes the AI-only bulk analysis pipeline (Steps A through I).
"""

import json
import asyncio
import socket
socket.setdefaulttimeout(15)
from googleapiclient.discovery import build
from googleapiclient.http import BatchHttpRequest
import httpx
import socket
socket.setdefaulttimeout(15)
from auth import get_credentials
from database import (
    is_already_analyzed, save_analyzed_email,
    get_scan_cursor, save_scan_cursor,
    get_labels, get_label_id_by_name,
    get_user_email_by_id,
    add_to_retry_queue, remove_from_retry_queue,
)


def get_gmail_service(user_email: str = None):
    """
    Build and return a Gmail API service instance for a specific user.
    Uses the DB-stored OAuth credentials for that user (keyed by gmail_address).
    Returns None if the user is not authenticated.
    """
    creds = get_credentials(user_email)
    if not creds:
        print("[GMAIL] No valid credentials found. User needs to log in.")
        return None

    service = build("gmail", "v1", credentials=creds)
    print("[GMAIL] Gmail service initialized.")
    return service


def fetch_emails(limit: int = 50, page_token: str | None = None, user_email: str = None) -> dict:
    """
    Fetch emails from Gmail in reverse chronological order (newest first).
    Uses parallel fetching for dramatically faster email retrieval.

    Args:
        limit: Maximum number of emails to retrieve (default 50)
        page_token: Gmail pagination token for fetching the next page

    Returns:
        Dict with keys:
          - emails: list[dict] — the parsed emails
          - next_page_token: str | None — cursor for the next scan
    """
    from concurrent.futures import ThreadPoolExecutor, as_completed

    service = get_gmail_service(user_email)
    if not service:
        return {"emails": [], "next_page_token": None}

    try:
        # Step 1: Collect message IDs (lightweight API call — only returns id + threadId)
        message_ids = []
        current_token = page_token

        import sys

        print(f"[GMAIL] Starting list loop... limit={limit}, token={page_token}", flush=True)

        while len(message_ids) < limit:
            print(f"[GMAIL] Requesting list batch...", flush=True)
            response = service.users().messages().list(
                userId="me",
                maxResults=min(limit - len(message_ids), 50),
                pageToken=current_token if current_token else None,
            ).execute()

            messages = response.get("messages", [])
            print(f"[GMAIL] Received batch of {len(messages)} messages.", flush=True)
            if not messages:
                break

            message_ids.extend([msg["id"] for msg in messages])

            current_token = response.get("nextPageToken")
            print(f"[GMAIL] current message batch size is {len(message_ids)}. Next token is {current_token}", flush=True)
            if not current_token:
                break

        message_ids = message_ids[:limit]
        print(f"[GMAIL] Got {len(message_ids)} message IDs. Fetching details via batch HTTP...", flush=True)

        # Step 2: Fetch full details using Gmail's batch endpoint.
        # Gmail enforces a hard cap of 50 sub-requests per batch, so we chunk
        # into groups of 50 and run those chunks concurrently across threads
        # (each thread builds its own Gmail service instance to avoid
        # httplib2 shared-connection deadlock).
        creds = get_credentials(user_email)
        chunks = [message_ids[i:i + 50] for i in range(0, len(message_ids), 50)]
        collected = []
        with ThreadPoolExecutor(max_workers=min(4, len(chunks) or 1)) as executor:
            future_to_chunk = {
                executor.submit(_get_email_details_batch_threadsafe, creds, chunk): chunk
                for chunk in chunks
            }
            for future in as_completed(future_to_chunk):
                collected.extend(future.result())

        # Preserve original order (reverse-chronological from Gmail)
        id_order = {mid: idx for idx, mid in enumerate(message_ids)}
        collected.sort(key=lambda e: id_order.get(e["id"], 999))

        print(f"[GMAIL] Fetched {len(collected)} emails (batched). Next cursor: {current_token}")

        return {
            "emails": collected,
            "next_page_token": current_token,
        }

    except Exception as e:
        print(f"[GMAIL] Error fetching emails: {e}")
        return {"emails": [], "next_page_token": None}


def _parse_email_metadata(email_id: str, msg: dict) -> dict:
    """
    Parse a Gmail messages().get(format="metadata") response into our
    internal email dict shape. Shared by both the single-fetch and
    batch-fetch code paths so parsing logic stays in one place.
    Body is left empty - fetched on-demand via _get_email_body().
    """
    headers = {h["name"]: h["value"] for h in msg.get("payload", {}).get("headers", [])}

    return {
        "id": email_id,
        "subject": headers.get("Subject", "(No Subject)"),
        "sender": headers.get("From", "(Unknown Sender)"),
        "snippet": msg.get("snippet", ""),
        "date": headers.get("Date", ""),
        "labels": msg.get("labelIds", []),
        "body": "",  # Empty - body fetched on-demand via _get_email_body()
    }


def _get_email_details_batch_threadsafe(creds, email_ids: list[str]) -> list[dict]:
    """
    Thread-safe wrapper: builds its own Gmail service instance per call
    (to avoid httplib2 shared-connection deadlocks) and fetches up to 50
    messages' metadata in a single Gmail BatchHttpRequest (1 HTTP round-trip
    instead of one per message).
    """
    try:
        svc = build("gmail", "v1", credentials=creds, cache_discovery=False)
        return _get_email_details_batch(svc, email_ids)
    except Exception as e:
        print(f"[GMAIL] Batch fetch failed for chunk of {len(email_ids)}: {e}")
        return []


def _get_email_details_batch(service, email_ids: list[str]) -> list[dict]:
    """
    Fetch lightweight metadata for up to 50 emails in a single Gmail
    BatchHttpRequest. Gmail caps batches at 50 sub-requests; callers are
    responsible for chunking larger ID lists before calling this.
    """
    if not email_ids:
        return []

    import time

    results: dict[str, dict] = {}
    pending_ids = list(email_ids)

    for attempt in range(3):
        if not pending_ids:
            break

        errors: dict[str, Exception] = {}

        def _callback(request_id, response, exception):
            if exception is not None:
                errors[request_id] = exception
            else:
                results[request_id] = response

        batch = service.new_batch_http_request(callback=_callback)
        for mid in pending_ids:
            batch.add(
                service.users().messages().get(
                    userId="me",
                    id=mid,
                    format="metadata",
                    metadataHeaders=["Subject", "From", "Date"],
                ),
                request_id=mid,
            )

        batch.execute()
        pending_ids = []
        retry_ids = []
        for mid, exc in errors.items():
            status = getattr(getattr(exc, "resp", None), "status", None)
            if status == 429:
                retry_ids.append(mid)
            else:
                print(f"[GMAIL] Error fetching email {mid} (batch): {exc}")

        if retry_ids:
            pending_ids = retry_ids
            if attempt < 2:
                delay = 2 ** attempt
                print(f"[GMAIL] Batch fetch rate-limited for {len(retry_ids)} emails; retrying in {delay}s", flush=True)
                time.sleep(delay)

    for mid in pending_ids:
        print(f"[GMAIL] Dropping email {mid} after batch fetch retries", flush=True)

    return [_parse_email_metadata(mid, results[mid]) for mid in email_ids if mid in results]


def _get_email_details_threadsafe(creds, email_id: str) -> dict | None:
    """
    Thread-safe wrapper: builds its own Gmail service instance per call
    to avoid httplib2 shared-connection deadlocks.
    """
    try:
        svc = build("gmail", "v1", credentials=creds, cache_discovery=False)
        return _get_email_details(svc, email_id)
    except Exception as e:
        print(f"[GMAIL] Thread-safe fetch failed for {email_id}: {e}")
        return None


def _get_email_details(service, email_id: str) -> dict | None:
    """
    Fetch lightweight metadata for a single email by its ID.
    Extracts subject, sender, snippet, date, and labels (no body - use _get_email_body for that).
    Body is deferred to on-demand fetch via _get_email_body() to reduce initial fetch payload size.
    """
    try:
        msg = service.users().messages().get(
            userId="me",
            id=email_id,
            format="metadata",
            metadataHeaders=["Subject", "From", "Date"],
        ).execute()

        return _parse_email_metadata(email_id, msg)

    except Exception as e:
        print(f"[GMAIL] Error fetching email {email_id}: {e}")
        return None


def _get_email_body(service, email_id: str) -> str:
    """
    Fetch only the body text of a single email by its ID.
    Use this after _get_email_details() when body content is needed for AI analysis.
    """
    try:
        msg = service.users().messages().get(
            userId="me",
            id=email_id,
            format="full",
        ).execute()

        return _extract_body(msg.get("payload", {}))

    except Exception as e:
        print(f"[GMAIL] Error fetching body for email {email_id}: {e}")
        return ""


def _extract_body(payload: dict) -> str:
    """
    Recursively extract the plain text body from a Gmail message payload.
    Handles multipart messages by looking for text/plain parts first.
    """
    import base64

    if "body" in payload and payload["body"].get("data"):
        data = payload["body"]["data"]
        return base64.urlsafe_b64decode(data).decode("utf-8", errors="replace")

    if "parts" in payload:
        for part in payload["parts"]:
            mime_type = part.get("mimeType", "")

            if mime_type == "text/plain" and part.get("body", {}).get("data"):
                data = part["body"]["data"]
                return base64.urlsafe_b64decode(data).decode("utf-8", errors="replace")

            if mime_type.startswith("multipart/"):
                result = _extract_body(part)
                if result:
                    return result

        for part in payload["parts"]:
            if part.get("mimeType") == "text/html" and part.get("body", {}).get("data"):
                data = part["body"]["data"]
                return base64.urlsafe_b64decode(data).decode("utf-8", errors="replace")

    return ""


# ---------- GMAIL LABEL MANAGEMENT ----------

# Gmail API only accepts colors from this fixed palette.
# Full list: https://developers.google.com/gmail/api/reference/rest/v1/users.labels
GMAIL_LABEL_COLORS = [
    # (backgroundColor, textColor)
    ("#000000", "#ffffff"), ("#434343", "#ffffff"), ("#666666", "#ffffff"),
    ("#999999", "#ffffff"), ("#cccccc", "#000000"), ("#efefef", "#000000"),
    ("#f3f3f3", "#000000"), ("#ffffff", "#000000"),
    ("#fb4c2f", "#ffffff"), ("#ffad47", "#000000"), ("#fad165", "#000000"),
    ("#16a766", "#ffffff"), ("#43d692", "#000000"), ("#4a86e8", "#ffffff"),
    ("#a479e2", "#ffffff"), ("#f691b3", "#000000"), ("#f6c5be", "#000000"),
    ("#ffe6c7", "#000000"), ("#fef1d1", "#000000"), ("#b9e4d0", "#000000"),
    ("#c6f3de", "#000000"), ("#c9daf8", "#000000"), ("#e4d7f5", "#000000"),
    ("#fcdee8", "#000000"), ("#efa093", "#000000"), ("#ffd6a2", "#000000"),
    ("#fce8b3", "#000000"), ("#89d3b2", "#000000"), ("#a0eac9", "#000000"),
    ("#a4c2f4", "#000000"), ("#b694e8", "#000000"), ("#f7a7c0", "#000000"),
    ("#cc3a21", "#ffffff"), ("#eaa041", "#000000"), ("#f2c960", "#000000"),
    ("#149e60", "#ffffff"), ("#3dc789", "#000000"), ("#3c78d8", "#ffffff"),
    ("#8e63ce", "#ffffff"), ("#e07798", "#000000"), ("#ac2b16", "#ffffff"),
    ("#cf8933", "#000000"), ("#d5ae49", "#000000"), ("#0b804b", "#ffffff"),
    ("#2a9c68", "#000000"), ("#285bac", "#ffffff"), ("#653e9b", "#ffffff"),
    ("#b65775", "#ffffff"), ("#822111", "#ffffff"), ("#a46a21", "#000000"),
    ("#aa8831", "#000000"), ("#076239", "#ffffff"), ("#1a764d", "#000000"),
    ("#1c4587", "#ffffff"), ("#41236d", "#ffffff"), ("#83334c", "#ffffff"),
]


def _hex_to_rgb(hex_color: str) -> tuple:
    """Convert #RRGGBB to (R, G, B) tuple."""
    hex_color = hex_color.lstrip("#")
    if len(hex_color) == 3:
        hex_color = "".join(c * 2 for c in hex_color)
    return tuple(int(hex_color[i:i + 2], 16) for i in (0, 2, 4))


def _color_distance(c1: tuple, c2: tuple) -> float:
    """Euclidean distance between two RGB tuples."""
    return sum((a - b) ** 2 for a, b in zip(c1, c2)) ** 0.5


def _nearest_gmail_color(hex_bg: str, hex_text: str) -> tuple:
    """
    Map an arbitrary hex color pair to the nearest Gmail-approved label color.
    Returns (backgroundColor, textColor) from the Gmail palette.
    """
    target_rgb = _hex_to_rgb(hex_bg)
    best = GMAIL_LABEL_COLORS[0]
    best_dist = float("inf")

    for gmail_bg, gmail_text in GMAIL_LABEL_COLORS:
        dist = _color_distance(target_rgb, _hex_to_rgb(gmail_bg))
        if dist < best_dist:
            best_dist = dist
            best = (gmail_bg, gmail_text)

    return best


def get_or_create_label(user_email: str, label_name: str, user_id: int, gmail_labels_cache: dict[str, str]) -> str | None:
    """
    Get an existing Gmail label by name, or create it if it doesn't exist.
    Maps database colors to Gmail-approved palette colors.
    
    Builds a thread-local Gmail service object to ensure thread safety.

    Args:
        user_email: Gmail address for authentication (builds fresh service per call)
        label_name: The label name (e.g., "Work", "Finance")
        user_id: The user ID for fetching label colors
        gmail_labels_cache: Cache mapping label names to IDs (shared across batch)

    Returns:
        The label ID string, or None on failure
    """
    # Build fresh service per call for thread safety (httplib2.Http is not thread-safe)
    service = get_gmail_service(user_email)
    if not service:
        return None
        
    try:
        labels_db = get_labels(user_id)
        label_info = next(
            (l for l in labels_db if l["label_name"].casefold() == label_name.casefold()),
            None,
        )

        db_bg = label_info["bg_color"] if label_info else "#999999"
        db_text = label_info["text_color"] if label_info else "#FFFFFF"

        # Map to Gmail-approved colors (arbitrary hex causes 400 errors)
        gmail_bg, gmail_text = _nearest_gmail_color(db_bg, db_text)

        # Check the batch-scoped Gmail label cache before making an API call.
        prefix = f"GM/{label_name}"
        cached_label_id = gmail_labels_cache.get(prefix)
        if cached_label_id:
            return cached_label_id

        # Create new label with Gmail-approved colors
        label_body = {
            "name": prefix,
            "labelListVisibility": "labelShow",
            "messageListVisibility": "show",
            "color": {"backgroundColor": gmail_bg, "textColor": gmail_text},
        }

        created = service.users().labels().create(userId="me", body=label_body).execute()
        gmail_labels_cache[prefix] = created["id"]
        print(f"[GMAIL] Created new label '{prefix}' (ID: {created['id']}, color: {gmail_bg}).")
        return created["id"]

    except Exception as e:
        # Surface the full error so label sync issues are visible
        print(f"[GMAIL] ERROR creating/getting label '{label_name}': {type(e).__name__}: {e}")
        return None


def apply_label(user_email: str, email_id: str, label_id: str):
    """
    Apply a Gmail label to a specific email.
    Builds a thread-local Gmail service object to ensure thread safety.
    """
    # Build fresh service per call for thread safety (httplib2.Http is not thread-safe)
    service = get_gmail_service(user_email)
    if not service:
        print(f"[GMAIL] Cannot apply label: service unavailable for {user_email}")
        return
        
    try:
        service.users().messages().modify(
            userId="me",
            id=email_id,
            body={"addLabelIds": [label_id]},
        ).execute()
        print(f"[GMAIL] Applied label {label_id} to email {email_id[:12]}...")
    except Exception as e:
        print(f"[GMAIL] Error applying label to {email_id}: {e}")


def change_label(user_email: str, email_id: str, old_label_id: str | None, new_label_id: str):
    """
    Replace one Gmail label with another on an email.
    Removes old_label_id (if provided) and adds new_label_id in a single modify() call.
    Builds a thread-local Gmail service object to ensure thread safety.
    """
    # Build fresh service per call for thread safety (httplib2.Http is not thread-safe)
    service = get_gmail_service(user_email)
    if not service:
        print(f"[GMAIL] Cannot change label: service unavailable for {user_email}")
        return
        
    try:
        body = {}
        if old_label_id:
            body["removeLabelIds"] = [old_label_id]
        if new_label_id:
            body["addLabelIds"] = [new_label_id]

        service.users().messages().modify(
            userId="me",
            id=email_id,
            body=body,
        ).execute()
        print(f"[GMAIL] Changed label on {email_id[:12]}... (removed: {old_label_id or 'none'}, added: {new_label_id})")
    except Exception as e:
        print(f"[GMAIL] Error changing label on {email_id}: {e}")
        raise


def trash_email(email_id: str, user_email: str = None) -> bool:
    """Move an email to Gmail trash (NOT permanent delete)."""
    service = get_gmail_service(user_email)
    if not service:
        return False

    try:
        service.users().messages().trash(userId="me", id=email_id).execute()
        print(f"[GMAIL] Trashed email {email_id[:12]}...")
        return True
    except Exception as e:
        print(f"[GMAIL] Error trashing email {email_id}: {e}")
        return False


def permanently_delete_email(email_id: str, user_email: str = None) -> bool:
    """Permanently delete an email from Gmail (IRREVERSIBLE)."""
    service = get_gmail_service(user_email)
    if not service:
        return False

    try:
        service.users().messages().delete(userId="me", id=email_id).execute()
        print(f"[GMAIL] PERMANENTLY DELETED email {email_id[:12]}...")
        return True
    except Exception as e:
        print(f"[GMAIL] Error permanently deleting email {email_id}: {e}")
        return False


def delete_email(email_id: str, user_id: int, user_email: str = None) -> bool:
    """
    Delete an email using the user's preferred mode (trash or permanent).
    Reads delete_mode from the database.
    """
    from database import get_delete_mode

    if user_email is None and user_id is not None:
        user_email = get_user_email_by_id(user_id)

    mode = get_delete_mode(user_id)
    if mode == "permanent":
        return permanently_delete_email(email_id, user_email)
    else:
        return trash_email(email_id, user_email)


# ---------- BULK AI ANALYSIS PIPELINE (Steps A through I) ----------

async def analyze_bulk_ordered(limit: int = 50, user_id: int = None, user_email: str = None):
    """
    AI-only bulk analysis engine with semaphore-controlled concurrency.
    Yields progress events via SSE as emails finish processing.
    Processes exactly `limit` emails per scan in reverse chronological order.
    Every email passes through the AI cascade — no rule-based shortcuts.

    Args:
        limit: Maximum number of emails to process
        user_id: The authenticated user's ID
        user_email: The authenticated user's gmail_address (used to load their token)
    """
    from ai_router import ai_router, CLASSIFICATION_PROMPT
    from security import extract_urls, scan_url
    import httpx
    import time

    t_bulk_start = time.perf_counter()

    if user_email is None and user_id is not None:
        user_email = get_user_email_by_id(user_id)

    semaphore = asyncio.Semaphore(4)
    url_semaphore = asyncio.Semaphore(8)
    service = get_gmail_service(user_email)
    if not service or user_id is None:
        yield {
            "type": "complete",
            "analyzed": 0,
            "skipped": 0,
            "failed": 0,
            "results": [],
        }
        return

    gmail_labels_result = await asyncio.to_thread(
        lambda: service.users().labels().list(userId="me").execute()
    )
    gmail_labels_cache = {
        lbl["name"]: lbl["id"] for lbl in gmail_labels_result.get("labels", [])
    }

    # Cache labels once per bulk run (instead of per-email DB query)
    available_labels_list = await asyncio.to_thread(get_labels, user_id)
    available_label_names = [lbl["label_name"] for lbl in available_labels_list]

    async with httpx.AsyncClient(timeout=10.0, limits=httpx.Limits(max_connections=50)) as url_client:
        # Emit initializing event immediately so the frontend gets instant feedback
        yield {
            "type": "initializing",
            "message": "Fetching emails from Gmail...",
        }

        # Fetch emails with cursor-based pagination
        # IMPORTANT: Run synchronous Gmail API calls in a thread to avoid blocking the async event loop
        cursor = get_scan_cursor(user_id)
        try:
            fetch_result = await asyncio.wait_for(
                asyncio.to_thread(fetch_emails, limit=limit, page_token=cursor, user_email=user_email),
                timeout=60,
            )
        except asyncio.TimeoutError:
            yield {
                "type": "complete",
                "analyzed": 0,
                "skipped": 0,
                "failed": 0,
                "results": [],
                "error": "Gmail fetch timed out after 60 seconds. Check network connectivity.",
            }
            return
        fetched_emails = fetch_result["emails"]
        next_token = fetch_result["next_page_token"]

        # Save cursor for next scan
        if next_token:
            save_scan_cursor(user_id, next_token)

        # Filter out already analyzed emails (Step A — dedup at batch level)
        def _dedup_emails():
            new = []
            skipped = 0
            for email in fetched_emails:
                if is_already_analyzed(email["id"], user_id):
                    skipped += 1
                else:
                    new.append(email)
            return new, skipped

        new_emails, skipped_count = await asyncio.to_thread(_dedup_emails)

        print(f"[PIPELINE] {len(new_emails)} new emails to analyze, {skipped_count} already cached.")

        total = len(new_emails)
        if total == 0:
            yield {
                "type": "complete",
                "analyzed": 0,
                "skipped": skipped_count,
                "failed": 0,
                "results": [],
            }
            return

        # Create parallel analysis tasks
        tasks = []
        try:
            tasks = [
                asyncio.create_task(_analyze_one(
                    email=email,
                    semaphore=semaphore,
                    ai_router=ai_router,
                    classification_prompt=CLASSIFICATION_PROMPT,
                    user_id=user_id,
                    user_email=user_email,
                    service=service,
                    url_client=url_client,
                    url_semaphore=url_semaphore,
                    available_label_names=available_label_names,
                    gmail_labels_cache=gmail_labels_cache,
                ))
                for email in new_emails
            ]

            # Yield progress as tasks complete
            completed = 0
            failed_count = 0
            all_results = []

            for task in asyncio.as_completed(tasks):
                res = await task
                completed += 1

                if res["status"] == "failed":
                    failed_count += 1

                all_results.append(res)

                # Step I — Send SSE progress event
                yield {
                    "type": "email_done",
                    "email_id": res.get("email_id", ""),
                    "sender": res.get("sender", ""),
                    "subject": res.get("subject", ""),
                    "label": res.get("label", ""),
                    "scam_score": res.get("scam_score", 0),
                    "is_quarantined": res.get("is_quarantined", 0),
                    "progress": completed,
                    "total": total,
                }

            # Final summary
            analyzed_count = sum(1 for r in all_results if r["status"] == "success")

            t_bulk_total = time.perf_counter() - t_bulk_start
            print(f"[TIMING] BULK COMPLETE: total_time={t_bulk_total:.2f}s analyzed={analyzed_count} "
                  f"skipped={skipped_count} failed={failed_count} "
                  f"(fetched {len(fetched_emails)} emails, {len(new_emails)} were new)")

            yield {
                "type": "complete",
                "analyzed": analyzed_count,
                "skipped": skipped_count,
                "failed": failed_count,
                "results": all_results,
            }
        finally:
            # Cancel any tasks still in flight (e.g. SSE disconnect injected GeneratorExit)
            # before url_client closes, so they never call client.post() on a closed client.
            for task in tasks:
                if not task.done():
                    task.cancel()
            await asyncio.gather(*tasks, return_exceptions=True)


async def _analyze_one(email: dict, semaphore: asyncio.Semaphore,
                       ai_router, classification_prompt: str,
                       user_id: int, user_email: str, service,
                       url_client: httpx.AsyncClient,
                       url_semaphore: asyncio.Semaphore,
                       available_label_names: list[str],
                       gmail_labels_cache: dict[str, str],
                       update_mode: bool = False) -> dict:
    """
    Analyze a single email through the AI-only pipeline (Steps A through I).
    No rule-based pre-filter. Every email goes through the AI cascade.

    Args:
        email: Email dict with keys: id, subject, sender, body, snippet
        semaphore: asyncio.Semaphore to limit concurrency
        ai_router: The AIRouter instance
        classification_prompt: The CLASSIFICATION_PROMPT template
        user_id: The authenticated user's ID
        service: Gmail API service instance
        available_label_names: Cached list of label names for this user
    """
    from security import extract_urls, scan_url
    import time

    async with semaphore:
        t_start = time.perf_counter()
        email_id = email["id"]
        subject = email.get("subject", "(No Subject)")
        sender = email.get("sender", "(Unknown)")
        body = email.get("body", "")
        snippet = email.get("snippet", "")

        # Timing accumulators
        t_body_fetch = 0.0
        t_url_scan = 0.0
        t_ai_call = 0.0
        t_label_apply = 0.0
        t_db_write = 0.0

        try:
            # Step A — Deduplication check (per-email level)
            # Skip this check in update_mode (emails already exist with status='fetched' by design)
            if not update_mode and is_already_analyzed(email_id, user_id):
                return {
                    "email_id": email_id,
                    "subject": subject,
                    "sender": sender,
                    "status": "skipped",
                    "label": "",
                    "scam_score": 0,
                    "is_quarantined": 0,
                }

            # Fetch full email body for AI analysis (if not already present)
            # Safety fallback - body should already be populated from format="full" fetch
            if not body:
                t0 = time.perf_counter()
                body = await asyncio.to_thread(_get_email_body, service, email_id)
                t_body_fetch = time.perf_counter() - t0

            # Use cached label names passed from analyze_bulk_ordered()
            default_label = available_label_names[0] if available_label_names else "Unknown"

            # Insert placeholder to satisfy FK constraints (skip if updating existing row)
            if not update_mode:
                t0 = time.perf_counter()
                placeholder_label_id = get_label_id_by_name(user_id, default_label)
                save_analyzed_email(
                    email_id=email_id,
                    user_id=user_id,
                    label_id=placeholder_label_id,
                    scam_score=0,
                    scam_indicators="[]",
                    is_quarantined=0,
                    snippet=snippet,
                    sender=sender,
                    subject=subject,
                    status='labeled',
                    body=body,
                )
                t_db_write += time.perf_counter() - t0

            # Step B — URL extraction and Google Safe Browsing scan
            t0 = time.perf_counter()
            urls = extract_urls(body)
            # Cap at 10 URLs per email to prevent 3+ minute scan delays on emails with 79-88 URLs
            if len(urls) > 10:
                print(f"[SECURITY] Capping URL scan from {len(urls)} to 10 URLs for email {email_id[:12]}...")
                urls = urls[:10]
            url_threat_found = False
            if urls:
                scan_tasks = [scan_url(url, email_id, url_client, url_semaphore) for url in urls]
                results = await asyncio.gather(*scan_tasks)
                url_threat_found = any(r["is_safe"] == 0 for r in results)
            t_url_scan = time.perf_counter() - t0

            # Step C — AI cascade classification and scam scoring
            prompt = classification_prompt.format(
                sender=sender,
                subject=subject,
                body=body[:1500],  # First 1500 characters, truncated
                url_threat_found=url_threat_found,
                available_labels=", ".join(available_label_names),
            )

            t0 = time.perf_counter()
            ai_result = await ai_router.analyze_json(prompt)
            t_ai_call = time.perf_counter() - t0
            provider_used = ai_result.get("provider_used", "unknown")

            # Defaults — use first available label as fallback (no hardcoded 'Spam')
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
                # AI cascade fully failed — add to retry queue and return
                raise Exception(ai_result["error"])

            # Step D — Validate AI output
            # label must match one of available_labels (case-insensitive, whitespace-trimmed)
            label_normalized = label.strip()
            label_match = None
            
            # Try exact match first
            if label_normalized in available_label_names:
                label_match = label_normalized
            else:
                # Try case-insensitive match
                label_lower = label_normalized.lower()
                for available_label in available_label_names:
                    if available_label.lower() == label_lower:
                        label_match = available_label
                        break
            
            if label_match:
                label = label_match
            else:
                # No match found - log the mismatch and fall back to default
                print(f"[AI LABEL MISMATCH] email={email_id[:12]}... AI returned label='{label}' but not in available_labels={available_label_names}, falling back to '{default_label}'", flush=True)
                label = default_label

            # scam_score must be 0-100
            if not isinstance(scam_score, int):
                try:
                    scam_score = int(scam_score)
                except (ValueError, TypeError):
                    scam_score = 0
            scam_score = max(0, min(100, scam_score))

            # scam_indicators must be a list of strings
            if scam_indicators is None or not isinstance(scam_indicators, list):
                scam_indicators = []

            # Step E — Determine quarantine flag
            # is_quarantined = 1 if ALL THREE conditions are true
            is_quarantined = 0
            label_is_spam_like = label == "Spam" or "scam" in label.lower()
            if scam_score >= 70 and url_threat_found and label_is_spam_like:
                is_quarantined = 1

            # Step F — Resolve label_id
            label_id = get_label_id_by_name(user_id, label)

            # Step G — Save to database (UPDATE if update_mode, INSERT if new)
            t0 = time.perf_counter()
            if update_mode:
                # Updating existing row from label_only_pipeline
                from database import update_analyzed_email
                update_analyzed_email(
                    email_id=email_id,
                    label_id=label_id,
                    scam_score=scam_score,
                    scam_indicators=json.dumps(scam_indicators),
                    is_quarantined=is_quarantined,
                    status='labeled',
                )
            else:
                # New email from analyze_bulk_ordered (overwrites placeholder)
                save_analyzed_email(
                    email_id=email_id,
                    user_id=user_id,
                    label_id=label_id,
                    scam_score=scam_score,
                    scam_indicators=json.dumps(scam_indicators),
                    is_quarantined=is_quarantined,
                    snippet=snippet,
                    sender=sender,
                    subject=subject,
                    status='labeled',
                    body=body,
                )
            t_db_write += time.perf_counter() - t0

            # Step H — Apply Gmail label
            t0 = time.perf_counter()
            try:
                gmail_label_id = await asyncio.to_thread(
                    get_or_create_label, user_email, label, user_id, gmail_labels_cache
                )
                if gmail_label_id:
                    await asyncio.to_thread(apply_label, user_email, email_id, gmail_label_id)
            except Exception as e:
                print(f"[PIPELINE] Failed to apply Gmail label for {email_id[:12]}...: {e}")
                # Do not crash — continue to next email
            t_label_apply = time.perf_counter() - t0

            t_total = time.perf_counter() - t_start
            print(f"[TIMING] email={email_id[:12]} body={t_body_fetch:.2f}s url_scan={t_url_scan:.2f}s "
                  f"ai_call={t_ai_call:.2f}s(provider={provider_used}) label={t_label_apply:.2f}s "
                  f"db={t_db_write:.2f}s total={t_total:.2f}s")

            return {
                "email_id": email_id,
                "subject": subject,
                "sender": sender,
                "label": label,
                "scam_score": scam_score,
                "is_quarantined": is_quarantined,
                "status": "success",
            }

        except Exception as e:
            print(f"[PIPELINE] FAIL: Analysis failed for {email_id[:12]}...: {e}")

            # Add to retry queue — need a placeholder analyzed_emails row first
            # since retry_queue has FK to analyzed_emails
            try:
                if update_mode:
                    # UPDATE existing row to status='failed' with sentinel values
                    from database import update_analyzed_email
                    update_analyzed_email(
                        email_id=email_id,
                        label_id=None,        # NULL sentinel for failed analysis
                        scam_score=0,         # Default to 0 when analysis fails
                        scam_indicators='[]',
                        is_quarantined=0,
                        status='failed',      # Marks as failed, not fetched
                    )
                else:
                    # INSERT placeholder for new emails (original behavior)
                    fallback_label_id = get_label_id_by_name(user_id, label if 'label' in locals() and label else "Unknown")
                    save_analyzed_email(
                        email_id=email_id,
                        user_id=user_id,
                        label_id=fallback_label_id,
                        scam_score=0,
                        scam_indicators="[]",
                        is_quarantined=0,
                        snippet=snippet,
                        sender=sender,
                        subject=subject,
                        status='failed',      # Also mark as failed (not labeled)
                        body=body,
                    )

                # Route to retry_queue (same path for both update_mode=True/False)
                add_to_retry_queue(email_id, str(e))

            except Exception as retry_err:
                print(f"[PIPELINE] FAIL: Failed to add {email_id[:12]}... to retry queue: {retry_err}")

            return {
                "email_id": email_id,
                "subject": subject,
                "sender": sender,
                "label": "",
                "scam_score": 0,
                "is_quarantined": 0,
                "status": "failed",
                "error": str(e),
            }


# ---------- LEGACY BULK ANALYSIS (kept for backward compat) ----------

async def analyze_bulk(limit: int = 50, user_id: int = None):
    async for event in analyze_bulk_ordered(limit=limit, user_id=user_id):
        yield event


# ---------- DECOUPLED FETCH/LABEL PIPELINES (Phase 24) ----------

async def fetch_only_pipeline(limit: int = 50, user_id: int = None, user_email: str = None):
    """
    Fetch emails from Gmail and save as status='fetched' placeholders.
    No URL scanning, no AI analysis. Yields SSE progress events.
    """
    if user_email is None and user_id is not None:
        user_email = get_user_email_by_id(user_id)

    service = get_gmail_service(user_email)
    if not service or user_id is None:
        yield {"type": "complete", "fetched": 0, "skipped": 0, "error": "Not authenticated"}
        return

    yield {"type": "initializing", "message": "Fetching emails from Gmail..."}

    cursor = get_scan_cursor(user_id)
    try:
        fetch_result = await asyncio.to_thread(fetch_emails, limit=limit, page_token=cursor, user_email=user_email)
    except Exception as e:
        yield {"type": "complete", "fetched": 0, "error": str(e)}
        return

    fetched_emails = fetch_result["emails"]
    next_token = fetch_result["next_page_token"]

    if next_token:
        save_scan_cursor(user_id, next_token)

    new_emails = [e for e in fetched_emails if not is_already_analyzed(e["id"], user_id)]

    saved_count = 0
    for email in new_emails:
        try:
            # Fetch full body before saving (metadata fetch returns body="")
            body = email.get("body", "")
            if not body:
                body = await asyncio.to_thread(_get_email_body, service, email["id"])
            
            save_analyzed_email(
                email_id=email["id"],
                user_id=user_id,
                label_id=None,
                scam_score=None,
                scam_indicators='[]',
                is_quarantined=0,
                snippet=email.get("snippet", ""),
                sender=email.get("sender", ""),
                subject=email.get("subject", ""),
                status='fetched',
                body=body,
            )
            saved_count += 1
            yield {"type": "progress", "current": saved_count, "total": len(new_emails)}
        except Exception as e:
            print(f"[FETCH-ONLY] Failed to save {email['id']}: {e}")
            continue

    yield {"type": "complete", "fetched": saved_count, "skipped": len(fetched_emails) - len(new_emails)}


async def label_only_pipeline(limit: int = None, user_id: int = None, user_email: str = None):
    """
    Read status='fetched' emails from DB and run AI analysis.
    Updates rows to status='labeled'. Yields SSE progress events.
    """
    from ai_router import ai_router, CLASSIFICATION_PROMPT
    from database import get_emails_by_status
    import httpx

    if user_email is None and user_id is not None:
        user_email = get_user_email_by_id(user_id)

    semaphore = asyncio.Semaphore(4)
    url_semaphore = asyncio.Semaphore(8)
    service = get_gmail_service(user_email)

    if not service or user_id is None:
        yield {"type": "complete", "analyzed": 0, "failed": 0, "error": "Not authenticated"}
        return

    gmail_labels_result = await asyncio.to_thread(
        lambda: service.users().labels().list(userId="me").execute()
    )
    gmail_labels_cache = {
        lbl["name"]: lbl["id"] for lbl in gmail_labels_result.get("labels", [])
    }

    # Cache labels once per bulk run (instead of per-email DB query)
    available_labels_list = await asyncio.to_thread(get_labels, user_id)
    available_label_names = [lbl["label_name"] for lbl in available_labels_list]

    async with httpx.AsyncClient(timeout=10.0, limits=httpx.Limits(max_connections=50)) as url_client:
        yield {"type": "initializing", "message": "Starting AI analysis..."}

        fetched_emails = get_emails_by_status(user_id, status='fetched', limit=limit)

        if not fetched_emails:
            yield {"type": "complete", "analyzed": 0, "failed": 0}
            return

        total = len(fetched_emails)
        yield {"type": "progress", "current": 0, "total": total}

        tasks = [
            asyncio.create_task(_analyze_one(
                email=email,
                semaphore=semaphore,
                ai_router=ai_router,
                classification_prompt=CLASSIFICATION_PROMPT,
                user_id=user_id,
                user_email=user_email,
                service=service,
                url_client=url_client,
                url_semaphore=url_semaphore,
                available_label_names=available_label_names,
                gmail_labels_cache=gmail_labels_cache,
                update_mode=True,
            ))
            for email in fetched_emails
        ]

        done_queue = asyncio.Queue()
        
        async def track_completion(task, idx):
            result = await task
            await done_queue.put((idx, result))
        
        tracking_tasks = [asyncio.create_task(track_completion(t, i)) for i, t in enumerate(tasks)]
        
        analyzed_count = 0
        failed_count = 0
        results = []
        
        for _ in range(len(tasks)):
            idx, result = await done_queue.get()
            
            if result.get("status") == "failed":
                failed_count += 1
            elif result.get("status") == "success":
                analyzed_count += 1
                results.append(result)
            
            yield {
                "type": "email_done",
                "current": analyzed_count + failed_count,
                "total": total,
                "email_id": result.get("email_id"),
                "subject": result.get("subject"),
                "label": result.get("label", ""),
                "scam_score": result.get("scam_score", 0),
            }
        
        await asyncio.gather(*tracking_tasks)
        
        yield {"type": "complete", "analyzed": analyzed_count, "failed": failed_count, "results": results}

