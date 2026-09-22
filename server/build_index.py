import os
import sys
import time

current_dir = os.path.dirname(os.path.abspath(__file__))
project_dir = os.path.dirname(current_dir)
sys.path.append(current_dir)

from recommender import RecipeRecommender

print(f"Starting index build in {project_dir}...")
t0 = time.time()
rec = RecipeRecommender(project_dir)
rec.load_and_preprocess(sample_rnlg_count=15000)
elapsed = time.time() - t0
print(f"Index built and cached successfully in {elapsed:.2f}s! Total recipes: {len(rec.recipes_df)}")

# Test recommendation
test_query = ["onion", "tomato", "garlic", "ginger", "cumin"]
results = rec.recommend(test_query, top_k=3, dataset="indian")
print(f"\nTest Recommendation for {test_query}:")
for r in results:
    print(f"-> {r['title']} ({r['cuisine']}) - Score: {r['score']} - Match: {r['match_pct']}%")
    print(f"   Matched: {r['matched']}")
    print(f"   Missing: {r['missing'][:4]}")

prompt, candidates = rec.build_chatbot_prompt(test_query, dataset="indian", top_k=2, user_language="Hindi")
print("\nGenerated Prompt sample:")
print(prompt[:300] + "...")
