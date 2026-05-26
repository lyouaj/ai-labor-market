"""Quick smoke test for the Predictor class."""
from ml.pipeline.predict import Predictor

p = Predictor()
countries = p.get_available_countries()
sectors   = p.get_available_sectors()
print("SHAP loaded:", list(p._shap.keys()))
print("Countries (first 5):", countries[:5])
print("Sectors  (first 5):", sectors[:5])
print()

# ── Test 1: US / Finance / quarterly ──────────────────────────────────────────
print("--- Test 1: United States / Finance / quarterly ---")
r1 = p.predict("United States", "Finance", "quarterly", 3)
for pred in r1["predictions"]:
    print(f"  {pred['period']}: {pred['estimated_layoffs']:,}  "
          f"[{pred['lower_bound']:,} - {pred['upper_bound']:,}]  "
          f"trend={pred['trend']}")
print("Alert:", r1["alert"])
print("Model MAPE:", r1["model_mape"])
assert len(r1["predictions"]) == 3, "Should return 3 predictions"
assert "top_factors" in r1, "Should include top_factors"
print("[PASS] Test 1\n")

# ── Test 2: US / no sector / semester ─────────────────────────────────────────
print("--- Test 2: United States / None / semester ---")
r2 = p.predict("United States", None, "semester", 2)
for pred in r2["predictions"]:
    print(f"  {pred['period']}: {pred['estimated_layoffs']:,}")
assert len(r2["predictions"]) == 2, "Should return 2 predictions"
print("[PASS] Test 2\n")

# ── Test 3: ValueError for unknown country ─────────────────────────────────────
print("--- Test 3: ValueError for unknown country ---")
try:
    p.predict("Narnia", "Finance", "quarterly", 1)
    assert False, "Should have raised ValueError"
except ValueError as e:
    print(f"  Correctly raised ValueError: {e}")
print("[PASS] Test 3\n")

# ── Test 4: Metrics & SHAP ────────────────────────────────────────────────────
print("--- Test 4: Metrics & SHAP ---")
metrics = p.get_metrics()
assert "quarterly" in metrics, "quarterly metrics must exist"
assert "semester"  in metrics, "semester metrics must exist"
print(f"  Quarterly MAE  : {metrics['quarterly']['test_mae']:,}")
print(f"  Semester  MAE  : {metrics['semester']['test_mae']:,}")
shap_q = p.get_shap("quarterly")
top = shap_q.get("top_features", [{}])[0]
print(f"  SHAP top feature: {top.get('feature')} = {top.get('importance')}")
print("[PASS] Test 4\n")

# ── Test 5: cascade monotonic IC ─────────────────────────────────────────────
print("--- Test 5: Confidence intervals widen over time ---")
r5 = p.predict("United States", "Finance", "quarterly", 4)
widths = [p5["upper_bound"] - p5["lower_bound"] for p5 in r5["predictions"]]
print("  IC widths:", widths)
for i in range(1, len(widths)):
    assert widths[i] >= widths[i-1], f"IC should widen: {widths}"
print("[PASS] Test 5\n")

print("=" * 50)
print("ALL 5 TESTS PASSED")
