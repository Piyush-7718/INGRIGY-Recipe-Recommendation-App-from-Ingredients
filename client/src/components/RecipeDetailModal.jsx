import React, { useState } from 'react';
import { X, Clock, ChefHat, ExternalLink, CheckCircle2, AlertCircle, Sparkles, Utensils } from 'lucide-react';

export default function RecipeDetailModal({ recipe, onClose, onAskAIChef }) {
  const [checkedItems, setCheckedItems] = useState({});

  if (!recipe) return null;

  const toggleCheck = (item) => {
    setCheckedItems(prev => ({
      ...prev,
      [item]: !prev[item]
    }));
  };

  // Format directions into paragraphs or steps
  const formatDirections = (dirs) => {
    if (!dirs) return ["No cooking directions available."];
    if (Array.isArray(dirs)) return dirs;
    
    // Split by numbered steps or double newlines
    const lines = dirs.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
    if (lines.length > 1) return lines;
    
    // Split by sentences if a long single block
    const sentences = dirs.split(/(?<=[.!?])\s+/).filter(s => s.trim().length > 10);
    return sentences.length > 0 ? sentences : [dirs];
  };

  const steps = formatDirections(recipe.directions);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-slate-950/80 backdrop-blur-md animate-fadeIn">
      <div 
        className="relative w-full max-w-3xl max-h-[90vh] glass-panel rounded-3xl border border-slate-700 shadow-2xl overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="p-6 border-b border-slate-800 flex items-start justify-between gap-4 bg-slate-900/60">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className="text-xs px-2.5 py-0.5 rounded-full bg-orange-500/20 text-orange-300 border border-orange-500/30 font-semibold">
                {recipe.cuisine || 'Continental'}
              </span>
              <span className="text-xs px-2.5 py-0.5 rounded-full bg-slate-800 text-slate-300 border border-slate-700">
                {recipe.match_pct}% Match
              </span>
              <span className="text-xs text-slate-400 flex items-center gap-1">
                <Clock className="w-3.5 h-3.5" /> {recipe.time_mins ? `${recipe.time_mins} mins` : '30 mins'}
              </span>
            </div>
            <h2 className="text-2xl font-bold text-white leading-snug">{recipe.title}</h2>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-full bg-slate-800/80 hover:bg-slate-700 text-slate-400 hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1 custom-scrollbar">
          {/* Action Bar */}
          <div className="flex flex-wrap items-center justify-between gap-3 p-3.5 rounded-2xl bg-slate-900/80 border border-slate-800 text-xs">
            <div className="flex items-center gap-2 text-slate-300">
              <Sparkles className="w-4 h-4 text-orange-400" />
              <span>Need cooking advice or ingredient swaps?</span>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => {
                  onClose();
                  if (onAskAIChef) onAskAIChef(recipe);
                }}
                className="px-3 py-1.5 rounded-xl bg-orange-600 hover:bg-orange-500 text-white font-semibold transition-colors flex items-center gap-1.5"
              >
                <ChefHat className="w-3.5 h-3.5" />
                <span>Ask Multilingual Chef</span>
              </button>

              {recipe.link && (
                <a
                  href={recipe.link}
                  target="_blank"
                  rel="noreferrer"
                  className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors flex items-center gap-1.5"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  <span>Original Link</span>
                </a>
              )}
            </div>
          </div>

          {/* Ingredients Section */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Available Ingredients */}
            <div className="p-4 rounded-2xl bg-emerald-950/20 border border-emerald-900/40 space-y-2">
              <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-400">
                <CheckCircle2 className="w-4 h-4" />
                <span>You Have ({recipe.matched.length})</span>
              </div>
              <ul className="space-y-1 text-xs text-emerald-200/90">
                {recipe.matched.map((ing, idx) => (
                  <li key={idx} className="flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                    <span className="capitalize">{ing}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Missing Ingredients Checklist */}
            <div className="p-4 rounded-2xl bg-slate-900/60 border border-slate-800 space-y-2">
              <div className="flex items-center justify-between text-xs font-bold text-slate-300">
                <div className="flex items-center gap-1.5">
                  <AlertCircle className="w-4 h-4 text-amber-400" />
                  <span>Shopping / Extra ({recipe.missing?.length || 0})</span>
                </div>
                <span className="text-[11px] font-normal text-slate-400">Check if available:</span>
              </div>
              {recipe.missing && recipe.missing.length > 0 ? (
                <ul className="space-y-1.5 text-xs">
                  {recipe.missing.map((ing, idx) => {
                    const isChecked = !!checkedItems[ing];
                    return (
                      <li
                        key={idx}
                        onClick={() => toggleCheck(ing)}
                        className="flex items-center gap-2 cursor-pointer text-slate-400 hover:text-slate-200 select-none"
                      >
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => {}}
                          className="rounded border-slate-700 bg-slate-800 text-orange-600 focus:ring-0 w-3.5 h-3.5 cursor-pointer"
                        />
                        <span className={`capitalize ${isChecked ? 'line-through text-slate-500' : ''}`}>
                          {ing}
                        </span>
                      </li>
                    );
                  })}
                </ul>
              ) : (
                <p className="text-xs text-emerald-400 italic">You have 100% of the ingredients required!</p>
              )}
            </div>
          </div>

          {/* Cooking Instructions */}
          <div className="space-y-3">
            <h3 className="text-sm font-bold uppercase tracking-wider text-slate-300 flex items-center gap-2">
              <Utensils className="w-4 h-4 text-orange-400" />
              <span>Step-by-Step Cooking Instructions</span>
            </h3>

            <div className="space-y-3">
              {steps.map((step, idx) => (
                <div key={idx} className="flex items-start gap-3.5 p-3 rounded-xl bg-slate-900/40 border border-slate-800/60">
                  <div className="w-6 h-6 rounded-lg bg-orange-500/10 text-orange-400 border border-orange-500/20 text-xs font-bold flex items-center justify-center shrink-0 mt-0.5">
                    {idx + 1}
                  </div>
                  <p className="text-xs md:text-sm text-slate-300 leading-relaxed">{step}</p>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="p-4 border-t border-slate-800 bg-slate-900/60 flex justify-end">
          <button
            onClick={onClose}
            className="px-5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
