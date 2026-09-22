import os
import sys
import json
import httpx
from typing import List, Optional
from fastapi import FastAPI, Request, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

# Add current dir to path
CURRENT_DIR = os.path.dirname(os.path.abspath(__file__))
PROJECT_DIR = os.path.dirname(CURRENT_DIR)
sys.path.append(CURRENT_DIR)

from recommender import RecipeRecommender
from eda_stats import compute_eda_statistics
from stride_security import STRIDE_THREATS, SecurityAudit

app = FastAPI(title="Ingrigy - Recipe Recommendation & AI API", version="1.0.0")

# Enable CORS for React Frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Global instances
recommender = RecipeRecommender(data_dir=PROJECT_DIR)
security_audit = SecurityAudit()
eda_cache = None

@app.on_event("startup")
async def startup_event():
    global eda_cache
    print("[STARTUP] Initializing Ingrigy ML Recommender Engine...")
    recommender.load_and_preprocess(sample_rnlg_count=15000)
    print("[EDA] Computing EDA Analytics...")
    if recommender.recipes_df is not None:
        eda_cache = compute_eda_statistics(recommender.recipes_df)
    print("[READY] Ingrigy Backend ready on port 8000!")

# Request Models
class RecommendRequest(BaseModel):
    ingredients: List[str]
    dataset: Optional[str] = "all"  # "all", "indian", "rnlg"
    algorithm: Optional[str] = "tfidf"  # "tfidf", "jaccard"
    top_k: Optional[int] = 10
    cuisine: Optional[str] = None

class ChatRequest(BaseModel):
    ingredients: List[str]
    dataset: Optional[str] = "all"
    language: Optional[str] = "English"
    top_k: Optional[int] = 5
    api_key: Optional[str] = None
    custom_question: Optional[str] = None

class SecurityTestRequest(BaseModel):
    input_text: str

@app.get("/api/health")
def health_check():
    return {
        "status": "healthy",
        "ready": recommender.is_ready,
        "indexed_recipes": len(recommender.recipes_df) if recommender.recipes_df is not None else 0
    }

@app.post("/api/recommend")
async def get_recommendations(req: RecommendRequest, request: Request):
    client_ip = request.client.host if request.client else "127.0.0.1"
    
    # 1. Security Sanitization
    is_safe, sanitized_ings, threats = security_audit.sanitize_input(req.ingredients)
    if not is_safe:
        security_audit.log_event("INPUT_WARNING", client_ip, f"Flagged threats: {', '.join(threats)}", status="FLAGGED")

    # 2. Run Recommender
    results = recommender.recommend(
        query_ingredients=sanitized_ings,
        dataset=req.dataset,
        algorithm=req.algorithm,
        top_k=req.top_k or 10,
        cuisine_filter=req.cuisine
    )

    security_audit.log_event(
        "RECOMMENDATION_QUERY",
        client_ip,
        f"Query: [{', '.join(sanitized_ings[:5])}], Dataset: {req.dataset}, Algo: {req.algorithm}, Results: {len(results)}"
    )

    return {
        "query": sanitized_ings,
        "dataset": req.dataset,
        "algorithm": req.algorithm,
        "count": len(results),
        "results": results,
        "warnings": threats if threats else []
    }

@app.post("/api/chat")
async def chat_suggest(req: ChatRequest, request: Request):
    client_ip = request.client.host if request.client else "127.0.0.1"
    
    is_safe, sanitized_ings, threats = security_audit.sanitize_input(req.ingredients)
    
    # 1. Build prompt and get top candidate recipes from our model
    top_k = req.top_k or 5
    candidates = recommender.recommend(sanitized_ings, dataset=req.dataset, top_k=top_k)
    
    recipe_block = ""
    for r in candidates:
        recipe_block += f"- {r['title']} (cuisine: {r.get('cuisine', 'Continental')})\n"
        recipe_block += f"  matched ingredients: {', '.join(r.get('matched', []))}\n"
        recipe_block += f"  missing ingredients: {', '.join(r.get('missing', [])[:6])}\n\n"

    user_lang = req.language or "English"

    if req.custom_question:
        prompt = f"""You are a friendly multilingual cooking assistant for the Ingrigy app.
A user has these available ingredients: {', '.join(sanitized_ings)}.

Here are the candidate recipes retrieved by our recommendation model:
{recipe_block}

The user is asking this follow-up question:
"{req.custom_question}"

Task:
1. Directly and helpfully answer the user's question with practical cooking advice based on these retrieved recipes and ingredients.
2. Reply entirely in {user_lang}.
3. Keep the tone warm and friendly.
"""
    else:
        prompt = f"""You are a friendly multilingual cooking assistant for the Ingrigy app.
A user has these available ingredients: {', '.join(sanitized_ings)}.

Here are candidate recipes retrieved by our recommendation model, ranked by ingredient match:
{recipe_block}

Task:
1. Present all {len(candidates)} candidate recipes retrieved by the model for this user.
2. For each recipe, clearly state:
   - **What they have:** matched items
   - **What they need:** missing items to buy
   - **Why it's a great match:** brief match explanation
3. Reply entirely in {user_lang}.
4. Keep the tone warm, helpful, and concise.
"""

    ai_reply = ""
    source = "offline_synthesizer"

    # 2. Call Gemini API if key is provided (or environment key)
    api_key = req.api_key or os.environ.get("GEMINI_API_KEY", "")
    
    # Check default key from notebook if none provided
    if not api_key:
        api_key = "AIzaSyB44OO2cWQzvBCMG6Yl_yTa9XUP85u1FXc"  # Free Tier Demo key from notebook

    if api_key and len(api_key) > 10:
        model_endpoints = [
            "gemini-2.0-flash",
            "gemini-1.5-flash-latest",
            "gemini-2.5-flash",
            "gemini-1.5-flash"
        ]
        for m_name in model_endpoints:
            try:
                url = f"https://generativelanguage.googleapis.com/v1beta/models/{m_name}:generateContent?key={api_key}"
                headers = {"Content-Type": "application/json"}
                payload = {
                    "contents": [{"parts": [{"text": prompt}]}],
                    "generationConfig": {
                        "temperature": 0.4,
                        "maxOutputTokens": 2500
                    }
                }
                async with httpx.AsyncClient(timeout=10.0) as client:
                    res = await client.post(url, json=payload, headers=headers)
                    if res.status_code == 200:
                        data = res.json()
                        candidates_resp = data.get("candidates", [])
                        if candidates_resp and "content" in candidates_resp[0]:
                            parts = candidates_resp[0]["content"].get("parts", [])
                            if parts and parts[0].get("text"):
                                ai_reply = parts[0].get("text", "")
                                source = f"gemini_api ({m_name})"
                                break
                    else:
                        print(f"Gemini {m_name} status {res.status_code}")
            except Exception as e:
                print(f"Gemini {m_name} exception: {e}")

    # Fallback to rich structured response if API call was unavailable or quota exceeded
    if not ai_reply:
        ai_reply = generate_multilingual_fallback(
            sanitized_ings,
            candidates,
            language=req.language or "English",
            custom_question=req.custom_question
        )

    security_audit.log_event(
        "CHATBOT_ASSIST",
        client_ip,
        f"Language: {req.language}, Top Candidate: {candidates[0]['title'] if candidates else 'None'}, Engine: {source}"
    )

    return {
        "prompt": prompt,
        "reply": ai_reply,
        "candidates": candidates,
        "language": req.language,
        "source": source
    }

def generate_multilingual_fallback(ingredients: list, candidates: list, language: str, custom_question: str = None) -> str:
    """Provides a high-quality, friendly conversational presentation of all candidate dishes or custom questions."""
    if not candidates:
        if language.lower() == "hindi":
            return "नमस्ते! आपके द्वारा दी गई सामग्रियों के लिए मुझे हमारे डेटाबेस में कोई सीधा मेल नहीं मिला। कृपया कुछ बुनियादी सामग्री जैसे प्याज, टमाटर, या लहसुन जोड़ें।"
        elif language.lower() == "bengali":
            return "নমস্কার! আপনার দেওয়া উপাদানগুলির জন্য আমাদের ডাটাবেসে কোনো উপযুক্ত রেসিপি পাওয়া যায়নি। অনুগ্রহ করে পেঁয়াজ বা রসুনের মতো সাধারণ কিছু উপাদান যোগ করুন।"
        elif language.lower() == "odia":
            return "ନମସ୍କାର! ଆପଣ ଦେଇଥିବା ସାମଗ୍ରୀ ପାଇଁ ଡାଟାବେସରେ କୌଣସି ରେସିପି ମିଳିଲା ନାହିଁ | ଦୟାକରି କିଛି ସାଧାରଣ ସାମଗ୍ରୀ ଯୋଗ କରନ୍ତୁ |"
        else:
            return "Hello! I couldn't find a direct recipe match for these exact ingredients in the database. Try adding some staple ingredients like onion, tomato, or garlic!"

    # If the user asked a specific follow-up question, answer that directly!
    if custom_question:
        cq_lower = custom_question.lower()
        if "substitute" in cq_lower or "spice" in cq_lower or "missing" in cq_lower:
            all_missing = set()
            for c in candidates[:5]:
                all_missing.update(c.get("missing", []))
            
            substitutions = {
                "garam masala": "Combine cumin powder (50%), coriander powder (30%), and a pinch of cinnamon + black pepper.",
                "fenugreek": "Use mustard seeds or a dash of celery seeds with dried curry leaves.",
                "curry leaves": "Use fresh coriander (cilantro) or kaffir lime zest.",
                "ginger": "Use ginger powder (1/4 tsp per inch of fresh) or garlic with lemon zest.",
                "turmeric": "Use mild saffron or a touch of yellow mustard powder with paprika.",
                "cardamom": "Blend cinnamon and a pinch of nutmeg or allspice.",
                "mustard oil": "Use peanut oil, sunflower oil, or vegetable oil with a dash of mustard powder."
            }
            
            ans = f"Great question! Here are smart spice substitutes for your recipes ({', '.join(ingredients)}):\n\n"
            found_any = False
            for m in list(all_missing)[:6]:
                for k, v in substitutions.items():
                    if k in m.lower():
                        ans += f"• **For {m}:** {v}\n"
                        found_any = True
                        break
            if not found_any:
                ans += "• **For missing whole spices:** Ground cumin + black pepper + lemon juice form a versatile flavor base.\n"
                ans += "• **For missing herbs:** Fresh coriander (cilantro) or mint can easily replace regional herbs.\n"
            ans += "\nFeel free to proceed with these substitutions without compromising on taste!"
            return ans

        elif "25 min" in cq_lower or "quick" in cq_lower or "fast" in cq_lower or "time" in cq_lower:
            quick_dishes = [c for c in candidates if c.get("time_mins", 30) <= 25]
            if not quick_dishes:
                quick_dishes = candidates[:2]
            ans = f"Here are the fastest dishes you can prepare right now:\n\n"
            for q in quick_dishes:
                ans += f"⚡ **{q['title']}** (~{q.get('time_mins', 20)} mins)\n"
                ans += f"• **Cuisine:** {q['cuisine']}\n"
                ans += f"• **Key items:** {', '.join(q['matched'])}\n\n"
            ans += "These are quick and require minimal preparation steps!"
            return ans

        elif "leftover" in cq_lower or "store" in cq_lower:
            ans = "Here are best practices for storing leftovers of these candidate dishes:\n\n"
            ans += "• **Airtight Storage:** Allow dishes to cool to room temperature before sealing in glass or food-safe containers.\n"
            ans += "• **Refrigeration:** Store in refrigerator (under 4°C) for up to 3 to 4 days.\n"
            ans += "• **Reheating:** Reheat curries and stir-fries thoroughly on medium heat, adding 1-2 tbsp water to restore moisture.\n"
            return ans

    # Otherwise generate full candidate presentation for all 5 recipes
    icons = ["🍳", "🍲", "🍛", "🥘", "🥗"]
    
    if language.lower() == "hindi":
        resp = f"नमस्ते! आपके पास मौजूद सामग्रियों ({', '.join(ingredients)}) के आधार पर हमारे सिफारिश मॉडल ने ये शीर्ष 5 व्यंजन चुने हैं:\n\n"
        for idx, pick in enumerate(candidates[:5], 1):
            icon = icons[(idx - 1) % len(icons)]
            resp += f"{icon} **{idx}. {pick['title']}** (व्यंजन: {pick['cuisine']})\n"
            resp += f"• **आपके पास पहले से है:** {', '.join(pick['matched'])}\n"
            if pick['missing']:
                resp += f"• **खरीदने या जोड़ने की ज़रूरत:** {', '.join(pick['missing'][:4])}\n"
            resp += f"• **यह क्यों बेहतरीन है:** इसमें आपकी उपलब्ध सामग्रियों का {pick['match_pct']}% उपयोग हो जाता है!\n\n"
        resp += "खाना पकाने का आनंद लें! किसी भी रेसिपी की पूरी विधि जानने के लिए कार्ड पर क्लिक करें।"
        return resp

    elif language.lower() == "bengali":
        resp = f"নমস্কার! আপনার উপলব্ধ উপাদানগুলির ({', '.join(ingredients)}) উপর ভিত্তি করে আমাদের মডেলের শীর্ষ ৫টি পছন্দ:\n\n"
        for idx, pick in enumerate(candidates[:5], 1):
            icon = icons[(idx - 1) % len(icons)]
            resp += f"{icon} **{idx}. {pick['title']}** ({pick['cuisine']})\n"
            resp += f"• **আপনার কাছে আছে:** {', '.join(pick['matched'])}\n"
            if pick['missing']:
                resp += f"• **বাজার থেকে যা দরকার:** {', '.join(pick['missing'][:4])}\n"
            resp += f"• **কেন এটি সেরা:** আপনার উপাদানের সাথে {pick['match_pct']}% মিল রয়েছে!\n\n"
        resp += "রান্না উপভোগ করুন! সম্পূর্ণ নির্দেশাবলীর জন্য রেসিপি কার্ডে ক্লিক করুন।"
        return resp

    elif language.lower() == "odia":
        resp = f"ନମସ୍କାର! ଆପଣଙ୍କ ପାଖରେ ଥିବା ସାମଗ୍ରୀକୁ ଆଧାର କରି ଆମ ମଡେଲ୍ ଏହି ଶ୍ରେଷ୍ଠ ୫ଟି ରେସିପି ବାଛିଛି:\n\n"
        for idx, pick in enumerate(candidates[:5], 1):
            icon = icons[(idx - 1) % len(icons)]
            resp += f"{icon} **{idx}. {pick['title']}** ({pick['cuisine']})\n"
            resp += f"• **ଆପଣଙ୍କ ପାଖରେ ଅଛି:** {', '.join(pick['matched'])}\n"
            if pick['missing']:
                resp += f"• **ଆବଶ୍ୟକ ସାମଗ୍ରୀ:** {', '.join(pick['missing'][:4])}\n"
            resp += f"• **ଏହା କାହିଁକି ଉତ୍ତମ:** ଏହା ଆପଣଙ୍କ ଉପଲବ୍ଧ ସାମଗ୍ରୀର {pick['match_pct']}% ବ୍ୟବହାର କରେ!\n\n"
        return resp

    else:
        # Default English
        resp = f"Hello there! Based on the ingredients you have on hand ({', '.join(ingredients)}), here are the top 5 candidate recipes retrieved by our model:\n\n"
        for idx, pick in enumerate(candidates[:5], 1):
            icon = icons[(idx - 1) % len(icons)]
            resp += f"{icon} **{idx}. {pick['title']}** (Cuisine: {pick['cuisine']})\n"
            resp += f"• **What you have:** {', '.join(pick['matched'])}\n"
            if pick['missing']:
                resp += f"• **What you need to get:** {', '.join(pick['missing'][:5])}\n"
            resp += f"• **Why it's a great match:** It utilizes {pick['match_pct']}% of the required ingredients directly from your kitchen!\n\n"
        
        resp += "Let me know if you'd like substitute ideas for any missing ingredients or cooking tips!"
        return resp

@app.get("/api/eda")
def get_eda_stats():
    global eda_cache
    if eda_cache:
        return eda_cache
    if recommender.recipes_df is not None:
        eda_cache = compute_eda_statistics(recommender.recipes_df)
        return eda_cache
    return {}

@app.get("/api/ingredients")
def get_all_ingredients():
    if recommender.recipes_df is not None:
        import collections
        counter = collections.Counter()
        for ing_list in recommender.recipes_df["ing_list"]:
            for item in ing_list:
                if len(item) > 1:
                    counter[item] += 1
        sorted_ings = [item for item, _ in counter.most_common(2500)]
        return {"ingredients": sorted_ings}
    return {"ingredients": []}

@app.get("/api/popular-ingredients")
def get_popular_ingredients():
    return {
        "staples": ["onion", "tomato", "garlic", "ginger", "cumin", "potato", "chilli", "coriander", "turmeric", "oil"],
        "proteins": ["paneer", "chicken", "egg", "gram flour", "lentil", "curd", "chickpea", "tofu"],
        "veggies": ["bell pepper", "spinach", "carrot", "peas", "cauliflower", "okra", "eggplant", "mushroom"],
        "spices": ["garam masala", "mustard seeds", "cinnamon", "clove", "cardamom", "asafoetida", "fenugreek"]
    }

@app.get("/api/cuisines")
def get_cuisines():
    if recommender.recipes_df is not None:
        cuisines = sorted([c for c in recommender.recipes_df["cuisine"].dropna().unique() if str(c) != "nan" and len(str(c)) > 1])
        return {"cuisines": cuisines}
    return {"cuisines": []}

@app.get("/api/metrics")
def get_model_metrics():
    # Performance benchmark values from the PySpark notebook evaluation (Section 6 & 24)
    return {
        "evaluation_samples": 100,
        "query_size": 4,
        "benchmarks": [
            {
                "dataset": "Indian Food Dataset",
                "tfidf_hit_at_5": "82.00%",
                "tfidf_hit_at_10": "94.00%",
                "jaccard_hit_at_5": "71.00%",
                "jaccard_hit_at_10": "86.00%",
                "mean_latency_ms": 6.8
            },
            {
                "dataset": "RecipeNLG Dataset",
                "tfidf_hit_at_5": "79.00%",
                "tfidf_hit_at_10": "91.00%",
                "jaccard_hit_at_5": "68.00%",
                "jaccard_hit_at_10": "83.00%",
                "mean_latency_ms": 11.2
            }
        ],
        "algorithm_comparison": {
            "tfidf_cosine": "Higher semantic weighting on distinctive spices/ingredients (e.g. paneer, fenugreek), penalizing ubiquitous items (water, salt).",
            "jaccard": "Pure set overlap ratio. Simple and unweighted, but can over-prioritize short ingredient lists."
        }
    }

@app.get("/api/security/stride")
def get_stride_info():
    return {
        "threats": STRIDE_THREATS,
        "recent_logs": security_audit.logs[:20],
        "active_protections": [
            {"feature": "Input Sanitizer & Regex Tokenizer", "status": "Active"},
            {"feature": "Prompt Injection Heuristic Scanner", "status": "Active"},
            {"feature": "Zero Client-Side API Key Exposure", "status": "Active"},
            {"feature": "Hashed Session Audit Logging", "status": "Active"},
            {"feature": "Payload Rate Limiter", "status": "Active"}
        ]
    }

@app.post("/api/security/test")
def test_security_input(req: SecurityTestRequest):
    raw_list = [x.strip() for x in req.input_text.split(",") if x.strip()]
    is_safe, sanitized, threats = security_audit.sanitize_input(raw_list)
    return {
        "original_input": req.input_text,
        "is_safe": is_safe,
        "sanitized_tokens": sanitized,
        "threats_detected": threats,
        "verdict": "ALLOWED" if is_safe else "FLAGGED / SANITIZED"
    }

# Mount React frontend static build if present
dist_dir = os.path.join(PROJECT_DIR, "client", "dist")
if os.path.exists(dist_dir):
    from fastapi.staticfiles import StaticFiles
    from starlette.responses import FileResponse

    # Serve static assets
    assets_dir = os.path.join(dist_dir, "assets")
    if os.path.exists(assets_dir):
        app.mount("/assets", StaticFiles(directory=assets_dir), name="assets")

    @app.get("/{full_path:path}")
    async def serve_spa(full_path: str):
        file_path = os.path.join(dist_dir, full_path)
        if os.path.exists(file_path) and os.path.isfile(file_path):
            return FileResponse(file_path)
        return FileResponse(os.path.join(dist_dir, "index.html"))

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="127.0.0.1", port=8000)
