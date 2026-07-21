"""
security.py — Security Scanner Module (Restructured)
Contains exactly two functions:
  1. extract_urls — Extract URLs from plain text and HTML
  2. scan_url — Check URL safety via Google Safe Browsing API with caching
"""

import os
import re
import httpx
import asyncio
from urllib.parse import urlparse
from dotenv import load_dotenv

load_dotenv()

# Google Safe Browsing API key from .env
SAFE_BROWSING_KEY = os.getenv("GOOGLE_SAFE_BROWSING_KEY")


def extract_urls(text: str) -> list[str]:
    """
    Extract all URLs starting with http:// or https:// from plain text using regex.
    Also extract href attribute values from HTML anchor tags using BeautifulSoup
    if the text contains HTML.
    Also detect anchor mismatch: if visible link text and href point to different
    domains, include the href URL in the result with a note.
    Deduplicate the list before returning.

    Args:
        text: Raw email body (plain text or HTML)

    Returns:
        Deduplicated list of URL strings
    """
    urls = set()

    # Step 1: Regex for http/https URLs in plain text
    url_pattern = r'https?://[^\s<>"\')\];}]+'
    plain_urls = re.findall(url_pattern, text)
    for url in plain_urls:
        # Clean trailing punctuation
        url = url.rstrip(".,;:!?)")
        urls.add(url)

    # Step 2: Extract href values from HTML anchor tags using BeautifulSoup
    if "<a " in text.lower() or "<a>" in text.lower():
        try:
            from bs4 import BeautifulSoup

            soup = BeautifulSoup(text, "html.parser")
            for anchor in soup.find_all("a", href=True):
                href = anchor["href"]
                if href.startswith("http://") or href.startswith("https://"):
                    urls.add(href)

                    # Step 3: Anchor mismatch detection
                    anchor_text = anchor.get_text(strip=True)
                    if anchor_text.startswith("http://") or anchor_text.startswith("https://"):
                        # Visible text looks like a URL — compare domains
                        href_domain = _extract_domain(href)
                        text_domain = _extract_domain(anchor_text)
                        if href_domain and text_domain and href_domain != text_domain:
                            # Mismatch: anchor text shows one domain but links to another
                            print(f"[SECURITY] WARNING: Anchor mismatch: shows '{text_domain}' but links to '{href_domain}'")
                            urls.add(href)  # Ensure the actual href is in the result
        except ImportError:
            print("[SECURITY] BeautifulSoup not installed, skipping HTML anchor extraction")

    result = list(urls)
    print(f"[SECURITY] Extracted {len(result)} URLs from email body.")
    return result


def _extract_domain(url: str) -> str | None:
    """Extract the domain from a URL. Returns None if extraction fails."""
    try:
        parsed = urlparse(url)
        domain = parsed.hostname
        if domain and domain.startswith("www."):
            domain = domain[4:]
        return domain
    except Exception:
        return None


async def scan_url(url: str, email_id: str,
                   client: httpx.AsyncClient,
                   semaphore: asyncio.Semaphore) -> dict:
    """
    Check a URL against the Google Safe Browsing API v4 with caching.

    First calls get_cached_url(url) — if cached and within 24 hours, returns immediately.
    If not cached, calls the Safe Browsing API v4 threatMatches:find endpoint.
    Checks three threat types: MALWARE, SOCIAL_ENGINEERING, UNWANTED_SOFTWARE.
    Saves the result via save_url_result() for future cache hits.

    Args:
        url: The URL to check
        email_id: The Gmail message ID (for cache association)
        client: Shared httpx.AsyncClient for pooled connections
        semaphore: asyncio.Semaphore to cap concurrency

    Returns:
        Dict with keys: url, is_safe (int), threat_type (str or None)
    """
    from database import get_cached_url, save_url_result

    # Step 1: Check cache first
    cached = get_cached_url(url)
    if cached is not None:
        print(f"[SECURITY] Cache hit for URL: {url[:60]}")
        return {
            "url": url,
            "is_safe": cached["is_safe"],
            "threat_type": cached["threat_type"],
        }

    # Step 2: No cache — call Google Safe Browsing API v4
    if not SAFE_BROWSING_KEY or SAFE_BROWSING_KEY == "your_key_here":
        print(f"[SECURITY] WARNING: Safe Browsing API key not configured. Skipping URL check for: {url[:60]}")
        # Save as safe and return
        save_url_result(email_id, url, 1, None)
        return {"url": url, "is_safe": 1, "threat_type": None}

    endpoint = f"https://safebrowsing.googleapis.com/v4/threatMatches:find?key={SAFE_BROWSING_KEY}"
    body = {
        "client": {
            "clientId": "gmail-manager",
            "clientVersion": "1.0",
        },
        "threatInfo": {
            "threatTypes": ["MALWARE", "SOCIAL_ENGINEERING", "UNWANTED_SOFTWARE"],
            "platformTypes": ["ANY_PLATFORM"],
            "threatEntryTypes": ["URL"],
            "threatEntries": [{"url": url}],
        },
    }

    is_safe = 1
    threat_type = None

    try:
        async with semaphore:
            response = await client.post(endpoint, json=body)

        if response.status_code != 200:
            print(f"[SECURITY] Safe Browsing API error: {response.status_code}")
        else:
            data = response.json()
            if data.get("matches"):
                is_safe = 0
                threat_type = data["matches"][0].get("threatType", "UNKNOWN")
                print(f"[SECURITY] WARNING: UNSAFE URL detected: {url[:60]} - {threat_type}")

    except Exception as e:
        print(f"[SECURITY] Error checking URL safety: {type(e).__name__}: {e}")

    # Step 3: Save result to cache
    save_url_result(email_id, url, is_safe, threat_type)

    return {"url": url, "is_safe": is_safe, "threat_type": threat_type}
