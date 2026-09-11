"""
gmail.py — Gmail API Integration Module (Restructured)
Fetches emails from the user's Gmail inbox using the Gmail API.
Uses the OAuth token from auth.py for authentication.
Includes the hybrid ML + AI cascade pipeline (Steps A through I).
"""

from logger_setup import get_logger
logger = get_logger(__name__)

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
from ml_inference import predict_async, is_model_available, log_disagreement


def get_gmail_service(user_email: str = None):
    """
    Build and return a Gmail API service instance for a specific user.
    Uses the DB-stored OAuth credentials for that user (keyed by gmail_address).
    Returns None if the user is not authenticated.
    """
    creds = get_credentials(user_email)
    if not creds:
        logger.info("[GMAIL] No valid credentials found. User needs to log in.")
        return None

    service = build("gmail", "v1", credentials=creds)
    logger.info("[GMAIL] Gmail service initialized.")
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

        logger.info(f"[GMAIL] Starting list loop... limit={limit}, token={page_token}")

        while len(message_ids) < limit:
            logger.info(f"[GMAIL] Requesting list batch...")
            response = service.users().messages().list(
                userId="me",
                maxResults=min(limit - len(message_ids), 50),
                pageToken=current_token if current_token else None,
            ).execute()

            messages = response.get("messages", [])
            logger.info(f"[GMAIL] Received batch of {len(messages)} messages.")
            if not messages:
                break

            message_ids.extend([msg["id"] for msg in messages])

            current_token = response.get("nextPageToken")
            logger.info(f"[GMAIL] current message batch size is {len(message_ids)}. Next token is {current_token}")
            if not current_token:
                break

        message_ids = message_ids[:limit]
        logger.info(f"[GMAIL] Got {len(message_ids)} message IDs. Fetching details via batch HTTP...")

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

        logger.info(f"[GMAIL] Fetched {len(collected)} emails (batched). Next cursor: {current_token}")

        return {
            "emails": collected,
            "next_page_token": current_token,
        }

    except Exception as e:
        logger.info(f"[GMAIL] Error fetching emails: {e}")
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
        logger.info(f"[GMAIL] Batch fetch failed for chunk of {len(email_ids)}: {e}")
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
                logger.info(f"[GMAIL] Error fetching email {mid} (batch): {exc}")

        if retry_ids:
            pending_ids = retry_ids
            if attempt < 2:
                delay = 2 ** attempt
                logger.info(f"[GMAIL] Batch fetch rate-limited for {len(retry_ids)} emails; retrying in {delay}s")
                time.sleep(delay)

    for mid in pending_ids:
        logger.info(f"[GMAIL] Dropping email {mid} after batch fetch retries")

    return [_parse_email_metadata(mid, results[mid]) for mid in email_ids if mid in results]


def _get_email_details_threadsafe(creds, email_id: str) -> dict | None:
    """
    Thread-safe wrapper: builds its own Gmail service instance per call
    to avoid httplib2 shared-connection deadlocks.
    Extracts subject, sender, snippet, date, and labels (no body - use _get_email_body for that).
    Body is deferred to on-demand fetch via _get_email_body() to reduce initial fetch payload size.
    """
    try:
        svc = build("gmail", "v1", credentials=creds, cache_discovery=False)
        msg = svc.users().messages().get(
            userId="me",
            id=email_id,
            format="metadata",
            metadataHeaders=["Subject", "From", "Date"],
        ).execute()
        return _parse_email_metadata(email_id, msg)
    except Exception as e:
        logger.info(f"[GMAIL] Error fetching email {email_id}: {e}")
        return None


def _get_email_body(service, email_id: str) -> str:
    """
    Fetch only the body text of a single email by its ID.
    Use this after _get_email_details() when body content is needed for AI analysis.
    IMPROVED (2026-09-11): Better HTML extraction with multipart/related support.
    """
    try:
        msg = service.users().messages().get(
            userId="me",
            id=email_id,
            format="full",
        ).execute()

        return _extract_body(msg.get("payload", {}))

    except Exception as e:
        logger.info(f"[GMAIL] Error fetching body for email {email_id}: {e}")
        return ""


def _extract_body(payload: dict) -> str:
    """
    Recursively extract the email body from a Gmail message payload.
    IMPROVED (2026-09-11): Enhanced HTML extraction to preserve rich formatting.
    
    Gmail email structure:
    - multipart/alternative: contains both text/plain and text/html versions
    - multipart/related: contains HTML + embedded images (inline attachments)
    - multipart/mixed: contains message parts + file attachments
    
    Priority: text/html > text/plain (to get rich formatting, images, styles)
    """
    import base64

    def decode_part(data_str: str) -> str:
        """Decode base64url-encoded Gmail payload data."""
        if not data_str:
            return ""
        try:
            return base64.urlsafe_b64decode(data_str).decode("utf-8", errors="replace")
        except Exception as e:
            logger.debug(f"[GMAIL] Failed to decode part: {e}")
            return ""

    def find_html_part(payload: dict, depth: int = 0) -> str:
        """Recursively search for text/html parts in multipart structures."""
        if depth > 10:  # Prevent infinite recursion
            return ""
        
        mime_type = payload.get("mimeType", "")
        
        # Direct HTML part - return immediately
        if mime_type == "text/html":
            body_data = payload.get("body", {}).get("data", "")
            if body_data:
                return decode_part(body_data)
        
        # Multipart container - recurse into parts
        if mime_type.startswith("multipart/"):
            parts = payload.get("parts", [])
            
            # For multipart/alternative, prefer HTML over plain text
            if mime_type == "multipart/alternative":
                html_content = ""
                plain_content = ""
                
                for part in parts:
                    part_mime = part.get("mimeType", "")
                    if part_mime == "text/html":
                        body_data = part.get("body", {}).get("data", "")
                        if body_data:
                            html_content = decode_part(body_data)
                    elif part_mime == "text/plain":
                        body_data = part.get("body", {}).get("data", "")
                        if body_data:
                            plain_content = decode_part(body_data)
                    elif part_mime.startswith("multipart/"):
                        # Nested multipart (e.g., multipart/related inside multipart/alternative)
                        result = find_html_part(part, depth + 1)
                        if result:
                            return result
                
                # Return HTML if found, otherwise plain text
                return html_content or plain_content
            
            # For other multipart types, recursively search all parts
            for part in parts:
                result = find_html_part(part, depth + 1)
                if result:
                    return result
        
        return ""

    def find_plain_part(payload: dict, depth: int = 0) -> str:
        """Fallback: search for text/plain parts if no HTML found."""
        if depth > 10:
            return ""
        
        mime_type = payload.get("mimeType", "")
        
        if mime_type == "text/plain":
            body_data = payload.get("body", {}).get("data", "")
            if body_data:
                return decode_part(body_data)
        
        if mime_type.startswith("multipart/"):
            for part in payload.get("parts", []):
                result = find_plain_part(part, depth + 1)
                if result:
                    return result
        
        return ""

    # Try direct body data first (simple emails)
    if "body" in payload and payload["body"].get("data"):
        return decode_part(payload["body"]["data"])

    # Try HTML extraction (preserves formatting, images, links)
    html_body = find_html_part(payload)
    if html_body:
        return html_body

    # Fallback to plain text
    plain_body = find_plain_part(payload)
    if plain_body:
        return plain_body

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
