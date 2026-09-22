import os
import re
import json
import pickle
import numpy as np
import pandas as pd
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity

SYNONYMS = {
    "jeera": "cumin", "zeera": "cumin", "cumin seeds": "cumin",
    "besan": "gram flour", "chickpea flour": "gram flour",
    "haldi": "turmeric", "turmeric powder": "turmeric",
    "dhania": "coriander", "coriander leaves": "coriander", "cilantro": "coriander",
    "hing": "asafoetida", "atta": "wheat flour", "whole wheat flour": "wheat flour",
    "curd": "yogurt", "dahi": "yogurt", "curds": "yogurt",
    "capsicum": "bell pepper", "brinjal": "eggplant", "aubergine": "eggplant",
    "bhindi": "okra", "lady finger": "okra", "lady's finger": "okra",
    "methi": "fenugreek", "pudina": "mint", "adrak": "ginger",
    "lahsun": "garlic", "lasun": "garlic", "pyaz": "onion", "pyaaz": "onion",
    "aloo": "potato", "batata": "potato", "chawal": "rice",
    "mirch": "chilli", "chili": "chilli", "green chili": "green chilli", "red chili": "red chilli"
}

def clean_ingredient_term(term: str) -> str:
    """Clean individual ingredient term, apply synonym mappings, strip trailing 's' plural."""
    t = term.lower().strip()
    # Remove bracketed text like 'karela (bitter gourd)' -> 'karela'
    t = re.sub(r"\s*\(.*?\)", "", t)
    # Remove non-alpha except space and hyphen
    t = re.sub(r"[^a-z0-9\s-]", "", t).strip()
    # Apply synonym map
    if t in SYNONYMS:
        t = SYNONYMS[t]
    # Simple plural stripping if ends with 's' and not too short (e.g. eggs -> egg, tomatoes -> tomato)
    if t.endswith("es") and len(t) > 4:
        t = t[:-2]
    elif t.endswith("s") and len(t) > 3 and not t.endswith("ss"):
        t = t[:-1]
    return t.strip()

class RecipeRecommender:
    def __init__(self, data_dir: str):
        self.data_dir = data_dir
        self.recipes_df = None
        self.vectorizer = None
        self.tfidf_matrix = None
        self.cache_file = os.path.join(data_dir, "server", "recipe_cache.pkl")
        self.eda_cache_file = os.path.join(data_dir, "server", "eda_cache.json")
        self.is_ready = False

    def load_and_preprocess(self, sample_rnlg_count=20000):
        """Loads and cleans Indian Food and RecipeNLG datasets, builds TF-IDF vectorizer matrix."""
        # Check if preprocessed cache exists
        if os.path.exists(self.cache_file):
            try:
                print(f"Loading preprocessed model cache from {self.cache_file}...")
                with open(self.cache_file, "rb") as f:
                    cache_data = pickle.load(f)
                    self.recipes_df = cache_data["df"]
                    self.vectorizer = cache_data["vectorizer"]
                    self.tfidf_matrix = cache_data["tfidf_matrix"]
                    self.is_ready = True
                    print(f"Loaded {len(self.recipes_df)} recipes from cache.")
                    return
            except Exception as e:
                print(f"Cache load error: {e}. Re-indexing datasets...")

        records = []
        
        # 1. Process Indian Dataset
        indian_path = os.path.join(self.data_dir, "Cleaned_Indian_Food_Dataset.csv")
        if os.path.exists(indian_path):
            print(f"Reading Indian Food Dataset from {indian_path}...")
            try:
                try:
                    ind_df = pd.read_csv(indian_path)
                except UnicodeDecodeError:
                    ind_df = pd.read_csv(indian_path, encoding="latin-1")
                
                for idx, row in ind_df.iterrows():
                    ing_str = str(row.get("Cleaned-Ingredients", ""))
                    if not ing_str or ing_str == "nan":
                        continue
                    
                    raw_items = ing_str.split(",")
                    cleaned_items = []
                    for item in raw_items:
                        c = clean_ingredient_term(item)
                        if len(c) > 1:
                            cleaned_items.append(c)
                    
                    # distinct items
                    distinct_items = list(dict.fromkeys(cleaned_items))
                    if len(distinct_items) < 2:
                        continue
                    
                    title = str(row.get("TranslatedRecipeName", f"Indian Recipe {idx}"))
                    ingredients_full = str(row.get("TranslatedIngredients", ing_str))
                    directions = str(row.get("TranslatedInstructions", "No instructions available."))
                    link = str(row.get("URL", ""))
                    cuisine = str(row.get("Cuisine", "Indian"))
                    if cuisine == "nan" or not cuisine:
                        cuisine = "Indian"
                    
                    time_val = row.get("TotalTimeInMins", 30)
                    try:
                        time_mins = int(time_val) if pd.notna(time_val) else 30
                    except:
                        time_mins = 30

                    records.append({
                        "recipe_id": f"ind_{idx}",
                        "title": title,
                        "ing_list": distinct_items,
                        "ing_text": " ".join([ing.replace(" ", "_") for ing in distinct_items]),
                        "ingredients": ingredients_full,
                        "directions": directions,
                        "link": link,
                        "cuisine": cuisine,
                        "time_mins": time_mins,
                        "dataset": "indian"
                    })
                print(f"Processed {len(records)} Indian recipes.")
            except Exception as e:
                print(f"Error loading Indian dataset: {e}")

        # 2. Process RecipeNLG Dataset (sample for speed and memory efficiency)
        rnlg_path = os.path.join(self.data_dir, "RecipeNLG_dataset.csv")
        if os.path.exists(rnlg_path) and sample_rnlg_count > 0:
            print(f"Sampling {sample_rnlg_count} rows from RecipeNLG dataset...")
            try:
                # Read in chunks to avoid blowing up memory with 2.3GB CSV
                chunk_size = 50000
                rnlg_loaded = 0
                for chunk in pd.read_csv(rnlg_path, chunksize=chunk_size, nrows=sample_rnlg_count * 3):
                    for idx, row in chunk.iterrows():
                        ner_val = row.get("NER", "")
                        if not ner_val or str(ner_val) == "nan":
                            continue
                        
                        try:
                            ner_list = json.loads(str(ner_val))
                            if not isinstance(ner_list, list):
                                continue
                        except:
                            continue
                        
                        cleaned_items = []
                        for item in ner_list:
                            c = clean_ingredient_term(str(item))
                            if len(c) > 1:
                                cleaned_items.append(c)
                        
                        distinct_items = list(dict.fromkeys(cleaned_items))
                        if len(distinct_items) < 2:
                            continue
                        
                        title = str(row.get("title", f"Recipe {idx}"))
                        ingredients_full = str(row.get("ingredients", ", ".join(distinct_items)))
                        directions_val = row.get("directions", "")
                        try:
                            dir_parsed = json.loads(str(directions_val))
                            directions = "\n".join(dir_parsed) if isinstance(dir_parsed, list) else str(directions_val)
                        except:
                            directions = str(directions_val)
                        
                        link = str(row.get("link", ""))
                        if not link.startswith("http") and link:
                            link = f"https://{link}"

                        records.append({
                            "recipe_id": f"rnlg_{rnlg_loaded}",
                            "title": title,
                            "ing_list": distinct_items,
                            "ing_text": " ".join([ing.replace(" ", "_") for ing in distinct_items]),
                            "ingredients": ingredients_full,
                            "directions": directions,
                            "link": link,
                            "cuisine": "Continental / Global",
                            "time_mins": 35,
                            "dataset": "rnlg"
                        })
                        rnlg_loaded += 1
                        if rnlg_loaded >= sample_rnlg_count:
                            break
                    if rnlg_loaded >= sample_rnlg_count:
                        break
                print(f"Processed {rnlg_loaded} RecipeNLG recipes.")
            except Exception as e:
                print(f"Error loading RecipeNLG dataset: {e}")

        self.recipes_df = pd.DataFrame(records)
        print(f"Total recipes indexed: {len(self.recipes_df)}")

        # Build TF-IDF
        print("Building TF-IDF Matrix...")
        self.vectorizer = TfidfVectorizer(token_pattern=r"(?u)\b\w+\b", min_df=2)
        self.tfidf_matrix = self.vectorizer.fit_transform(self.recipes_df["ing_text"])

        # Cache to disk for instant subsequent startups
        try:
            os.makedirs(os.path.dirname(self.cache_file), exist_ok=True)
            with open(self.cache_file, "wb") as f:
                pickle.dump({
                    "df": self.recipes_df,
                    "vectorizer": self.vectorizer,
                    "tfidf_matrix": self.tfidf_matrix
                }, f)
            print("Successfully saved recipe cache to disk.")
        except Exception as e:
            print(f"Failed to save cache: {e}")

        self.is_ready = True

    def recommend(self, query_ingredients: list, dataset: str = None, algorithm: str = "tfidf", top_k: int = 10, cuisine_filter: str = None):
        """
        Calculates similarity between user ingredients and all candidate recipes in dataset.
        Returns top-k ranked recipes with matched and missing ingredients.
        """
        if not self.is_ready or self.recipes_df is None or len(self.recipes_df) == 0:
            return []

        # 1. Clean query ingredients
        cleaned_query = [clean_ingredient_term(ing) for ing in query_ingredients if len(ing.strip()) > 0]
        cleaned_query = list(dict.fromkeys([q for q in cleaned_query if len(q) > 0]))
        if not cleaned_query:
            return []

        query_set = set(cleaned_query)

        # Filter dataset pool
        df_pool = self.recipes_df
        indices = np.arange(len(df_pool))

        if dataset and dataset.lower() != "all":
            mask = df_pool["dataset"] == dataset.lower()
            df_pool = df_pool[mask]
            indices = indices[mask]

        if cuisine_filter and cuisine_filter.lower() != "all":
            mask2 = df_pool["cuisine"].str.lower() == cuisine_filter.lower()
            df_pool = df_pool[mask2]
            indices = indices[mask2]

        if len(df_pool) == 0:
            return []

        if algorithm.lower() == "jaccard":
            # Jaccard similarity: |Q ∩ R| / |Q ∪ R|
            scores = []
            for ing_list in df_pool["ing_list"]:
                r_set = set(ing_list)
                intersection = len(query_set & r_set)
                union = len(query_set | r_set)
                score = (intersection / union) if union > 0 else 0.0
                scores.append(score)
            scores = np.array(scores)
        else:
            # TF-IDF Cosine Similarity
            query_text = " ".join([q.replace(" ", "_") for q in cleaned_query])
            q_vec = self.vectorizer.transform([query_text])
            sub_matrix = self.tfidf_matrix[indices]
            sim_scores = cosine_similarity(q_vec, sub_matrix).flatten()
            scores = sim_scores

        # Rank and get top_k
        top_k = min(top_k, len(df_pool))
        # Get sorted descending order indices
        top_sub_indices = np.argsort(scores)[::-1][:top_k]

        results = []
        for idx in top_sub_indices:
            score = float(scores[idx])
            if score <= 0.001:
                # If score is negligible and we already have some results, break
                if len(results) >= 3:
                    break
            
            row = df_pool.iloc[idx]
            r_ing_list = row["ing_list"]
            
            # Matched ingredients
            matched = [str(ing) for ing in r_ing_list if ing in query_set]
            # Missing ingredients
            missing = [str(ing) for ing in r_ing_list if ing not in query_set]
            
            # Match percentage based on recipe completion
            match_pct = round((len(matched) / len(r_ing_list)) * 100, 1) if len(r_ing_list) > 0 else 0.0

            time_val = row.get("time_mins", 30)
            try:
                time_mins = int(time_val) if pd.notna(time_val) else 30
            except:
                time_mins = 30

            results.append({
                "recipe_id": str(row["recipe_id"]),
                "title": str(row["title"]),
                "score": round(float(score), 4),
                "match_pct": float(match_pct),
                "matched": matched,
                "missing": missing,
                "cuisine": str(row["cuisine"]) if pd.notna(row.get("cuisine")) else "Continental",
                "time_mins": time_mins,
                "dataset": str(row["dataset"]),
                "ingredients": str(row["ingredients"]),
                "directions": str(row["directions"]),
                "link": str(row["link"]) if pd.notna(row.get("link")) else ""
            })

        return results

    def build_chatbot_prompt(self, ingredients_list: list, dataset: str = None, top_k: int = 5, user_language: str = "English") -> tuple:
        """Constructs the exact candidate-grounded prompt matching the Ingrigy model workflow."""
        results = self.recommend(ingredients_list, dataset=dataset, top_k=top_k)
        
        recipe_block = ""
        for r in results:
            recipe_block += f"- {r['title']} (cuisine: {r['cuisine']})\n"
            recipe_block += f"  matched ingredients: {', '.join(r['matched'])}\n"
            recipe_block += f"  missing ingredients: {', '.join(r['missing'][:6])}\n\n"

        prompt = f"""You are a friendly multilingual cooking assistant for the Ingrigy app.
A user has these ingredients available: {', '.join(ingredients_list)}.

Here are candidate recipes retrieved by our recommendation model, ranked by ingredient match:

{recipe_block if recipe_block else 'No strong candidates found in the database for these specific ingredients.'}
Task:
1. Present all {len(results)} candidate recipes retrieved by the model for this user.
2. For each, briefly explain why it's a good match (mention what they have vs. what they'd need to buy).
3. Reply entirely in {user_language}.
4. Keep the tone warm and simple, like a helpful home-cooking friend.
"""
        return prompt, results
