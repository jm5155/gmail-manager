import time
from backend.auth import get_credentials
from googleapiclient.discovery import build

print("Start test_gmail.py")

t0 = time.time()
creds = get_credentials()
print(f"Creds loaded in {time.time()-t0:.2f}s")

t0 = time.time()
svc = build("gmail", "v1", credentials=creds)
print(f"Service built in {time.time()-t0:.2f}s")

t0 = time.time()
r = svc.users().messages().list(userId="me", maxResults=5).execute()
print(f"List execute done in {time.time()-t0:.2f}s. Messages: {len(r.get('messages', []))}")
