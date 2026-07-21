import time
import requests

print("Start")
t0 = time.time()
try:
    r = requests.get('https://gmail.googleapis.com', timeout=3)
    print(f'Done in {time.time()-t0:.2f}s: {r.status_code}')
except Exception as e:
    print('Error:', e)
