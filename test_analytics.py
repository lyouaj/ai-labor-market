from backend.services import AnalyticsService
import time

print("Initializing AnalyticsService...")
start = time.time()
svc = AnalyticsService()
print(f"Initialized in {time.time() - start:.2f}s")

print("Running get_summary()...")
start = time.time()
try:
    res = svc.get_summary()
    print(f"Success! Finished in {time.time() - start:.2f}s")
    print(res)
except Exception as e:
    import traceback
    traceback.print_exc()
