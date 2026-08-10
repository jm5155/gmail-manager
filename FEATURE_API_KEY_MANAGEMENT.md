# API Key Management Feature

## Status: Ready for Implementation

This feature will allow users to manage AI provider API keys directly from the Settings UI instead of editing backend/.env files.

## Backend Changes Needed

### New Endpoints (add to main.py):

```python
@app.get("/settings/api-keys")
async def get_api_keys(request: Request):
    """GET /settings/api-keys — Returns masked API keys"""
    if not is_logged_in():
        return JSONResponse(status_code=401, content={"error": "Not logged in."})
    
    def mask_key(key):
        if not key or len(key) < 8:
            return "••••••••"
        return key[:4] + "••••" + key[-4:]
    
    return {
        "groq": {
            "configured": bool(ai_router.GROQ_API_KEY),
            "masked_key": mask_key(ai_router.GROQ_API_KEY) if ai_router.GROQ_API_KEY else None,
        },
        "gemini": {
            "configured": bool(ai_router.GEMINI_API_KEY),
            "masked_key": mask_key(ai_router.GEMINI_API_KEY) if ai_router.GEMINI_API_KEY else None,
        },
        "cohere": {
            "configured": bool(ai_router.COHERE_API_KEY),
            "masked_key": mask_key(ai_router.COHERE_API_KEY) if ai_router.COHERE_API_KEY else None,
        },
        "nvidia": {
            "configured": bool(ai_router.NVIDIA_API_KEY),
            "masked_key": mask_key(ai_router.NVIDIA_API_KEY) if ai_router.NVIDIA_API_KEY else None,
        },
    }


@app.put("/settings/api-keys")
async def update_api_keys(request: Request):
    """PUT /settings/api-keys — Update API keys (stored in .env or environment)"""
    if not is_logged_in():
        return JSONResponse(status_code=401, content={"error": "Not logged in."})
    
    data = await request.json()
    
    # Update runtime keys
    if data.get("groq_key"):
        ai_router.GROQ_API_KEY = data["groq_key"]
    if data.get("gemini_key"):
        ai_router.GEMINI_API_KEY = data["gemini_key"]
    if data.get("cohere_key"):
        ai_router.COHERE_API_KEY = data["cohere_key"]
    if data.get("nvidia_key"):
        ai_router.NVIDIA_API_KEY = data["nvidia_key"]
    
    # Update .env file (for persistence across restarts)
    from dotenv import set_key
    env_path = Path(__file__).parent / ".env"
    
    if data.get("groq_key"):
        set_key(env_path, "GROQ_API_KEY", data["groq_key"])
    if data.get("gemini_key"):
        set_key(env_path, "GEMINI_API_KEY", data["gemini_key"])
    if data.get("cohere_key"):
        set_key(env_path, "COHERE_API_KEY", data["cohere_key"])
    if data.get("nvidia_key"):
        set_key(env_path, "NVIDIA_API_KEY", data["nvidia_key"])
    
    return {"success": True, "message": "API keys updated successfully"}
```

## Frontend Changes (Settings.jsx)

Add editable API key fields with:
- Masked display (••••)
- Edit button to reveal input
- Save button
- Test connection button
- Visual quota indicators (coming in phase 2)

## Implementation Priority

1. ✅ **Phase 1 (Tonight):** Basic API key editing (show masked, allow update)
2. 🔄 **Phase 2 (Tomorrow):** Quota monitoring (requires provider API calls)
3. 🔄 **Phase 3 (Future):** Low quota warnings and alerts

## Notes

- Railway deployment: API keys stored as environment variables (preferred for production)
- Local development: API keys in backend/.env file
- Security: Keys never exposed in full in API responses (always masked)
- Runtime updates: Keys updated in memory immediately, persisted to .env for restart
- For Railway: User must set keys as environment variables in dashboard (more secure)

## Decision Needed

**Should we:**
A. Store API keys in database per user (each user has their own keys)
B. Store API keys globally in .env (all users share same keys - current behavior)
C. Hybrid: Allow both (use user's keys if set, fall back to global)

Current implementation: **B (global keys in .env)** - simplest for single-user desktop app

For multi-tenant deployment, switch to **A (per-user keys in database)**.
