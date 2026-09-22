import React, { useState, useEffect, Component } from 'react';
import Navbar from './components/Navbar';
import RecommenderTab from './components/RecommenderTab';
import ModelOutputAndCharts from './components/ModelOutputAndCharts';
import RecipeDetailModal from './components/RecipeDetailModal';
import ApiKeyModal from './components/ApiKeyModal';
import { api } from './services/api';

class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('Ingrigy UI Catch:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-slate-950 text-white flex items-center justify-center p-6 text-center">
          <div className="max-w-md p-8 rounded-3xl bg-slate-900 border border-slate-800 space-y-4 shadow-2xl">
            <div className="w-12 h-12 bg-rose-500/20 text-rose-400 rounded-2xl flex items-center justify-center mx-auto text-xl font-bold">
              ⚠️
            </div>
            <h2 className="text-xl font-bold">Something went wrong</h2>
            <p className="text-xs text-slate-400 font-mono bg-slate-950 p-3 rounded-xl border border-slate-850 overflow-x-auto text-left">
              {this.state.error?.message || 'Unknown error occurred'}
            </p>
            <button
              onClick={() => window.location.reload()}
              className="px-5 py-2 rounded-xl bg-orange-600 hover:bg-orange-500 text-white text-xs font-semibold"
            >
              Reload Ingrigy App
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

export default function App() {
  return (
    <ErrorBoundary>
      <MainAppContent />
    </ErrorBoundary>
  );
}

function MainAppContent() {
  const [activeTab, setActiveTab] = useState('recommender');
  const [apiKey, setApiKey] = useState(() => {
    try {
      return localStorage.getItem('gemini_api_key') || '';
    } catch {
      return '';
    }
  });
  const [showApiKeyModal, setShowApiKeyModal] = useState(false);

  // Recommender State
  const [ingredients, setIngredients] = useState(['onion', 'tomato', 'garlic', 'ginger', 'cumin']);
  const [dataset, setDataset] = useState('all');
  const [algorithm, setAlgorithm] = useState('tfidf');
  const [results, setResults] = useState(null);
  const [loading, setLoading] = useState(false);

  // Metadata
  const [popularCategories, setPopularCategories] = useState(null);

  // Modal State
  const [selectedRecipeModal, setSelectedRecipeModal] = useState(null);

  const handleSaveApiKey = (key) => {
    setApiKey(key);
    try {
      if (key) {
        localStorage.setItem('gemini_api_key', key);
      } else {
        localStorage.removeItem('gemini_api_key');
      }
    } catch (e) {
      console.error('LocalStorage error:', e);
    }
  };

  useEffect(() => {
    // Get Popular Ingredients
    api.getPopularIngredients()
      .then(data => setPopularCategories(data))
      .catch(err => console.error('Popular ingredients error:', err));
  }, []);

  const handleSearch = async (overrideIngredients = null) => {
    const ings = overrideIngredients || ingredients;
    if (!ings || ings.length === 0) return;

    setLoading(true);
    try {
      const data = await api.getRecommendations({
        ingredients: ings,
        dataset: dataset,
        algorithm: algorithm,
        top_k: 12
      });
      setResults(data.results || []);
    } catch (err) {
      console.error('Search error:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-orange-500 selection:text-white">
      {/* Navigation Header */}
      <Navbar
        apiKey={apiKey}
        onOpenApiKeyModal={() => setShowApiKeyModal(true)}
        activeTab={activeTab}
        setActiveTab={setActiveTab}
      />

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {activeTab === 'recommender' ? (
          <RecommenderTab
            ingredients={ingredients}
            setIngredients={setIngredients}
            results={results}
            loading={loading}
            apiKey={apiKey}
            onSearch={handleSearch}
            onOpenRecipe={(recipe) => setSelectedRecipeModal(recipe)}
            popularCategories={popularCategories}
            dataset={dataset}
            setDataset={setDataset}
            algorithm={algorithm}
            setAlgorithm={setAlgorithm}
          />
        ) : (
          <ModelOutputAndCharts />
        )}
      </main>

      {/* Root-Level Centered API Key Modal */}
      <ApiKeyModal
        isOpen={showApiKeyModal}
        onClose={() => setShowApiKeyModal(false)}
        apiKey={apiKey}
        onSaveApiKey={handleSaveApiKey}
      />

      {/* Recipe Detail Modal */}
      {selectedRecipeModal && (
        <RecipeDetailModal
          recipe={selectedRecipeModal}
          onClose={() => setSelectedRecipeModal(null)}
        />
      )}

      {/* Footer */}
      <footer className="border-t border-slate-900 bg-slate-950/80 py-6 text-center text-xs text-slate-500">
        <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-2">
          <div>
            <strong>Ingrigy</strong> — Recipe Recommendation App from Ingredients
          </div>
          <div>
            PySpark Architecture • TF-IDF Vectorizer • Multilingual GenAI • STRIDE Security
          </div>
        </div>
      </footer>
    </div>
  );
}
