const API_BASE = import.meta.env.VITE_API_URL ? `${import.meta.env.VITE_API_URL.replace(/\/$/, '')}/api` : '/api';

export const api = {
  async getHealth() {
    const res = await fetch(`${API_BASE}/health`);
    return res.json();
  },

  async getRecommendations({ ingredients, dataset = 'all', algorithm = 'tfidf', top_k = 10, cuisine = null }) {
    const res = await fetch(`${API_BASE}/recommend`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ingredients, dataset, algorithm, top_k, cuisine })
    });
    return res.json();
  },

  async askAIChef({ ingredients, dataset = 'all', language = 'English', top_k = 5, apiKey = '', customQuestion = '' }) {
    const res = await fetch(`${API_BASE}/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ingredients,
        dataset,
        language,
        top_k,
        api_key: apiKey || null,
        custom_question: customQuestion || null
      })
    });
    return res.json();
  },

  async getIngredients() {
    const res = await fetch(`${API_BASE}/ingredients`);
    return res.json();
  },

  async getPopularIngredients() {
    const res = await fetch(`${API_BASE}/popular-ingredients`);
    return res.json();
  },

  async getCuisines() {
    const res = await fetch(`${API_BASE}/cuisines`);
    return res.json();
  }
};
