from ml.pipeline.predict import predict
import json

result = predict('United States', 'Retail', 'quarterly', 3)
print(json.dumps(result, indent=2))

# Ces assertions doivent toutes passer
assert result.get('error') is None, f"Erreur : {result}"
assert result['total_predicted'] > 0, "total_predicted est 0 ou NaN"
assert len(result['predictions']) == 3, "Mauvais nombre de périodes"
for p in result['predictions']:
    assert p['estimated_layoffs'] > 0, f"NaN dans {p['period']}"
    assert p['lower_bound'] >= 0,      "lower_bound négatif"
    assert p['upper_bound'] > p['estimated_layoffs'], "upper_bound trop bas"

print("✅ Tous les tests passent — NaN corrigé")
