import React, { useState, useEffect, useRef } from 'react';
import {
  Search,
  Plus,
  X,
  Sparkles,
  Clock,
  Flame,
  BookOpen,
  CheckCircle2,
  AlertCircle,
  ArrowRight,
  ChefHat,
  Globe,
  Code,
  Copy,
  Check,
  Send,
  MessageSquare,
  User
} from 'lucide-react';
import { api } from '../services/api';

export default function RecommenderTab({
  ingredients,
  setIngredients,
  results,
  loading,
  apiKey,
  onSearch,
  onOpenRecipe,
  popularCategories,
  dataset,
  setDataset,
  algorithm,
  setAlgorithm
}) {
  const [inputValue, setInputValue] = useState('');
  const [vocabulary, setVocabulary] = useState([
    'salt', 'sugar', 'onion', 'egg', 'flour', 'butter', 'milk', 'water', 'vanilla', 'tomato',
    'garlic', 'oil', 'potato', 'ginger', 'chicken', 'pepper', 'lemon', 'rice', 'cheese', 'cumin',
    'coriander', 'turmeric', 'chili', 'paneer', 'bread', 'cream', 'mustard', 'cinnamon', 'cardamom',
    'carrot', 'clove', 'yogurt', 'curry leaves', 'ghee', 'fenugreek', 'garam masala', 'green chili',
    'red chili', 'coconut', 'mint', 'kasuri methi', 'bay leaf', 'capsicum', 'peas', 'spinach',
    'cauliflower', 'lentils', 'almond', 'cashew', 'nutmeg', 'olive oil', 'soy sauce', 'pasta'
  ]);
  const [suggestions, setSuggestions] = useState([]);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const inputRef = useRef(null);
  const dropdownRef = useRef(null);
  const chatScrollRef = useRef(null);

  // AI & Multilingual Integration State
  const [language, setLanguage] = useState('English');
  const [promptText, setPromptText] = useState('');
  const [aiLoading, setAiLoading] = useState(false);
  const [customQuestion, setCustomQuestion] = useState('');
  const [copiedPrompt, setCopiedPrompt] = useState(false);
  const [chatHistory, setChatHistory] = useState([]);

  const languages = [
    { id: 'English', label: 'English' },
    { id: 'Hindi', label: 'हिन्दी (Hindi)' },
    { id: 'Bengali', label: 'বাংলা (Bengali)' },
    { id: 'Odia', label: 'ଓଡ଼ିଆ (Odia)' },
    { id: 'Telugu', label: 'తెలుగు (Telugu)' },
    { id: 'Tamil', label: 'தமிழ் (Tamil)' },
    { id: 'Marathi', label: 'मराठी (Marathi)' },
    { id: 'Spanish', label: 'Español' }
  ];

  useEffect(() => {
    // Fetch all dataset vocabulary for autocomplete
    api.getIngredients()
      .then(data => {
        if (data && Array.isArray(data.ingredients) && data.ingredients.length > 0) {
          setVocabulary(data.ingredients);
        }
      })
      .catch(err => console.error('Failed to load ingredients vocabulary:', err));
  }, []);

  // Update autocomplete suggestions as user types
  useEffect(() => {
    const q = inputValue.trim().toLowerCase();
    if (q.length >= 1 && vocabulary.length > 0) {
      const available = vocabulary.filter(item => !ingredients.includes(item.toLowerCase()));
      const prefixMatches = available.filter(item => item.toLowerCase().startsWith(q));
      const containsMatches = available.filter(item => !item.toLowerCase().startsWith(q) && item.toLowerCase().includes(q));
      
      const combined = [...prefixMatches, ...containsMatches].slice(0, 8);
      setSuggestions(combined);
      setIsDropdownOpen(combined.length > 0);
      setSelectedIndex(-1);
    } else {
      setSuggestions([]);
      setIsDropdownOpen(false);
    }
  }, [inputValue, vocabulary, ingredients]);

  // Handle outside click to close dropdown
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (
        dropdownRef.current && !dropdownRef.current.contains(e.target) &&
        inputRef.current && !inputRef.current.contains(e.target)
      ) {
        setIsDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Auto-scroll chat to bottom
  useEffect(() => {
    if (chatScrollRef.current) {
      chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight;
    }
  }, [chatHistory, aiLoading]);

  const handleAddIngredient = (item) => {
    const trimmed = item.trim().toLowerCase();
    if (trimmed && !ingredients.includes(trimmed)) {
      setIngredients([...ingredients, trimmed]);
    }
    setInputValue('');
    setIsDropdownOpen(false);
    if (inputRef.current) inputRef.current.focus();
  };

  const handleKeyDown = (e) => {
    if (isDropdownOpen && suggestions.length > 0) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex(prev => (prev < suggestions.length - 1 ? prev + 1 : 0));
        return;
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex(prev => (prev > 0 ? prev - 1 : suggestions.length - 1));
        return;
      }
      if (e.key === 'Enter' && selectedIndex >= 0) {
        e.preventDefault();
        handleAddIngredient(suggestions[selectedIndex]);
        return;
      }
      if (e.key === 'Escape') {
        setIsDropdownOpen(false);
        return;
      }
    }

    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      if (inputValue.trim()) {
        handleAddIngredient(inputValue);
      }
    }
  };

  const handleRemoveIngredient = (index) => {
    setIngredients(ingredients.filter((_, i) => i !== index));
  };

  // Helper to build notebook prompt string
  const buildLocalPrompt = (ings, candidatesList, lang, customQ = '') => {
    let block = '';
    candidatesList.forEach(r => {
      block += `- ${r.title} (cuisine: ${r.cuisine || 'Continental'})\n`;
      block += `  matched ingredients: ${(r.matched || []).join(', ')}\n`;
      block += `  missing ingredients: ${(r.missing || []).slice(0, 6).join(', ')}\n\n`;
    });

    let p = `You are a friendly multilingual cooking assistant for the Ingrigy app.
A user has these ingredients available: ${ings.join(', ')}.

Here are candidate recipes retrieved by our recommendation model, ranked by ingredient match:

${block || 'No strong candidates found in the database.'}
Task:
1. Pick the best 2-3 recipes from the list above for this user.
2. For each, briefly explain why it's a good match (mention what they have vs. what they'd need to buy).
3. Reply entirely in ${lang}.
4. Keep the tone warm and simple, like a helpful home-cooking friend.`;

    if (customQ) {
      p += `\n\nUser Additional Question: ${customQ}`;
    }
    return p;
  };

  // Trigger search + generate prompt & AI response
  const handleExecuteSearch = async (overrideQuestion = '') => {
    if (ingredients.length === 0) return;

    const questionToSend = overrideQuestion || customQuestion;

    if (questionToSend) {
      setChatHistory(prev => [...prev, { sender: 'user', text: questionToSend }]);
      setCustomQuestion('');
    }

    onSearch();
    setAiLoading(true);

    try {
      const chatData = await api.askAIChef({
        ingredients,
        dataset,
        language,
        top_k: 5,
        apiKey: apiKey || null,
        customQuestion: questionToSend
      });

      if (chatData) {
        setPromptText(chatData.prompt || buildLocalPrompt(ingredients, chatData.candidates || [], language, questionToSend));
        
        const newAiMsg = {
          sender: 'ai',
          text: chatData.reply || '',
          candidates: chatData.candidates || [],
          language: language
        };

        if (questionToSend) {
          setChatHistory(prev => [...prev, newAiMsg]);
        } else {
          // Main search initial message
          setChatHistory([newAiMsg]);
        }
      }
    } catch (err) {
      console.error('Error fetching AI assistant response:', err);
      setChatHistory(prev => [
        ...prev,
        {
          sender: 'ai',
          text: `Sorry, there was an issue retrieving suggestions: ${err.message}`,
          candidates: [],
          language: language
        }
      ]);
    } finally {
      setAiLoading(false);
    }
  };

  // Copy prompt helper
  const handleCopyPrompt = () => {
    if (promptText) {
      navigator.clipboard.writeText(promptText);
      setCopiedPrompt(true);
      setTimeout(() => setCopiedPrompt(false), 2000);
    }
  };

  // Highlight matched query text
  const renderHighlightedText = (text, query) => {
    const q = query.trim().toLowerCase();
    if (!q) return <span>{text}</span>;
    const idx = text.toLowerCase().indexOf(q);
    if (idx === -1) return <span>{text}</span>;

    const before = text.substring(0, idx);
    const match = text.substring(idx, idx + q.length);
    const after = text.substring(idx + q.length);

    return (
      <span className="text-sm">
        {before}
        <span className="font-bold text-white underline decoration-orange-500/50 decoration-2">{match}</span>
        <span className="font-normal text-slate-400">{after}</span>
      </span>
    );
  };

  // Helper to format markdown bold (**text**) and bullet lists cleanly
  const formatChatMessage = (text) => {
    if (!text) return null;
    const lines = text.split('\n');
    return lines.map((line, idx) => {
      const parts = line.split(/(\*\*.*?\*\*)/g);
      const formattedLine = parts.map((part, pIdx) => {
        if (part.startsWith('**') && part.endsWith('**')) {
          return <strong key={pIdx} className="font-bold text-white">{part.slice(2, -2)}</strong>;
        }
        return part;
      });

      const trimmed = line.trim();
      if (trimmed.startsWith('•') || trimmed.startsWith('-')) {
        // Strip leading bullet character to prevent duplication
        const contentWithoutBullet = parts.map((part, pIdx) => {
          let cleanPart = part;
          if (pIdx === 0) cleanPart = cleanPart.replace(/^[\s•\-]+/, '');
          if (cleanPart.startsWith('**') && cleanPart.endsWith('**')) {
            return <strong key={pIdx} className="font-bold text-white">{cleanPart.slice(2, -2)}</strong>;
          }
          return cleanPart;
        });

        return (
          <div key={idx} className="flex items-start gap-2 pl-1 my-1">
            <span className="text-orange-400 font-bold leading-none mt-1">•</span>
            <span className="flex-1 leading-normal">{contentWithoutBullet}</span>
          </div>
        );
      }

      if (!trimmed) {
        return <div key={idx} className="h-2" />;
      }

      return <p key={idx} className="my-1 leading-relaxed">{formattedLine}</p>;
    });
  };

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Pure Glassmorphic Floating Top Bar (Sticky below title bar) */}
      <div className="sticky top-[72px] z-30 flex justify-center w-full pointer-events-none mb-4">
        <div className="pointer-events-auto inline-flex items-center gap-1.5 p-1.5 rounded-full bg-neutral-900/80 backdrop-blur-2xl border border-white/10 shadow-[0_8px_32px_0_rgba(0,0,0,0.5)] transition-all">
          {/* Dataset Switcher Pills */}
          <div className="flex items-center gap-1">
            {[
              { id: 'all', label: 'All Dishes', icon: Sparkles },
              { id: 'indian', label: 'Indian Recipes', icon: Flame },
              { id: 'rnlg', label: 'Global RecipeNLG', icon: BookOpen }
            ].map((d) => {
              const Icon = d.icon;
              const isActive = dataset === d.id;
              return (
                <button
                  key={d.id}
                  onClick={() => setDataset(d.id)}
                  className={`flex items-center gap-2 h-9 px-4 rounded-full text-xs font-semibold transition-all duration-200 select-none ${
                    isActive
                      ? 'bg-white text-neutral-950 shadow-md font-bold'
                      : 'text-neutral-300 hover:text-white hover:bg-white/5'
                  }`}
                >
                  <Icon className={`w-3.5 h-3.5 ${isActive ? 'text-neutral-950' : 'text-neutral-400'}`} />
                  <span>{d.label}</span>
                </button>
              );
            })}
          </div>

          {/* Symmetrical Divider */}
          <div className="hidden sm:block h-4 w-[1px] bg-white/10 mx-0.5" />

          {/* Algorithm Toggle */}
          <div className="flex items-center bg-white/5 p-0.5 rounded-full border border-white/5 h-9">
            {[
              { id: 'tfidf', label: 'TF-IDF' },
              { id: 'jaccard', label: 'Jaccard' }
            ].map((a) => (
              <button
                key={a.id}
                onClick={() => setAlgorithm(a.id)}
                className={`h-8 px-3 rounded-full text-[11px] font-medium transition-all select-none ${
                  algorithm === a.id
                    ? 'bg-white text-neutral-950 shadow-sm font-bold'
                    : 'text-neutral-400 hover:text-neutral-200'
                }`}
              >
                {a.label}
              </button>
            ))}
          </div>

          {/* Symmetrical Divider */}
          <div className="hidden sm:block h-4 w-[1px] bg-white/10 mx-0.5" />

          {/* Language Dropdown in Floating Top Bar */}
          <div className="flex items-center gap-1.5 h-9 px-3.5 rounded-full bg-white/5 hover:bg-white/10 border border-white/5 text-xs text-neutral-300 transition-colors">
            <Globe className="w-3.5 h-3.5 text-orange-400 shrink-0" />
            <select
              value={language}
              onChange={(e) => setLanguage(e.target.value)}
              className="bg-transparent text-neutral-200 text-xs focus:outline-none cursor-pointer pr-1"
            >
              {languages.map(l => (
                <option key={l.id} value={l.id} className="bg-neutral-900 text-neutral-200">
                  {l.label}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Simplified Search Card */}
      <div className="relative overflow-visible rounded-3xl bg-slate-900/70 border border-slate-800 p-6 shadow-2xl backdrop-blur-xl">
        {/* Single-line Header */}
        <h1 className="text-xl md:text-2xl font-bold text-white text-center mb-6">
          Find recipes by entering the ingredients you have
        </h1>

        {/* Search Input Box with Google-style Autocomplete */}
        <div className="relative">
          <div className={`relative flex flex-col sm:flex-row items-stretch gap-2 bg-slate-950/90 p-2 border shadow-inner transition-all ${
            isDropdownOpen && suggestions.length > 0
              ? 'rounded-t-2xl rounded-b-none border-slate-700 border-b-transparent'
              : 'rounded-2xl border-slate-800 focus-within:border-white/30'
          }`}>
            <div className="flex-1 flex items-center px-3 py-1.5">
              <Search className="w-5 h-5 text-slate-400 mr-2 shrink-0" />
              <input
                ref={inputRef}
                type="text"
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onFocus={() => {
                  if (inputValue.trim().length >= 1 && suggestions.length > 0) {
                    setIsDropdownOpen(true);
                  }
                }}
                onKeyDown={handleKeyDown}
                placeholder="Type ingredient (e.g. salt, paneer, tomato, onion)..."
                className="w-full bg-transparent text-white placeholder-slate-500 text-sm focus:outline-none"
              />
            </div>
            
            <div className="flex items-center gap-2">
              {inputValue && (
                <button
                  type="button"
                  onClick={() => handleAddIngredient(inputValue)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold rounded-xl flex items-center gap-1 transition-colors"
                >
                  <Plus className="w-3.5 h-3.5" /> Add
                </button>
              )}

              {/* Search Button (Replacement of Find Recipes) */}
              <button
                type="button"
                onClick={() => handleExecuteSearch()}
                disabled={ingredients.length === 0 || loading || aiLoading}
                className={`px-6 py-2.5 rounded-xl text-sm font-bold flex items-center justify-center gap-2 transition-all duration-200 shadow-lg ${
                  ingredients.length === 0 || loading || aiLoading
                    ? 'bg-slate-800 text-slate-500 cursor-not-allowed'
                    : 'bg-gradient-to-r from-orange-600 to-amber-600 hover:from-orange-500 hover:to-amber-500 text-white shadow-orange-600/30'
                }`}
              >
                {loading || aiLoading ? (
                  <span className="inline-block w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <>
                    <Sparkles className="w-4 h-4" />
                    <span>Search</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Google-style Autocomplete Dropdown */}
          {isDropdownOpen && suggestions.length > 0 && (
            <div
              ref={dropdownRef}
              className="absolute left-0 right-0 top-full z-50 bg-slate-950 border border-t-0 border-slate-700 rounded-b-2xl shadow-[0_16px_36px_rgba(0,0,0,0.8)] overflow-hidden"
            >
              <div className="h-[1px] bg-slate-800 mx-3" />
              <div className="py-1">
                {suggestions.map((item, idx) => {
                  const isHighlighted = idx === selectedIndex;
                  return (
                    <div
                      key={idx}
                      onMouseDown={(e) => {
                        e.preventDefault();
                        handleAddIngredient(item);
                      }}
                      onMouseEnter={() => setSelectedIndex(idx)}
                      className={`flex items-center justify-between px-4 py-2.5 cursor-pointer transition-colors ${
                        isHighlighted
                          ? 'bg-slate-800/90 text-white'
                          : 'text-slate-300 hover:bg-slate-900'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <Search className={`w-4 h-4 ${isHighlighted ? 'text-orange-400' : 'text-slate-500'}`} />
                        {renderHighlightedText(item, inputValue)}
                      </div>
                      <span className={`text-[11px] font-medium transition-opacity ${
                        isHighlighted ? 'opacity-100 text-orange-400' : 'opacity-0 text-slate-500'
                      }`}>
                        ↵ select
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Active Ingredient Chips */}
        <div className="mt-3 flex flex-wrap items-center gap-2 min-h-[32px]">
          <span className="text-xs font-medium text-slate-400">Selected Ingredients:</span>
          {ingredients.length === 0 ? (
            <span className="text-xs text-slate-500 italic">No ingredients added yet. Type above to see suggestions.</span>
          ) : (
            ingredients.map((ing, idx) => (
              <span
                key={idx}
                className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-orange-500/20 text-orange-200 border border-orange-500/40 animate-scaleIn"
              >
                <span>{ing}</span>
                <button
                  onClick={() => handleRemoveIngredient(idx)}
                  className="hover:text-white p-0.5 rounded-full hover:bg-orange-500/40 transition-colors"
                >
                  <X className="w-3 h-3" />
                </button>
              </span>
            ))
          )}
          {ingredients.length > 0 && (
            <button
              onClick={() => setIngredients([])}
              className="text-xs text-slate-400 hover:text-rose-400 underline ml-2 transition-colors"
            >
              Clear all
            </button>
          )}
        </div>

        {/* Quick Add Categorized Chips */}
        {popularCategories && (
          <div className="mt-4 pt-4 border-t border-slate-800/80 space-y-2">
            <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Quick Add Staples & Spices</div>
            <div className="flex flex-wrap gap-1.5">
              {[
                ...(popularCategories.staples || []).slice(0, 7),
                ...(popularCategories.proteins || []).slice(0, 4),
                ...(popularCategories.spices || []).slice(0, 4),
              ].map((item) => {
                const isSelected = ingredients.includes(item);
                return (
                  <button
                    key={item}
                    onClick={() => (isSelected ? setIngredients(ingredients.filter(i => i !== item)) : handleAddIngredient(item))}
                    className={`text-xs px-2.5 py-1 rounded-lg border transition-all ${
                      isSelected
                        ? 'bg-orange-600 text-white border-orange-500'
                        : 'bg-slate-900/80 text-slate-300 border-slate-800 hover:border-slate-700 hover:text-white'
                    }`}
                  >
                    {isSelected ? '✓ ' : '+ '}{item}
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* HORIZONTAL SIDE-BY-SIDE SECTION: PROMPT (LEFT) + CHATBOX (RIGHT) */}
      {(promptText || chatHistory.length > 0 || aiLoading) && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-stretch animate-fadeIn">
          {/* LEFT SIDE: PROMPT SENT TO LLM */}
          <div className="glass-card rounded-3xl border border-slate-800 overflow-hidden flex flex-col h-[620px] shadow-2xl">
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-3.5 bg-slate-950/80 border-b border-slate-800 shrink-0">
              <div className="flex items-center gap-2">
                <Code className="w-4 h-4 text-amber-400" />
                <span className="text-xs font-bold uppercase tracking-wider text-slate-200">
                  Prompt sent to LLM
                </span>
                <span className="text-[10px] px-2 py-0.5 rounded-md bg-amber-500/10 text-amber-300 border border-amber-500/20 font-mono">
                  Grounded on {ingredients.length} items • {language}
                </span>
              </div>
              <button
                onClick={handleCopyPrompt}
                className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-800 text-[11px] text-slate-300 transition-colors"
              >
                {copiedPrompt ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                <span>{copiedPrompt ? 'Copied' : 'Copy'}</span>
              </button>
            </div>

            {/* Prompt Code Content */}
            <div className="flex-1 p-4 bg-slate-950/90 text-xs font-mono text-slate-300 whitespace-pre-wrap leading-relaxed overflow-y-auto custom-scrollbar">
              {promptText || 'Generating structured prompt from retrieved candidate recipes...'}
            </div>

            {/* Prompt Status Bar */}
            <div className="px-4 py-2.5 bg-slate-950 border-t border-slate-800/80 text-[11px] text-slate-500 flex items-center justify-between shrink-0">
              <span>Template: PySpark Candidate Grounding</span>
              <span>Target: Multilingual LLM</span>
            </div>
          </div>

          {/* RIGHT SIDE: REAL INTERACTIVE CHATBOX UI */}
          <div className="glass-card rounded-3xl border border-slate-800 overflow-hidden flex flex-col h-[620px] shadow-2xl">
            {/* Chat Header */}
            <div className="flex items-center justify-between px-5 py-3.5 bg-slate-950/80 border-b border-slate-800 shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-orange-500/20 border border-orange-500/30 flex items-center justify-center text-orange-400">
                  <ChefHat className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-xs font-bold text-white flex items-center gap-2">
                    <span>AI Multilingual Chef Assistant</span>
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-orange-500/10 text-orange-300 border border-orange-500/20 font-semibold">
                      {language}
                    </span>
                  </h3>
                </div>
              </div>
              <button
                onClick={() => setChatHistory([])}
                className="text-[11px] text-slate-400 hover:text-slate-200 px-2 py-1 rounded-lg hover:bg-slate-900 transition-colors"
              >
                Clear
              </button>
            </div>

            {/* Chat Messages Thread */}
            <div ref={chatScrollRef} className="flex-1 p-4 overflow-y-auto space-y-4 custom-scrollbar bg-slate-950/50">
              {chatHistory.length === 0 && !aiLoading && (
                <div className="h-full flex flex-col items-center justify-center text-center p-6 text-slate-500">
                  <MessageSquare className="w-8 h-8 text-slate-600 mb-2" />
                  <p className="text-xs">Click Search above or ask a question to start chatting with the AI Chef.</p>
                </div>
              )}

              {chatHistory.map((msg, idx) => (
                <div key={idx} className={`flex gap-3 ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}>
                  {msg.sender === 'ai' && (
                    <div className="w-7 h-7 rounded-lg bg-orange-500/20 text-orange-400 border border-orange-500/30 flex items-center justify-center shrink-0 mt-0.5">
                      <ChefHat className="w-3.5 h-3.5" />
                    </div>
                  )}

                  <div className={`max-w-[88%] space-y-3 ${
                    msg.sender === 'user'
                      ? 'bg-orange-600 text-white rounded-2xl rounded-tr-sm px-4 py-2.5 text-xs shadow-md font-medium'
                      : 'bg-slate-900/90 text-slate-200 rounded-2xl rounded-tl-sm p-4 border border-slate-800 text-xs leading-relaxed shadow-lg'
                  }`}>
                    {/* Message Body */}
                    <div className="text-xs leading-relaxed">
                      {formatChatMessage(msg.text)}
                    </div>

                    {/* Model Retrieved Recipes (5) Preview inside AI Message (Image 5 style) */}
                    {msg.candidates && msg.candidates.length > 0 && (
                      <div className="mt-3 pt-3 border-t border-slate-800">
                        <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-2">
                          <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                          <span>MODEL RETRIEVED RECIPES ({msg.candidates.length}):</span>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          {msg.candidates.map((c, i) => (
                            <div
                              key={c.recipe_id || i}
                              onClick={() => onOpenRecipe(c)}
                              className="p-2.5 rounded-xl bg-slate-950 hover:bg-slate-850 border border-slate-800 hover:border-orange-500/40 cursor-pointer transition-all duration-200 group flex flex-col justify-between"
                            >
                              <div className="flex items-center justify-between text-[10px] mb-1">
                                <span className="text-slate-400 truncate max-w-[90px]">
                                  {c.cuisine || 'Continental'}
                                </span>
                                <span className="text-orange-400 font-bold">
                                  {c.match_pct}% Match
                                </span>
                              </div>
                              <h4 className="text-[11px] font-bold text-white group-hover:text-orange-300 line-clamp-2">
                                {c.title}
                              </h4>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>

                  {msg.sender === 'user' && (
                    <div className="w-7 h-7 rounded-lg bg-slate-800 text-slate-300 border border-slate-700 flex items-center justify-center shrink-0 mt-0.5">
                      <User className="w-3.5 h-3.5" />
                    </div>
                  )}
                </div>
              ))}

              {aiLoading && (
                <div className="flex gap-3 justify-start">
                  <div className="w-7 h-7 rounded-lg bg-orange-500/20 text-orange-400 border border-orange-500/30 flex items-center justify-center shrink-0 mt-0.5">
                    <ChefHat className="w-3.5 h-3.5" />
                  </div>
                  <div className="bg-slate-900/90 text-slate-200 rounded-2xl rounded-tl-sm p-4 border border-slate-800 text-xs max-w-[80%] space-y-2 animate-pulse">
                    <div className="h-3 bg-slate-800 rounded w-3/4" />
                    <div className="h-3 bg-slate-850 rounded w-full" />
                    <div className="h-3 bg-slate-850 rounded w-1/2" />
                  </div>
                </div>
              )}
            </div>

            {/* Quick Prompt Suggestions & Chat Input Bar */}
            <div className="p-3 bg-slate-950 border-t border-slate-800 space-y-2 shrink-0">
              {/* Quick Pills */}
              <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-0.5">
                {[
                  'Recommend the best 2 dishes from my ingredients',
                  'What substitutes can I use for missing spices?',
                  'Which recipe takes under 25 mins to cook?'
                ].map((q, idx) => (
                  <button
                    key={idx}
                    onClick={() => handleExecuteSearch(q)}
                    className="text-[11px] px-2.5 py-1 rounded-lg bg-slate-900 hover:bg-slate-850 border border-slate-800 text-slate-300 hover:text-white whitespace-nowrap transition-colors"
                  >
                    {q}
                  </button>
                ))}
              </div>

              {/* Input & Send Bar */}
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={customQuestion}
                  onChange={(e) => setCustomQuestion(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && customQuestion.trim()) {
                      handleExecuteSearch();
                    }
                  }}
                  placeholder="Ask AI Chef anything about these recipes or ingredients..."
                  className="flex-1 bg-slate-900 border border-slate-800 focus:border-orange-500/50 rounded-xl px-3.5 py-2 text-xs text-white placeholder-slate-500 focus:outline-none"
                />
                <button
                  type="button"
                  onClick={() => handleExecuteSearch()}
                  disabled={!customQuestion.trim() || aiLoading}
                  className="px-4 py-2 rounded-xl bg-orange-600 hover:bg-orange-500 disabled:bg-slate-850 disabled:text-slate-600 text-white text-xs font-semibold flex items-center gap-1.5 transition-colors"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>Ask</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Model Recommendations Section (Only displayed after Search is clicked) */}
      {(results !== null || loading) && (
        <div className="pt-2 animate-fadeIn">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold text-white flex items-center gap-2">
              <span>Model Recommendations</span>
              {results && (
                <span className="text-xs px-2.5 py-0.5 rounded-full bg-slate-800 text-slate-300 border border-slate-700 font-normal">
                  {results.length} dishes ranked
                </span>
              )}
            </h2>
            {results && results.length > 0 && (
              <div className="text-xs text-slate-400">
                Ranked by <span className="text-orange-400 font-semibold">{algorithm === 'tfidf' ? 'TF-IDF Cosine Similarity' : 'Jaccard Set Overlap'}</span>
              </div>
            )}
          </div>

          {loading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {[1, 2, 3, 4, 5, 6].map((n) => (
                <div key={n} className="glass-card rounded-2xl p-5 border border-slate-800 animate-pulse space-y-4">
                  <div className="h-5 bg-slate-800 rounded-md w-3/4" />
                  <div className="h-4 bg-slate-850 rounded-md w-1/2" />
                  <div className="space-y-2">
                    <div className="h-3 bg-slate-800 rounded w-full" />
                    <div className="h-3 bg-slate-800 rounded w-5/6" />
                  </div>
                </div>
              ))}
            </div>
          ) : results && results.length === 0 ? (
            <div className="glass-card rounded-3xl p-12 text-center border border-slate-800/80 max-w-xl mx-auto">
              <div className="w-16 h-16 bg-orange-500/10 rounded-2xl flex items-center justify-center mx-auto mb-4 border border-orange-500/20">
                <ChefHat className="w-8 h-8 text-orange-400" />
              </div>
              <h3 className="text-lg font-bold text-white">No Direct Matches Found</h3>
              <p className="text-slate-400 text-sm mt-1 mb-6">
                Try selecting staple kitchen ingredients like onion, tomato, garlic, or spices and search again.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {results.map((recipe, index) => (
              <div
                key={recipe.recipe_id || index}
                className="glass-card rounded-2xl p-5 border border-slate-800 flex flex-col justify-between hover:border-orange-500/40 transition-all duration-300 group"
              >
                <div>
                  {/* Top Badges */}
                  <div className="flex items-center justify-between gap-2 mb-3">
                    <span className="text-[11px] font-semibold px-2.5 py-0.5 rounded-full bg-slate-800/90 text-slate-300 border border-slate-700">
                      {recipe.cuisine || 'Continental'}
                    </span>
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-orange-500/20 text-orange-300 border border-orange-500/30">
                        {recipe.match_pct}% Match
                      </span>
                    </div>
                  </div>

                  {/* Title */}
                  <h3 className="text-lg font-bold text-white group-hover:text-orange-300 transition-colors line-clamp-2 mb-2">
                    {recipe.title}
                  </h3>

                  {/* Meta (Time & Dataset) */}
                  <div className="flex items-center gap-3 text-xs text-slate-400 mb-4">
                    <span className="flex items-center gap-1">
                      <Clock className="w-3.5 h-3.5 text-slate-500" />
                      {recipe.time_mins ? `${recipe.time_mins} mins` : '30 mins'}
                    </span>
                    <span>•</span>
                    <span className="uppercase tracking-wider text-[10px] px-1.5 py-0.5 rounded bg-slate-900 border border-slate-800 text-slate-400">
                      {recipe.dataset === 'indian' ? 'Indian Dataset' : 'RecipeNLG'}
                    </span>
                  </div>

                  {/* Matched Ingredients Breakdown */}
                  <div className="space-y-2 mb-4">
                    <div>
                      <div className="flex items-center gap-1 text-[11px] font-semibold text-emerald-400 mb-1">
                        <CheckCircle2 className="w-3 h-3" />
                        <span>Matched in your kitchen ({(recipe.matched || []).length}):</span>
                      </div>
                      <div className="flex flex-wrap gap-1">
                        {(recipe.matched || []).map((m, i) => (
                          <span
                            key={i}
                            className="text-[11px] px-2 py-0.5 rounded-md bg-emerald-500/10 text-emerald-300 border border-emerald-500/20"
                          >
                            {m}
                          </span>
                        ))}
                      </div>
                    </div>

                    {/* Missing Ingredients */}
                    {(recipe.missing || []).length > 0 && (
                      <div>
                        <div className="flex items-center gap-1 text-[11px] font-semibold text-amber-400 mb-1">
                          <AlertCircle className="w-3 h-3" />
                          <span>Missing ({(recipe.missing || []).length}):</span>
                        </div>
                        <div className="flex flex-wrap gap-1">
                          {(recipe.missing || []).slice(0, 6).map((m, i) => (
                            <span
                              key={i}
                              className="text-[11px] px-2 py-0.5 rounded-md bg-amber-500/10 text-amber-300 border border-amber-500/20"
                            >
                              {m}
                            </span>
                          ))}
                          {(recipe.missing || []).length > 6 && (
                            <span className="text-[10px] text-slate-500 px-1 py-0.5">
                              +{recipe.missing.length - 6} more
                            </span>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Card Actions */}
                <div className="pt-4 border-t border-slate-800/80 flex items-center justify-between gap-2">
                  <button
                    onClick={() => onOpenRecipe(recipe)}
                    className="flex-1 py-2 px-3 rounded-xl bg-slate-900 hover:bg-slate-800 text-xs font-semibold text-slate-200 hover:text-white border border-slate-800 hover:border-slate-700 transition-all flex items-center justify-center gap-1.5"
                  >
                    <span>View Directions</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    )}
  </div>
);
}

