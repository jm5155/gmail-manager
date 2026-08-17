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

# NVIDIA API (secondary fallback - fast model)
NVIDIA_API_KEY = os.getenv("NVIDIA_API_KEY")

# Gemini API (secondary)
GEMINI_API_KEYS = [
    key for key in [os.getenv(f"GEMINI_API_KEY_{index}") for index in range(1, 18)]
    if key and key != "your_key_here"
]
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY") or (GEMINI_API_KEYS[0] if GEMINI_API_KEYS else None)

# Cohere API (tertiary)
COHERE_API_KEY = os.getenv("COHERE_API_KEY")

# OpenRouter API (quinary — free auto-router)
OPENROUTER_API_KEY = os.getenv("OPENROUTER_API_KEY")

# Google Safe Browsing API
GOOGLE_SAFE_BROWSING_KEY = os.getenv("GOOGLE_SAFE_BROWSING_KEY")


# ---------- AI CALL CONCURRENCY THROTTLE ----------

# Cap concurrent in-flight AI provider calls to avoid bursting past per-minute
# rate limits (Phase 13, Option 1). Increased to 10 for faster analysis.
AI_CALL_SEMAPHORE = asyncio.Semaphore(10)


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
    
    Cascade order: Groq → NVIDIA → Gemini → Cohere → OpenRouter
    (NVIDIA preserved but not in active cascade)
    """

    def __init__(self):
        # httpx client with 30-second timeout for all requests
        self.client = httpx.Client(timeout=30.0)
        self.async_client = httpx.AsyncClient(timeout=30.0)
        self._gemini_key_index = 0
        # OpenRouter does not need key rotation (single key)
        print(
            f"[AI ROUTER] Providers loaded: "
            f"groq={bool(GROQ_API_KEY)}, "
            f"gemini={bool(GEMINI_API_KEY)}, "
            f"cohere={bool(COHERE_API_KEY)}, "
            f"nvidia={bool(NVIDIA_API_KEY)}, "
            f"openrouter={bool(OPENROUTER_API_KEY)}",
            flush=True,
        )

    # ---------- PROVIDER: NVIDIA (PLACEHOLDER — NOT IN ACTIVE CASCADE) ----------

    async def _call_nvidia(self, prompt: str) -> str:
        """
        Call NVIDIA API (OpenAI-compatible endpoint).
        Call NVIDIA API with nemotron-3-nano-30b-a3b (fast model).
        
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
            "model": "nvidia/nemotron-3-nano-30b-a3b",
            "messages": [{
                "role": "user",
                "content": (
                    f"{prompt}\n\n"
                    "Respond with ONLY one valid JSON object. Do not use markdown, "
                    "code fences, or explanatory text."
                ),
            }],
            "max_tokens": 1000,
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
            raw_content = data["choices"][0]["message"]["content"]
            print(f"[AI NVIDIA RAW] {raw_content!r}", flush=True)
            return raw_content.strip()

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
            "model": "llama-3.3-70b-versatile",
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
        if not GEMINI_API_KEYS:
            raise ProviderError("Gemini API key not configured")

        key = GEMINI_API_KEYS[self._gemini_key_index % len(GEMINI_API_KEYS)]
        self._gemini_key_index += 1
        url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-latest:generateContent?key={key}"
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

    # ---------- PROVIDER: OPENROUTER (QUINARY) ----------

    async def _call_openrouter(self, prompt: str) -> str:
        """
        Call OpenRouter API with free auto-router.
        Uses openrouter/auto:free (automatic free model selection).
        
        Args:
            prompt: The text prompt to send
            
        Returns:
            Response text from the model
            
        Raises:
            QuotaError: If status 429 (rate limited)
            ProviderError: If any other error occurs
        """
        if not OPENROUTER_API_KEY:
            raise ProviderError("OpenRouter API key not configured")

        url = "https://openrouter.ai/api/v1/chat/completions"
        headers = {
            "Authorization": f"Bearer {OPENROUTER_API_KEY}",
            "Content-Type": "application/json",
            "HTTP-Referer": "https://gmail-manager.app",
            "X-Title": "Gmail Manager",
        }
        body = {
            "model": "openrouter/auto:free",
            "messages": [{"role": "user", "content": prompt}],
            "max_tokens": 500,
            "temperature": 0.2,
        }

        try:
            response = await self.async_client.post(url, headers=headers, json=body)

            if response.status_code == 429:
                retry_after = response.headers.get("Retry-After")
                raise QuotaError(f"OpenRouter quota exceeded: {response.text[:300]} | retry-after={retry_after}")

            if response.status_code != 200:
                raise ProviderError(f"OpenRouter error {response.status_code}: {response.text[:200]}")

            data = response.json()
            return data["choices"][0]["message"]["content"].strip()

        except httpx.TimeoutException:
            raise ProviderError("OpenRouter request timed out (30s)")
        except KeyError as e:
            raise ProviderError(f"OpenRouter unexpected response format: missing {e}")


    async def analyze(self, prompt: str) -> dict:
        """Run a prompt through the configured provider cascade."""
        providers = [
            ("Groq", self._call_groq),
            ("NVIDIA", self._call_nvidia),
            ("Gemini", self._call_gemini),
            ("Cohere", self._call_cohere),
            ("OpenRouter", self._call_openrouter),
        ]

        errors = []
        for name, call_fn in providers:
            try:
                print(f"[AI] Trying {name}...", flush=True)
                async with AI_CALL_SEMAPHORE:
                    response = await call_fn(prompt)
                print(f"[AI] {name} responded successfully.", flush=True)
                return {"response": response, "provider_used": name}
            except QuotaError as exc:
                errors.append(f"{name}: quota: {exc}")
                print(f"[AI] {name} quota hit; switching provider.", flush=True)
            except (ProviderError, Exception) as exc:
                errors.append(f"{name}: {type(exc).__name__}: {exc}")
                print(f"[AI] {name} failed; switching provider: {exc}", flush=True)

        return {
            "error": "All AI providers exhausted: " + " | ".join(errors),
            "provider_used": None,
        }

    async def analyze_json(self, prompt: str) -> dict:
        """Run the cascade and continue past providers with invalid JSON."""
        providers = [
            ("Groq", self._call_groq),
            ("NVIDIA", self._call_nvidia),
            ("Gemini", self._call_gemini),
            ("Cohere", self._call_cohere),
            ("OpenRouter", self._call_openrouter),
        ]
        errors = []
        for name, call_fn in providers:
            try:
                print(f"[AI] Trying {name}...", flush=True)
                async with AI_CALL_SEMAPHORE:
                    response = await call_fn(prompt)
                cleaned = response.strip().replace("```json", "").replace("```", "").strip()
                try:
                    data = json.loads(cleaned)
                except json.JSONDecodeError:
                    start = cleaned.find("{")
                    end = cleaned.rfind("}")
                    if start < 0 or end <= start:
                        raise ValueError("AI response was not valid JSON")
                    data = json.loads(cleaned[start:end + 1])
                print(f"[AI] {name} responded successfully with valid JSON.", flush=True)
                return {"data": data, "provider_used": name}
            except QuotaError as exc:
                errors.append(f"{name}: quota: {exc}")
                print(f"[AI] {name} quota hit; switching provider.", flush=True)
            except Exception as exc:
                errors.append(f"{name}: {type(exc).__name__}: {exc}")
                print(f"[AI] {name} failed; switching provider: {exc}", flush=True)
        return {"error": "All AI providers exhausted: " + " | ".join(errors), "provider_used": None}


ai_router = AIRouter()

