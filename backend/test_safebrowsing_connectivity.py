"""
test_safebrowsing_connectivity.py — Standalone Google Safe Browsing API connectivity test
Run this directly in Railway's shell or as a one-off script to test if the API is reachable.

Usage (Railway shell):
  cd backend && python test_safebrowsing_connectivity.py

Expected: If working, should return 200 with threat match for the malware test URL.
If failing: Will show the exact exception (ConnectTimeout, ConnectError, etc.)
"""

import os
import httpx
import time
from dotenv import load_dotenv

load_dotenv()

SAFE_BROWSING_KEY = os.getenv("GOOGLE_SAFE_BROWSING_KEY")

def test_safe_browsing():
    """Test Google Safe Browsing API connectivity with a known malware test URL."""
    
    print("=" * 60)
    print("GOOGLE SAFE BROWSING API CONNECTIVITY TEST")
    print("=" * 60)
    
    # Step 1: Check if API key is configured
    if not SAFE_BROWSING_KEY or SAFE_BROWSING_KEY == "your_key_here":
        print("[ERROR] GOOGLE_SAFE_BROWSING_KEY is not configured in environment variables.")
        print("        Set it in Railway's Variables tab before testing.")
        return
    
    print(f"[OK] API key found (length: {len(SAFE_BROWSING_KEY)} chars)")
    print()
    
    # Step 2: Test with Google's official malware test URL
    test_url = "http://malware.testing.google.test/testing/malware/"
    endpoint = f"https://safebrowsing.googleapis.com/v4/threatMatches:find?key={SAFE_BROWSING_KEY}"
    
    body = {
        "client": {
            "clientId": "gmail-manager-test",
            "clientVersion": "1.0",
        },
        "threatInfo": {
            "threatTypes": ["MALWARE", "SOCIAL_ENGINEERING", "UNWANTED_SOFTWARE"],
            "platformTypes": ["ANY_PLATFORM"],
            "threatEntryTypes": ["URL"],
            "threatEntries": [{"url": test_url}],
        },
    }
    
    print(f"[TEST] Testing URL: {test_url}")
    print(f"[TEST] Endpoint: https://safebrowsing.googleapis.com/v4/threatMatches:find")
    print(f"[TEST] Timeout: 10 seconds")
    print()
    
    # Step 3: Make the API call with timing
    try:
        t_start = time.perf_counter()
        
        with httpx.Client(timeout=10.0) as client:
            response = client.post(endpoint, json=body)
        
        t_elapsed = time.perf_counter() - t_start
        
        print(f"[OK] Connection successful!")
        print(f"[OK] Response time: {t_elapsed:.2f} seconds")
        print(f"[OK] Status code: {response.status_code}")
        print()
        
        if response.status_code == 200:
            data = response.json()
            if data.get("matches"):
                print(f"[OK] Threat detected (expected for test URL): {data['matches'][0].get('threatType')}")
                print("[RESULT] Google Safe Browsing API is WORKING correctly.")
            else:
                print("[WARNING] No threat detected for malware test URL (unexpected).")
                print("          This might indicate the API key is invalid or test URL changed.")
        elif response.status_code == 400:
            print(f"[ERROR] Bad request (400): {response.text[:200]}")
            print("        Check if the API key is valid.")
        elif response.status_code == 403:
            print(f"[ERROR] Forbidden (403): {response.text[:200]}")
            print("        The API key may be invalid or lacks Safe Browsing API permissions.")
        else:
            print(f"[ERROR] Unexpected status code: {response.status_code}")
            print(f"        Response: {response.text[:200]}")
    
    except httpx.ConnectTimeout as e:
        print(f"[ERROR] ConnectTimeout: Connection to Safe Browsing API timed out after 10s")
        print(f"        Exception: {e}")
        print()
        print("[DIAGNOSIS] Railway egress cannot reach safebrowsing.googleapis.com")
        print("            Possible causes:")
        print("            - Railway firewall/networking blocking Google APIs")
        print("            - Google Safe Browsing API endpoint down/unreachable")
        print("            - DNS resolution failing for googleapis.com")
    
    except httpx.ConnectError as e:
        print(f"[ERROR] ConnectError: Failed to establish connection")
        print(f"        Exception: {e}")
        print()
        print("[DIAGNOSIS] Network connectivity issue")
        print("            Possible causes:")
        print("            - Railway cannot route to external Google APIs")
        print("            - DNS failure")
        print("            - Firewall blocking outbound HTTPS to googleapis.com")
    
    except httpx.ReadTimeout as e:
        print(f"[ERROR] ReadTimeout: Request sent but response timed out")
        print(f"        Exception: {e}")
        print()
        print("[DIAGNOSIS] Safe Browsing API is reachable but slow/overloaded")
    
    except Exception as e:
        print(f"[ERROR] Unexpected error: {type(e).__name__}: {e}")
        print()
        print("[DIAGNOSIS] Unknown issue - see exception details above")
    
    print()
    print("=" * 60)
    print("TEST COMPLETE")
    print("=" * 60)


if __name__ == "__main__":
    test_safe_browsing()
