"""
ai_router.py — AI Cascade Router Module (Phase 3)
Routes AI analysis requests through multiple providers with automatic failover.
Cascade order: Groq (primary) → Gemini (secondary) → Cohere (tertiary)
NVIDIA is preserved as placeholder for future use.

Each provider has a 30-second timeout. If a provider returns 429 (quota exceeded),
the router automatically switches to the next provider in the cascade.
"""

import os
import json
import asyncio
import time
import httpx
from datetime import datetime
from collections import deque
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# ---------- API KEYS ----------

# Groq API (primary)
GROQ_API_KEY = os.getenv("GROQ_API_KEY")

# NVIDIA API (placeholder — kept for future use)
NVIDIA_API_KEY = os.getenv("NVIDIA_API_KEY")

# Gemini API (secondary)
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")

# Cohere API (tertiary)
COHERE_API_KEY = os.getenv("COHERE_API_KEY")

# Google Safe Browsing API
GOOGLE_SAFE_BROWSING_KEY = os.getenv("GOOGLE_SAFE_BROWSING_KEY")


# ---------- AI CALL CONCURRENCY THROTTLE ----------

# Cap concurrent in-flight AI provider calls to avoid bursting past per-minute
# rate limits (Phase 13, Option 1). Starting limit: 5.
AI_CALL_SEMAPHORE = asyncio.Semaphore(5)


# ---------- COHERE PER-PROVIDER RATE LIMITER (Phase 16, Option B) ----------

class _FixedWindowRateLimiter:
    """
    Async-safe fixed-window rate limiter: at most `max_calls` grants per rolling
    `period` seconds. Excess callers wait (re-checking in <=0.5s slices) until a
    slot frees. A single acquire() waits at most `max_wait` seconds; if it still
    cannot get a slot it raises QuotaError so the normal cascade handler logs it
    and falls through. The internal lock is never held across a sleep (no
    deadlock, no over-grant).
    """

    def __init__(self, max_calls: int, period: float, max_wait: float):
        self.max_calls = max_calls
        self.period = period
        self.max_wait = max_wait
        self._grants = deque()          # monotonic timestamps of recent grants
        self._lock = asyncio.Lock()

    async def acquire(self, label: str = "Cohere") -> None:
        deadline = time.monotonic() + self.max_wait
        while True:
            async with self._lock:
                now = time.monotonic()
                while self._grants and self._grants[0] <= now - self.period:
                    self._grants.popleft()
                if len(self._grants) < self.max_calls:
                    self._grants.append(now)
                    return
                wait = self._grants[0] + self.period - now
            # sleep OUTSIDE the lock so other tasks can proceed / free slots
            if time.monotonic() + min(wait, 0.5) > deadline:
                raise QuotaError(
                    f"{label} rate limiter: window full "
                    f"({self.max_calls}/{self.period:.0f}s), waited up to "
                    f"{self.max_wait:.0f}s | retry-after=None"
                )
            await asyncio.sleep(min(wait, 0.5))


# Cohere trial keys are hard-capped at 20 requests/minute. Enforce it locally so
# excess Cohere calls queue (<=30s) instead of 429-ing. Only applies to Cohere.
COHERE_RATE_LIMITER = _FixedWindowRateLimiter(max_calls=20, period=60.0, max_wait=30.0)


# ---------- PROMPT TEMPLATES ----------

CLASSIFICATION_PROMPT = """You are an email classification and scam detection AI. You will be given an email's sender, subject, body, a flag indicating if a malicious URL was found in the email, and a list of available classification labels.

Your job is to:
1. Classify the email into exactly ONE label from the provided available_labels list.
2. Assign a scam probability score from 0 to 100 where 0 means definitely not a scam and 100 means definitely a scam.
3. List the specific phishing or scam indicators you detected. If none, return an empty list.
4. Provide a one-sentence reasoning for your classification.

Use these rules when deciding the scam_score:
- If url_threat_found is true, the scam_score must be at least 70.
- If the email contains urgency language such as "act now", "limited time", "your account will be suspended", "verify immediately", or similar phrases, add 20 to the base score.
- If the sender domain does not match the brand or company name mentioned in the subject or body, add 15 to the base score.
- If the email offers prizes, lottery winnings, inheritance, or unexpected money, add 25 to the base score.
- If the email asks for passwords, credit card numbers, OTP codes, or personal identification numbers, add 30 to the base score.
- Legitimate system-generated emails such as OTP codes, order confirmations, and bank transaction alerts from matching sender domains should receive a scam_score of 5 or below.

You must respond with ONLY a valid JSON object. Do not include markdown, backticks, or any text outside the JSON object. The JSON must have exactly these four fields: label, scam_score, scam_indicators, reasoning.

Input:
Sender: {sender}
Subject: {subject}
Body: {body}
URL Threat Found: {url_threat_found}
Available Labels: {available_labels}
"""

REWRITE_PROMPT = """
Rewrite the following email text based on this instruction: {instruction}
Return ONLY the rewritten email text, no explanations, no preamble.

Original text:
{text}
"""


# ---------- CUSTOM EXCEPTIONS ----------

class QuotaError(Exception):
    """Raised when an AI provider returns 429 (quota/rate limit exceeded)."""
    pass


class ProviderError(Exception):
    """Raised when an AI provider returns a non-recoverable error."""
    pass


# ---------- AI ROUTER CLASS ----------

class AIRouter:
    """
    Routes AI requests through a cascade of providers.
    If the primary provider is rate-limited (429), automatically falls back
    to the next provider in the chain.
    
    Cascade order: Groq → Gemini → Cohere
    (NVIDIA preserved but not in active cascade)
    """

    def __init__(self):
        # httpx client with 30-second timeout for all requests
        self.client = httpx.Client(timeout=30.0)
        self.async_client = httpx.AsyncClient(timeout=30.0)

    # ---------- PROVIDER: NVIDIA (PLACEHOLDER — NOT IN ACTIVE CASCADE) ----------

    async def _call_nvidia(self, prompt: str) -> str:
        """
        Call NVIDIA API (OpenAI-compatible endpoint).
        Uses minimaxai/minimax-m2.7 model via NVIDIA's integration API.
        
        Args:
            prompt: The text prompt to send
            
        Returns:
            Response text from the model
            
        Raises:
            QuotaError: If status 429 (rate limited)
            ProviderError: If any other error occurs
        """
        if not NVIDIA_API_KEY:
            raise ProviderError("NVIDIA API key not configured")

        url = "https://integrate.api.nvidia.com/v1/chat/completions"
        headers = {
            "Authorization": f"Bearer {NVIDIA_API_KEY}",
            "Content-Type": "application/json",
        }
        body = {
            "model": "minimaxai/minimax-m2.7",
            "messages": [{"role": "user", "content": prompt}],
            "max_tokens": 500,
            "temperature": 0.2,
            "stream": False,  # Non-streaming for structured responses
        }

        try:
            response = await self.async_client.post(url, headers=headers, json=body)

            if response.status_code == 429:
                raise QuotaError("NVIDIA quota exceeded")

            if response.status_code != 200:
                raise ProviderError(f"NVIDIA error {response.status_code}: {response.text[:200]}")

            data = response.json()
            return data["choices"][0]["message"]["content"].strip()

        except httpx.TimeoutException:
            raise ProviderError("NVIDIA request timed out (30s)")

    # ---------- PROVIDER: GROQ (PRIMARY) ----------

    async def _call_groq(self, prompt: str) -> str:
        """
        Call Groq API with llama-3.1-8b-instant model.
        Primary AI provider. Called first in the cascade.
        
        Args:
            prompt: The text prompt to send
            
        Returns:
            Response text from the model
            
        Raises:
            QuotaError: If status 429
            ProviderError: If any other error
        """
        if not GROQ_API_KEY:
            raise ProviderError("Groq API key not configured")

        url = "https://api.groq.com/openai/v1/chat/completions"
        headers = {
            "Authorization": f"Bearer {GROQ_API_KEY}",
            "Content-Type": "application/json",
        }
        body = {
            "model": "llama-3.1-8b-instant",
            "messages": [{"role": "user", "content": prompt}],
            "max_tokens": 500,
            "temperature": 0.2,
        }

        try:
            response = await self.async_client.post(url, headers=headers, json=body)

            if response.status_code == 429:
                retry_after = response.headers.get("Retry-After")
                raise QuotaError(f"Groq quota exceeded: {response.text[:300]} | retry-after={retry_after}")

            if response.status_code != 200:
                raise ProviderError(f"Groq error {response.status_code}: {response.text[:200]}")

            data = response.json()
            return data["choices"][0]["message"]["content"].strip()

        except httpx.TimeoutException:
            raise ProviderError("Groq request timed out (30s)")

    # ---------- PROVIDER: GEMINI (SECONDARY) ----------

    async def _call_gemini(self, prompt: str) -> str:
        """
        Call Google Gemini Flash API.
        
        Args:
            prompt: The text prompt to send
            
        Returns:
            Response text from the model
            
        Raises:
            QuotaError: If status 429
            ProviderError: If any other error
        """
        if not GEMINI_API_KEY:
            raise ProviderError("Gemini API key not configured")

        url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key={GEMINI_API_KEY}"
        body = {
            "contents": [{"parts": [{"text": prompt}]}],
            "generationConfig": {
                "temperature": 0.2,
                "maxOutputTokens": 500,
            }
        }

        try:
            response = await self.async_client.post(url, json=body)

            if response.status_code == 429:
                retry_after = response.headers.get("Retry-After")
                if retry_after is None:
                    # Gemini puts the delay in the body: error.details[].RetryInfo.retryDelay ("10s")
                    try:
                        for d in response.json().get("error", {}).get("details", []):
                            if str(d.get("@type", "")).endswith("RetryInfo") and d.get("retryDelay"):
                                retry_after = str(d["retryDelay"]).rstrip("s")  # "10s" -> "10"
                                break
                    except Exception:
                        pass
                raise QuotaError(f"Gemini quota exceeded: {response.text[:300]} | retry-after={retry_after}")

            if response.status_code != 200:
                raise ProviderError(f"Gemini error {response.status_code}: {response.text[:200]}")

            data = response.json()
            # Gemini response structure: candidates[0].content.parts[0].text
            return data["candidates"][0]["content"]["parts"][0]["text"].strip()

        except httpx.TimeoutException:
            raise ProviderError("Gemini request timed out (30s)")

    # ---------- PROVIDER: COHERE (TERTIARY) ----------

    async def _call_cohere(self, prompt: str) -> str:
        """
        Call Cohere API with command-a-03-2025 model (latest available).
        Uses v2 chat endpoint.
        
        Args:
            prompt: The text prompt to send
            
        Returns:
            Response text from the model
            
        Raises:
            QuotaError: If status 429
            ProviderError: If any other error
        """
        if not COHERE_API_KEY:
            raise ProviderError("Cohere API key not configured")

        url = "https://api.cohere.com/v2/chat"
        headers = {
            "Authorization": f"Bearer {COHERE_API_KEY}",
            "Content-Type": "application/json",
        }
        body = {
            "model": "command-a-03-2025",
            "messages": [{"role": "user", "content": prompt}],
            "max_tokens": 500,
            "temperature": 0.2,
        }

        try:
            response = await self.async_client.post(url, headers=headers, json=body)

            if response.status_code == 429:
                retry_after = response.headers.get("Retry-After")
                raise QuotaError(f"Cohere quota exceeded: {response.text[:300]} | retry-after={retry_after}")

            if response.status_code != 200:
                raise ProviderError(f"Cohere error {response.status_code}: {response.text[:200]}")

            data = response.json()
            # v2 API response: message.content[0].text
            return data["message"]["content"][0]["text"].strip()

        except httpx.TimeoutException:
            raise ProviderError("Cohere request timed out (30s)")

    # ---------- RETRY-DELAY PARSING (Phase 13, Option 3) ----------

    @staticmethod
    def _parse_retry_delay(err_text: str) -> float | None:
        """
        Extract a retry delay (in seconds) from a captured 429 error message.
        Looks for the Retry-After header value first (captured as
        'retry-after=<value>'), then a JSON retry-delay field such as Gemini's
        '"retryDelay": "12s"'. Returns None if neither is present.
        """
        import re
        # 1. Retry-After header, captured as "retry-after=<value>"
        # tolerate an optional trailing unit, e.g. "retry-after=10" or "retry-after=10s"
        m = re.search(r"retry-after=([0-9.]+)s?", err_text, re.IGNORECASE)
        if m:
            val = m.group(1).strip()
            if val.lower() not in ("none", ""):
                try:
                    return float(val)
                except ValueError:
                    pass
        # 2. JSON retry-delay field, e.g. "retryDelay": "12s" or "retry_delay": 12
        m = re.search(r'retry[_-]?delay["\']?\s*[:=]\s*["\']?([0-9.]+)\s*s?', err_text, re.IGNORECASE)
        if m:
            try:
                return float(m.group(1))
            except ValueError:
                pass
        return None

    # ---------- CASCADE ANALYZE ----------

    async def analyze(self, prompt: str) -> dict:
        """
        Run a prompt through the AI cascade: Groq → Gemini → Cohere.
        Automatically switches to the next provider if the current one hits quota limits.
        
        Args:
            prompt: The text prompt to analyze
            
        Returns:
            Dict with keys: response (str), provider_used (str)
            On total failure: { error: str }
        """
        # Provider cascade — ordered by priority
        providers = [
            ("Groq", self._call_groq),
            ("Gemini", self._call_gemini),
            ("Cohere", self._call_cohere),
        ]

        for name, call_fn in providers:
            try:
                timestamp = datetime.now().strftime("%H:%M:%S")
                print(f"[AI {timestamp}] Trying {name}...", flush=True)

                # Phase 16, Option B: hard-cap Cohere at 20/min. Acquire BEFORE the
                # global semaphore so waiting for the Cohere window does not hold a
                # global concurrency slot. May raise QuotaError if the wait cap is hit.
                if name == "Cohere":
                    await COHERE_RATE_LIMITER.acquire("Cohere")

                async with AI_CALL_SEMAPHORE:
                    result = await call_fn(prompt)
                print(f"[AI {timestamp}] [OK] {name} responded successfully.", flush=True)
                
                return {
                    "response": result,
                    "provider_used": name,
                }

            except QuotaError as e:
                timestamp = datetime.now().strftime("%H:%M:%S")
                print(f"[AI {timestamp}] [WARNING] {name} quota hit, switching to next provider... ({e})", flush=True)
                # Phase 13, Option 3: bounded backoff using captured retry delay
                # (Retry-After header or JSON retry-delay), capped at 5s. If no
                # delay is present, fall back immediately (today's behavior).
                retry_delay = self._parse_retry_delay(str(e))
                if retry_delay is not None:
                    await asyncio.sleep(min(retry_delay, 5.0))
                continue

            except ProviderError as e:
                timestamp = datetime.now().strftime("%H:%M:%S")
                print(f"[AI {timestamp}] [ERROR] {name} error: {e}", flush=True)
                continue

            except Exception as e:
                timestamp = datetime.now().strftime("%H:%M:%S")
                print(f"[AI {timestamp}] [ERROR] {name} unexpected error: {type(e).__name__}: {e}", flush=True)
                continue

        # All providers failed
        print("[AI] [ERROR] All AI providers exhausted. No response available.", flush=True)
        return {"error": "All AI providers exhausted", "provider_used": None}

    # ---------- JSON PARSING WITH RETRY ----------

    async def analyze_json(self, prompt: str) -> dict:
        """
        Run a prompt and parse the response as JSON.
        If JSON parsing fails, retry with a stricter prompt suffix.
        
        Args:
            prompt: The text prompt expecting a JSON response
            
        Returns:
            Dict with keys: data (parsed JSON), provider_used (str)
            On failure: { error: str }
        """
        # First attempt
        result = await self.analyze(prompt)
        
        if "error" in result:
            return result

        # Try to parse JSON from response
        parsed = self._extract_json(result["response"])
        if parsed is not None:
            return {
                "data": parsed,
                "provider_used": result["provider_used"],
            }

        # JSON parsing failed — retry with stricter prompt
        print(f"[AI] JSON parse failed, retrying with strict suffix...", flush=True)
        strict_prompt = prompt + "\n\nRespond only with valid JSON, nothing else."
        result = await self.analyze(strict_prompt)
        
        if "error" in result:
            return result

        parsed = self._extract_json(result["response"])
        if parsed is not None:
            return {
                "data": parsed,
                "provider_used": result["provider_used"],
            }

        # Both attempts failed — return raw text
        print(f"[AI] JSON parse failed after retry. Returning raw response.", flush=True)
        return {
            "data": None,
            "raw_response": result["response"],
            "provider_used": result["provider_used"],
            "error": "Failed to parse JSON from AI response",
        }

    def _extract_json(self, text: str) -> dict | None:
        """
        Extract and parse JSON from AI response text.
        Handles cases where models wrap JSON in markdown code fences.
        
        Args:
            text: Raw response text from AI
            
        Returns:
            Parsed dict or None if parsing fails
        """
        # Clean up common AI response wrapping
        cleaned = text.strip()
        
        # Remove markdown code fences if present
        if cleaned.startswith("```json"):
            cleaned = cleaned[7:]
        elif cleaned.startswith("```"):
            cleaned = cleaned[3:]
        if cleaned.endswith("```"):
            cleaned = cleaned[:-3]
        cleaned = cleaned.strip()

        try:
            return json.loads(cleaned)
        except json.JSONDecodeError:
            # Try to find JSON object in the text
            start = cleaned.find("{")
            end = cleaned.rfind("}") + 1
            if start >= 0 and end > start:
                try:
                    return json.loads(cleaned[start:end])
                except json.JSONDecodeError:
                    pass
        return None

    # ---------- STATUS CHECK ----------

    def get_status(self) -> dict:
        """
        Check which AI providers have valid API keys configured.
        
        Returns:
            Dict with provider names and their configuration status
        """
        return {
            "groq": {
                "configured": bool(GROQ_API_KEY and GROQ_API_KEY != "your_key_here"),
                "model": "llama-3.1-8b-instant",
                "role": "primary",
            },
            "gemini": {
                "configured": bool(GEMINI_API_KEY and GEMINI_API_KEY != "your_key_here"),
                "model": "gemini-2.0-flash",
                "role": "secondary",
            },
            "cohere": {
                "configured": bool(COHERE_API_KEY and COHERE_API_KEY != "your_key_here"),
                "model": "command-a-03-2025",
                "role": "tertiary",
            },
            "nvidia": {
                "configured": bool(NVIDIA_API_KEY and NVIDIA_API_KEY != "your_key_here"),
                "model": "minimaxai/minimax-m2.7",
                "role": "placeholder (inactive)",
            },
            "safebrowsing": {
                "configured": bool(GOOGLE_SAFE_BROWSING_KEY and GOOGLE_SAFE_BROWSING_KEY != "your_key_here"),
                "model": "Google Safe Browsing API",
                "role": "security",
            },
        }


# ---------- SINGLETON INSTANCE ----------

# Create a single router instance to reuse across the app
ai_router = AIRouter()
