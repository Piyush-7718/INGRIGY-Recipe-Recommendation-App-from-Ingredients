import os
import json
import collections
import pandas as pd

def compute_eda_statistics(recipes_df) -> dict:
    """
    Computes EDA summary data matching the PySpark notebook EDA section:
    1. Top 25 ingredients for Indian Food Dataset
    2. Top 25 ingredients for RecipeNLG Dataset
    3. Ingredient count distributions (min, max, mean, median)
    4. Top 15 Cuisines in Indian Dataset
    5. Dataset totals
    """
    if recipes_df is None or len(recipes_df) == 0:
        return {}

    indian_df = recipes_df[recipes_df["dataset"] == "indian"]
    rnlg_df = recipes_df[recipes_df["dataset"] == "rnlg"]

    # Top ingredients for Indian
    indian_counter = collections.Counter()
    indian_ing_counts = []
    for ing_list in indian_df["ing_list"]:
        indian_ing_counts.append(len(ing_list))
        for item in ing_list:
            indian_counter[item] += 1

    top_indian_ingredients = [{"name": k, "count": v} for k, v in indian_counter.most_common(25)]

    # Top ingredients for RecipeNLG
    rnlg_counter = collections.Counter()
    rnlg_ing_counts = []
    for ing_list in rnlg_df["ing_list"]:
        rnlg_ing_counts.append(len(ing_list))
        for item in ing_list:
            rnlg_counter[item] += 1

    top_rnlg_ingredients = [{"name": k, "count": v} for k, v in rnlg_counter.most_common(25)]

    # Cuisines distribution for Indian dataset
    cuisine_counter = collections.Counter(indian_df["cuisine"].dropna())
    top_cuisines = [{"cuisine": k, "count": v} for k, v in cuisine_counter.most_common(15)]

    # Distribution histogram bins (1 to 25 ingredients)
    bins = list(range(1, 26))
    def make_hist(counts):
        c = collections.Counter(counts)
        return [{"bin": b, "count": c.get(b, 0)} for b in bins]

    indian_hist = make_hist(indian_ing_counts)
    rnlg_hist = make_hist(rnlg_ing_counts)

    stats = {
        "totals": {
            "all_recipes": len(recipes_df),
            "indian_recipes": len(indian_df),
            "rnlg_recipes": len(rnlg_df),
            "unique_indian_ingredients": len(indian_counter),
            "unique_rnlg_ingredients": len(rnlg_counter)
        },
        "top_indian_ingredients": top_indian_ingredients,
        "top_rnlg_ingredients": top_rnlg_ingredients,
        "top_cuisines": top_cuisines,
        "indian_hist": indian_hist,
        "rnlg_hist": rnlg_hist,
        "indian_metrics": {
            "mean": round(float(pd.Series(indian_ing_counts).mean()), 2) if indian_ing_counts else 0,
            "median": round(float(pd.Series(indian_ing_counts).median()), 2) if indian_ing_counts else 0,
            "max": int(max(indian_ing_counts)) if indian_ing_counts else 0
        },
        "rnlg_metrics": {
            "mean": round(float(pd.Series(rnlg_ing_counts).mean()), 2) if rnlg_ing_counts else 0,
            "median": round(float(pd.Series(rnlg_ing_counts).median()), 2) if rnlg_ing_counts else 0,
            "max": int(max(rnlg_ing_counts)) if rnlg_ing_counts else 0
        }
    }
    return stats
