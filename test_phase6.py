import sys, os, asyncio
sys.path.append(os.path.join(os.path.dirname(__file__), "backend"))
from backend.gmail import analyze_bulk_ordered
async def main():
    print("--- STARTING PHASE 6 TEST BATCH ---")
    async for event in analyze_bulk_ordered(limit=25, user_id=1): pass
    print("--- BATCH FINISHED ---")
if __name__ == "__main__":
    asyncio.run(main())
