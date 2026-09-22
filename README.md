# 🍳 INGRIGY — Recipe Recommendation Engine from Ingredients

[![FastAPI](https://img.shields.io/badge/FastAPI-0.110.0-009688?style=flat&logo=fastapi&logoColor=white)](https://fastapi.tiangolo.com)
[![React](https://img.shields.io/badge/React-18.3.1-61DAFB?style=flat&logo=react&logoColor=black)](https://react.dev/)
[![Vite](https://img.shields.io/badge/Vite-6.1.0-646CFF?style=flat&logo=vite&logoColor=white)](https://vitejs.dev/)
[![TailwindCSS](https://img.shields.io/badge/TailwindCSS-3.4.17-38B2AC?style=flat&logo=tailwind-css&logoColor=white)](https://tailwindcss.com/)
[![Scikit-Learn](https://img.shields.io/badge/scikit--learn-1.3.0-F7931E?style=flat&logo=scikit-learn&logoColor=white)](https://scikit-learn.org/)
[![Google Gemini](https://img.shields.io/badge/Google_Gemini-2.0_Flash-4285F4?style=flat&logo=google&logoColor=white)](https://ai.google.dev/)

An intelligent, multilingual recipe recommendation system and big data analytics platform that suggests recipes based on the ingredients available in your kitchen. Powered by **TF-IDF Cosine Similarity**, **Jaccard Set Overlap**, and **Google Gemini Multilingual GenAI**.

---

## 📌 Key Highlights

* 🧠 **Dual ML Recommendation Engines**: Compare **TF-IDF Vector Space Cosine Similarity** against **Jaccard Set Overlap** in real time.
* 🤖 **Multilingual GenAI Chef**: Grounded AI responses across **8 languages** (*English, हिन्दी, বাংলা, ଓଡ଼ିଆ, తెలుగు, தமிழ், मराठी, Español*).
* 📊 **Interactive Analytics & EDA Charts**: Dedicated **"Model Output & Charts"** dashboard featuring Exploratory Data Analysis (EDA) charts from the PySpark notebook and interactive live charts.
* 🛡️ **STRIDE Cybersecurity Architecture**: Built-in input sanitization, token validation, prompt-injection filters, and zero client-side key leakage.
* ⚡ **High Performance Inference**: Sub-10ms query latency utilizing pre-computed sparse matrix vectorization (`recipe_cache.pkl`).

---

## 📂 Project File Structure

```text
INGRIGY-Recipe-Recommendation-App-from-Ingredients/
├── backend/                                # FastAPI Python Backend
│   ├── app.py                              # REST API routes, Gemini integration & static serving
│   ├── recommender.py                      # TF-IDF, Cosine Similarity & Jaccard recommendation engine
│   ├── eda_stats.py                        # Dataset statistics computation
│   ├── stride_security.py                  # STRIDE threat sanitizer & audit logging
│   ├── build_index.py                      # Offline matrix vectorizer & cache builder
│   ├── test_api.py                         # Automated API testbench
│   ├── requirements.txt                    # Python dependencies
│   └── recipe_cache.pkl                    # Pre-indexed TF-IDF matrix & 20,938 dishes cache
│
├── frontend/                               # React + Vite Single-Page Application
│   ├── src/
│   │   ├── components/
│   │   │   ├── Navbar.jsx                  # Header with minimalist navigation & API key modal toggle
│   │   │   ├── RecommenderTab.jsx          # Interactive ingredient search, autocomplete & AI chat
│   │   │   ├── ModelOutputAndCharts.jsx    # EDA photo gallery & interactive digital charts
│   │   │   ├── RecipeDetailModal.jsx       # Modal with directions & missing ingredient checklist
│   │   │   └── ApiKeyModal.jsx             # Centered Gemini API key configuration popup
│   │   ├── services/
│   │   │   └── api.js                      # Axios/Fetch API client with VITE_API_URL support
│   │   ├── App.jsx                         # Main application layout, state & error boundary
│   │   ├── main.jsx                        # React root entrypoint
│   │   └── index.css                       # Design tokens, custom scrollbars & Tailwind styling
│   ├── public/
│   │   └── charts/                         # High-resolution matplotlib/seaborn EDA charts
│   ├── package.json                        # Node dependencies & build scripts
│   ├── vite.config.js                      # Vite config with backend API proxy
│   ├── tailwind.config.js                  # Custom color palette & typography
│   └── vercel.json                         # SPA routing rewrite rules for Vercel
│
├── Cleaned_Indian_Food_Dataset.csv         # Curated Indian recipes dataset (6,871 recipes)
├── ingrigy-recipe-recommendation-app.ipynb # PySpark exploratory data analysis & model notebook
├── .gitignore                              # Git exclusion rules (ignores >100MB CSV files)
└── README.md                               # Project documentation
```

---

## 📊 Datasets Used

| Dataset | Sample Size | Unique Ingredients | Coverage |
| :--- | :--- | :--- | :--- |
| **Cleaned Indian Food Dataset** | `6,871` recipes | `2,480+` tokens | 15 Indian regional cuisines (North Indian, South Indian, Bengali, Maharashtrian, etc.) |
| **RecipeNLG Dataset** | `14,067` recipes | `6,000+` tokens | Global cuisines, baking staples, and international dishes |
| **Combined Corpus** | **`20,938` dishes** | **`8,420+` clean tokens** | Complete multilingual kitchen grounding |

### Data Preprocessing Pipeline:
1. **Cleaning & Regex Tokenization**: Removal of quantities, metrics (grams, tsp, cups), punctuation, and formatting noise.
2. **Lemmatization & Normalization**: Standardizing ingredients (e.g., `tomatoes` $\rightarrow$ `tomato`, `onions` $\rightarrow$ `onion`).
3. **Compound Ingredient Merging**: Preserving multi-word culinary tokens (e.g., `garam masala`, `curry leaves`, `kasuri methi`, `olive oil`).

---

## 🧠 Machine Learning Methods & Formulations

### 1. TF-IDF (Term Frequency – Inverse Document Frequency)
TF-IDF balances the occurrence of an ingredient in a specific dish against its commonality across the entire corpus. Common staples (e.g., *salt*, *water*) receive lower penalty weights, while key signature ingredients (e.g., *paneer*, *kasuri methi*) receive higher weights:

$$\text{TF}(t, d) = \frac{f_{t,d}}{\sum_{t' \in d} f_{t',d}}$$

$$\text{IDF}(t, D) = \log\left(\frac{1 + |D|}{1 + |\{d \in D : t \in d\}|}\right) + 1$$

$$\text{TF-IDF}(t, d, D) = \text{TF}(t, d) \times \text{IDF}(t, D)$$

### 2. Cosine Similarity Matcher
Computes the angular cosine distance between the user's available ingredient vector $\vec{q}$ and recipe vector $\vec{r}$:

$$\text{Cosine Similarity}(\vec{q}, \vec{r}) = \frac{\vec{q} \cdot \vec{r}}{\|\vec{q}\|_2 \|\vec{r}\|_2} = \frac{\sum_{i=1}^{V} q_i r_i}{\sqrt{\sum_{i=1}^{V} q_i^2} \sqrt{\sum_{i=1}^{V} r_i^2}}$$

### 3. Jaccard Set Overlap Matcher
Computes exact binary intersection over union between kitchen ingredients $A$ and recipe requirements $B$:

$$J(A, B) = \frac{|A \cap B|}{|A \cup B|}$$

### 4. Multilingual LLM Grounding (Google Gemini)
Retrieved top candidate dishes are formatted into a grounded structured prompt and fed to **Gemini 2.0 Flash / 2.5 Flash** with temperature `0.4` to synthesize cooking instructions and answer user follow-ups in the selected target language.

---

## 🚀 How to Clone & Run Locally

### Prerequisites
* **Python 3.10+**
* **Node.js 18+** & **npm**
* **Git**

### Step 1: Clone the Repository
```bash
git clone https://github.com/Piyush-7718/INGRIGY-Recipe-Recommendation-App-from-Ingredients.git
cd INGRIGY-Recipe-Recommendation-App-from-Ingredients
```

### Step 2: Set Up and Run Backend
```bash
# 1. (Optional) Create and activate virtual environment
python -m venv venv
# On Windows:
.\venv\Scripts\activate
# On macOS/Linux:
source venv/bin/activate

# 2. Install backend dependencies
pip install -r backend/requirements.txt

# 3. Start the FastAPI backend server (Runs on http://127.0.0.1:8000)
python -m uvicorn app:app --app-dir backend --host 127.0.0.1 --port 8000 --reload
```

### Step 3: Set Up and Run Frontend
Open a new terminal window:
```bash
# 1. Navigate to frontend directory
cd frontend

# 2. Install dependencies
npm install

# 3. Start Vite dev server (Runs on http://127.0.0.1:5173)
npm run dev
```

Open **`http://localhost:5173`** in your browser to start using Ingrigy!

---

## 📡 REST API Reference

| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `POST` | `/api/recommend` | Recommends dishes ranked by TF-IDF Cosine or Jaccard similarity |
| `POST` | `/api/chat` | Multilingual AI Chef response grounded on model candidates |
| `GET` | `/api/ingredients` | Complete dataset vocabulary for Google-style autocomplete |
| `GET` | `/api/popular-ingredients`| Curated staples, proteins, and spices for quick-add chips |
| `GET` | `/api/health` | Service health status and indexed recipe count |
| `POST` | `/api/security/test` | STRIDE security testbench for prompt/XSS sanitization |

---

## 🌐 Deployment Guide

### Deploying Frontend to Vercel:
1. Push this repository to your GitHub account.
2. Log into [Vercel](https://vercel.com) and click **"Add New Project"**.
3. Select your repository and configure:
   * **Root Directory**: `frontend`
   * **Framework Preset**: `Vite`
   * **Build Command**: `npm run build`
   * **Output Directory**: `dist`
4. In **Environment Variables**, add:
   * `VITE_API_URL` = `https://<your-backend-domain>.onrender.com` (your deployed backend URL).
5. Click **Deploy**.

### Deploying Backend to Render / Railway:
1. Create a **Web Service** on [Render](https://render.com) or [Railway](https://railway.app).
2. Set **Root Directory** to `backend`.
3. Set **Build Command**: `pip install -r requirements.txt`.
4. Set **Start Command**: `uvicorn app:app --host 0.0.0.0 --port $PORT`.
5. (Optional) Add `GEMINI_API_KEY` in environment variables.

---

## 🛡️ STRIDE Threat Modeling & Security

| Threat Category | Mitigation Implemented |
| :--- | :--- |
| **Spoofing** | Origin checks and session signature validation. |
| **Tampering** | Strict input schema validation via Pydantic; regex HTML/script stripping. |
| **Repudiation** | Anonymized SHA-256 session query audit logging. |
| **Information Disclosure** | Custom Gemini API keys stored only in client browser `localStorage` (never saved to database or logs). |
| **Denial of Service** | Sparse matrix index caching avoids repeated dataset scans. |
| **Elevation of Privilege** | Read-only dataset access; prompt injection heuristic interception. |

---

## 👨‍💻 Authors & Academic Context

* **Project**: Case Study 11 – Recipe Recommendation App from Ingredients (Ingrigy)
* **Domain**: Big Data Analytics (BDA) & Multilingual Generative AI Architecture
* **License**: MIT License
