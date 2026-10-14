import React, { useState, useEffect, useRef } from 'react';
import { MenuItem } from '../../types';
import { MENU_ITEMS } from '../../data/menu';
import { db } from '../../supabase';
import { Search, Star, Flame, Mic, MicOff, Sparkles, X, Clock, AlertTriangle } from 'lucide-react';
import { ImageWithFallback } from '../../components/common/ImageWithFallback';

interface SearchScreenProps {
  initialCategory?: MenuItem['category'];
  onSelectDish: (item: MenuItem) => void;
}

type DietFilter = 'All' | 'Veg' | 'Non-Veg' | 'Beverages';

export const SearchScreen: React.FC<SearchScreenProps> = ({ initialCategory, onSelectDish }) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<'All' | MenuItem['category']>(initialCategory || 'All');
  const [dietFilter, setDietFilter] = useState<DietFilter>('All');
  const [menuItems, setMenuItems] = useState<MenuItem[]>(MENU_ITEMS);
  const [filteredItems, setFilteredItems] = useState<MenuItem[]>([]);
  const [isListening, setIsListening] = useState(false);
  const [searchHistory, setSearchHistory] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem('dinesmart_search_history');
      return saved ? JSON.parse(saved) : ['Biryani', 'Dosa', 'Paneer', 'Chai'];
    } catch {
      return ['Biryani', 'Dosa', 'Paneer', 'Chai'];
    }
  });

  const searchInputRef = useRef<HTMLInputElement>(null);

  // Fetch from database on mount
  useEffect(() => {
    db.getMenuItems().then(setMenuItems);
  }, []);

  // Update selected category if initialCategory changes
  useEffect(() => {
    if (initialCategory) {
      setSelectedCategory(initialCategory);
    }
  }, [initialCategory]);

  const categories: ('All' | MenuItem['category'])[] = [
    'All', 'Breakfast', 'Soups', 'Starters', 'Main Course', 'Combos', 'Breads', 'Desserts', 'Beverages'
  ];
  const dietFilters: { name: DietFilter; label: string }[] = [
    { name: 'All', label: 'All Dishes' },
    { name: 'Veg', label: 'Veg Only' },
    { name: 'Non-Veg', label: 'Non-Veg' },
    { name: 'Beverages', label: 'Drinks' },
  ];

  // AI Suggestion Box Presets (Note 11 & Note 14)
  const aiSuggestions = [
    { label: "Chef's Special Picks", query: "special", icon: "✨" },
    { label: "Top Rated ★4.8+", query: "top_rated", icon: "⭐" },
    { label: "Under ₹100 Budget", query: "under_100", icon: "💰" },
    { label: "Quick 10-Min Bites", query: "quick", icon: "⚡" },
  ];

  // Note 8: Dismiss keyboard automatically ("search chesaka key board dengeyali automatic ga")
  const dismissKeyboard = () => {
    if (searchInputRef.current) {
      searchInputRef.current.blur();
    }
    if (document.activeElement instanceof HTMLElement) {
      document.activeElement.blur();
    }
  };

  const handleSelectQuery = (text: string) => {
    setSearchQuery(text);
    dismissKeyboard();
    saveSearchToHistory(text);
  };

  const saveSearchToHistory = (text: string) => {
    if (!text.trim()) return;
    const clean = text.trim();
    setSearchHistory(prev => {
      const updated = [clean, ...prev.filter(q => q.toLowerCase() !== clean.toLowerCase())].slice(0, 8);
      try {
        localStorage.setItem('dinesmart_search_history', JSON.stringify(updated));
      } catch {}
      return updated;
    });
  };

  const clearSearchHistory = () => {
    setSearchHistory([]);
    try {
      localStorage.removeItem('dinesmart_search_history');
    } catch {}
  };

  // Note 11: Voice Search Microphone ("mic pettu")
  const handleToggleVoiceSearch = () => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      alert('Voice recognition is not supported in this browser. Please type your search.');
      return;
    }

    if (isListening) {
      setIsListening(false);
      return;
    }

    try {
      const recognition = new SpeechRecognition();
      recognition.lang = 'en-IN';
      recognition.continuous = false;
      recognition.interimResults = false;

      recognition.onstart = () => {
        setIsListening(true);
      };

      recognition.onresult = (event: any) => {
        const transcript = event.results[0][0].transcript;
        if (transcript) {
          handleSelectQuery(transcript);
        }
        setIsListening(false);
      };

      recognition.onerror = () => {
        setIsListening(false);
      };

      recognition.onend = () => {
        setIsListening(false);
      };

      recognition.start();
    } catch (e) {
      console.warn('SpeechRecognition error:', e);
      setIsListening(false);
    }
  };

  // Filtering Logic
  useEffect(() => {
    let result = menuItems;

    // AI suggestion queries
    if (searchQuery === 'special') {
      result = result.filter(item => item.isSpecial);
    } else if (searchQuery === 'top_rated') {
      result = result.filter(item => item.rating >= 4.8);
    } else if (searchQuery === 'under_100') {
      result = result.filter(item => item.price <= 100);
    } else if (searchQuery === 'quick') {
      result = result.filter(item => item.prepTime && (item.prepTime.includes('3') || item.prepTime.includes('5') || item.prepTime.includes('10')));
    } else if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(item => 
        item.name.toLowerCase().includes(q) || 
        item.description.toLowerCase().includes(q) ||
        item.category.toLowerCase().includes(q)
      );
    }

    // Category
    if (selectedCategory !== 'All') {
      result = result.filter(item => item.category === selectedCategory);
    }

    // Diet / Veg Filter
    if (dietFilter === 'Veg') {
      result = result.filter(item => item.isVeg);
    } else if (dietFilter === 'Non-Veg') {
      result = result.filter(item => !item.isVeg);
    } else if (dietFilter === 'Beverages') {
      result = result.filter(item => item.category === 'Beverages');
    }

    setFilteredItems(result);
  }, [searchQuery, selectedCategory, dietFilter, menuItems]);

  return (
    <div className="flex-1 pb-28 overflow-y-auto no-scrollbar flex flex-col selection:bg-orange-500 selection:text-white">
      {/* Sticky Search Header */}
      <div className="p-4 bg-white border-b border-gray-100 sticky top-0 z-30 shadow-xs">
        <form 
          onSubmit={(e) => {
            e.preventDefault();
            dismissKeyboard();
            saveSearchToHistory(searchQuery);
          }}
          className="relative flex items-center gap-2"
        >
          <div className="relative flex-1 flex items-center">
            <input
              ref={searchInputRef}
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  dismissKeyboard();
                  saveSearchToHistory(searchQuery);
                }
              }}
              placeholder="Search dishes, drinks, biryani..."
              className="w-full bg-gray-50 border border-gray-200 rounded-2xl py-3 pl-10 pr-9 text-xs focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 text-brand-text font-bold"
            />
            <Search size={16} className="absolute left-3.5 text-gray-400" />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-3 text-gray-400 hover:text-gray-600 p-1"
              >
                <X size={14} />
              </button>
            )}
          </div>

          {/* Note 11: Voice Search Microphone Button ("mic pettu") */}
          <button
            type="button"
            onClick={handleToggleVoiceSearch}
            className={`w-11 h-11 rounded-2xl flex items-center justify-center transition-all shadow-sm cursor-pointer ${
              isListening 
                ? 'bg-red-500 text-white animate-pulse shadow-red-500/30' 
                : 'bg-orange-50 text-orange-600 hover:bg-orange-100'
            }`}
            title="Voice Search"
          >
            {isListening ? <MicOff size={18} /> : <Mic size={18} />}
          </button>
        </form>

        {/* Note 11 & Note 14: AI Suggestion Boxes ("boxes ai pettali") */}
        <div className="mt-3">
          <div className="flex items-center gap-1 mb-1.5">
            <Sparkles size={12} className="text-orange-500" />
            <span className="text-[10px] font-extrabold text-orange-600 uppercase tracking-wider">AI Suggestions</span>
          </div>
          <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1">
            {aiSuggestions.map((box) => (
              <button
                key={box.query}
                onClick={() => handleSelectQuery(box.query)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[11px] font-extrabold whitespace-nowrap transition-all border cursor-pointer active:scale-95 ${
                  searchQuery === box.query
                    ? 'bg-orange-500 text-white border-orange-500 shadow-sm'
                    : 'bg-orange-50/70 border-orange-200/60 text-orange-800 hover:bg-orange-100/70'
                }`}
              >
                <span>{box.icon}</span>
                <span>{box.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Recent Search History Chips */}
        {searchHistory.length > 0 && !searchQuery && (
          <div className="mt-2.5 pt-2 border-t border-gray-50 flex items-center gap-1.5 overflow-x-auto no-scrollbar">
            <span className="text-[10px] text-gray-400 font-semibold whitespace-nowrap">Recent:</span>
            {searchHistory.map((term, i) => (
              <button
                key={i}
                onClick={() => handleSelectQuery(term)}
                className="text-[11px] font-semibold bg-gray-100 hover:bg-gray-200 text-slate-700 px-2.5 py-1 rounded-lg whitespace-nowrap transition-colors"
              >
                {term}
              </button>
            ))}
            <button
              onClick={clearSearchHistory}
              className="text-[10px] text-gray-400 hover:text-red-500 ml-auto whitespace-nowrap px-1"
            >
              Clear
            </button>
          </div>
        )}
      </div>

      {/* Category Scroll Slider */}
      <div className="py-2.5 border-b border-gray-100 bg-white">
        <div className="flex overflow-x-auto px-4 gap-2 no-scrollbar">
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => {
                setSelectedCategory(cat);
                dismissKeyboard();
              }}
              className={`px-3.5 py-1.5 text-xs font-bold rounded-full border transition-all whitespace-nowrap cursor-pointer active:scale-95 ${
                selectedCategory === cat
                  ? 'bg-orange-500 border-orange-500 text-white shadow-sm'
                  : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* Diet / Sub filters */}
      <div className="px-4 py-2 bg-slate-50 flex gap-2 border-b border-gray-100">
        {dietFilters.map((df) => (
          <button
            key={df.name}
            onClick={() => {
              setDietFilter(df.name);
              dismissKeyboard();
            }}
            className={`px-3 py-1 text-xs font-bold rounded-xl border transition-all cursor-pointer ${
              dietFilter === df.name
                ? 'bg-white border-orange-500 text-orange-600 shadow-xs'
                : 'bg-transparent border-gray-200 text-gray-500 hover:bg-gray-100'
            }`}
          >
            {df.name === 'Veg' ? '🟢 ' : df.name === 'Non-Veg' ? '🔴 ' : ''}
            {df.label}
          </button>
        ))}
      </div>

      {/* Grid listing */}
      <div className="flex-1 px-4 py-4 space-y-3.5">
        {filteredItems.length > 0 ? (
          filteredItems.map((item) => {
            // Note 22: Limit warnings and numbers ("limit pettaka adi warning ivvatle and number chupinchatle")
            const isUnlimited = item.isUnlimited ?? true;
            const limit = item.dailyLimit ?? 50;
            const sold = item.soldCount ?? 0;
            const remaining = Math.max(0, limit - sold);
            const isSoldOut = !isUnlimited && remaining <= 0;
            const isLowStock = !isUnlimited && remaining > 0 && remaining <= 5;

            return (
              <div
                key={item.id}
                onClick={() => {
                  dismissKeyboard();
                  onSelectDish(item);
                }}
                className={`flex bg-white rounded-2xl border p-3 shadow-xs hover:shadow-md transition-all cursor-pointer items-start justify-between group active:scale-[0.99] ${
                  isSoldOut ? 'border-gray-200 opacity-70' : 'border-gray-100 hover:border-orange-200'
                }`}
              >
                <div className="flex gap-3 flex-1 min-w-0">
                  <div className="relative w-20 h-20 rounded-xl overflow-hidden flex-shrink-0 bg-gray-100">
                    <ImageWithFallback 
                      src={item.image} 
                      alt={item.name} 
                      className="w-full h-full object-cover"
                    />
                    {isSoldOut && (
                      <div className="absolute inset-0 bg-black/60 rounded-xl flex items-center justify-center">
                        <span className="text-[10px] text-white font-black uppercase tracking-wider">Sold Out</span>
                      </div>
                    )}
                    <span className={`absolute top-1 left-1 w-3.5 h-3.5 rounded-sm border border-white flex items-center justify-center shadow-xs ${
                      item.isVeg ? 'bg-green-600' : 'bg-red-600'
                    }`}>
                      <span className="w-1 h-1 rounded-full bg-white"></span>
                    </span>
                  </div>
                
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <h4 className="font-extrabold text-brand-text text-xs truncate group-hover:text-primary transition-colors">
                        {item.name}
                      </h4>
                      {item.spicyLevel && item.spicyLevel > 0 ? (
                        <Flame size={12} className="text-orange-500 flex-shrink-0" fill="currentColor" />
                      ) : null}
                    </div>
                    
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="flex items-center text-[11px] text-amber-500 font-bold">
                        ★ {item.rating}
                      </span>
                      <span className="text-[10px] text-gray-400 font-medium">({item.reviewsCount})</span>
                      <span className="text-[10px] text-gray-400">• {item.prepTime}</span>
                    </div>

                    {/* Note 22: Display remaining limit number and warning */}
                    {!isUnlimited && (
                      <div className="mt-1 flex items-center gap-1">
                        {isSoldOut ? (
                          <span className="text-[10px] font-extrabold text-red-600 bg-red-50 px-2 py-0.5 rounded-md">
                            Sold Out Today
                          </span>
                        ) : isLowStock ? (
                          <span className="text-[10px] font-extrabold text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-md flex items-center gap-1">
                            <AlertTriangle size={10} />
                            Only {remaining} left!
                          </span>
                        ) : (
                          <span className="text-[10px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md">
                            {remaining} portions available
                          </span>
                        )}
                      </div>
                    )}
                    
                    <p className="text-[11px] text-gray-400 mt-1 line-clamp-1">
                      {item.description}
                    </p>
                    
                    <p className="text-xs font-black text-brand-text mt-1">₹{item.price}</p>
                  </div>
                </div>

                {/* Add Button */}
                <button 
                  onClick={(e) => {
                    e.stopPropagation();
                    dismissKeyboard();
                    onSelectDish(item);
                  }}
                  disabled={isSoldOut}
                  className={`w-8 h-8 rounded-xl flex items-center justify-center font-black transition-all shadow-sm active:scale-95 flex-shrink-0 self-center ml-2 cursor-pointer ${
                    isSoldOut 
                      ? 'bg-gray-200 text-gray-400 cursor-not-allowed' 
                      : 'bg-orange-500 text-white hover:bg-orange-600'
                  }`}
                >
                  +
                </button>
              </div>
            );
          })
        ) : (
          <div className="text-center py-12">
            <p className="text-gray-400 text-xs font-medium">No dishes match your filters.</p>
            <button 
              onClick={() => { setSearchQuery(''); setSelectedCategory('All'); setDietFilter('All'); }}
              className="text-xs text-orange-600 font-bold mt-2"
            >
              Reset Filters
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
