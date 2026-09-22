import React from 'react';
import { ChefHat, Key } from 'lucide-react';

export default function Navbar({ apiKey, onOpenApiKeyModal, activeTab, setActiveTab }) {
  return (
    <header className="sticky top-0 z-40 w-full glass-panel border-b border-slate-800/80 shadow-lg">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo & Brand */}
          <div className="flex items-center space-x-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-orange-600 to-amber-500 flex items-center justify-center shadow-lg shadow-orange-500/20">
              <ChefHat className="w-5 h-5 text-white" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <span className="text-lg font-bold bg-gradient-to-r from-orange-400 via-amber-300 to-yellow-200 bg-clip-text text-transparent">
                  INGRIGY
                </span>
              </div>
              <p className="text-[10px] text-slate-400 font-medium tracking-tight">
                Recipe Recommendation App from Ingredients
              </p>
            </div>
          </div>

          {/* Right Side: Options placed just beside the API Key button */}
          <div className="flex items-center gap-6 sm:gap-8">
            <nav className="flex items-center space-x-6 sm:space-x-7">
              <button
                onClick={() => setActiveTab('recommender')}
                className={`text-sm tracking-wide transition-colors duration-200 py-1 border-b-2 ${
                  activeTab === 'recommender'
                    ? 'text-white font-semibold border-orange-500'
                    : 'text-slate-400 hover:text-slate-200 font-normal border-transparent'
                }`}
              >
                Recipe Recommender
              </button>
              <button
                onClick={() => setActiveTab('charts')}
                className={`text-sm tracking-wide transition-colors duration-200 py-1 border-b-2 ${
                  activeTab === 'charts'
                    ? 'text-white font-semibold border-orange-500'
                    : 'text-slate-400 hover:text-slate-200 font-normal border-transparent'
                }`}
              >
                Model Output & Charts
              </button>
            </nav>

            {/* API Key Button (Icon only) */}
            <button
              onClick={onOpenApiKeyModal}
              className={`w-9 h-9 rounded-xl flex items-center justify-center border transition-all shrink-0 ${
                apiKey
                  ? 'bg-amber-500/10 text-amber-400 border-amber-500/30 hover:bg-amber-500/20'
                  : 'bg-slate-900/80 text-slate-400 border-slate-800 hover:border-slate-700 hover:text-white'
              }`}
              title={apiKey ? 'Custom Gemini API Key Active (Click to edit)' : 'Configure Gemini API Key'}
              aria-label="Configure API Key"
            >
              <Key className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </header>
  );
}
