import React, { useState, useEffect } from 'react';
import { MenuItem } from '../../types';
import { MENU_ITEMS } from '../../data/menu';
import { db } from '../../supabase';
import { useApp } from '../../context/AppContext';
import { Search, Star, Flame } from 'lucide-react';

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

  const categories: ('All' | MenuItem['category'])[] = ['All', 'Breakfast', 'Main Course', 'Beverages', 'Desserts'];
  const dietFilters: { name: DietFilter; label: string }[] = [
    { name: 'All', label: 'All Dishes' },
    { name: 'Veg', label: 'Veg Only' },
    { name: 'Non-Veg', label: 'Non-Veg' },
    { name: 'Beverages', label: 'Drinks' },
  ];

  // Filtering Logic
  useEffect(() => {
    let result = menuItems;

    // Search Query
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(item => 
        item.name.toLowerCase().includes(q) || 
        item.description.toLowerCase().includes(q)
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
  }, [searchQuery, selectedCategory, dietFilter]);

  return (
    <div className="flex-1 pb-24 overflow-y-auto no-scrollbar flex flex-col">
      {/* Search Header */}
      <div className="p-5 bg-white border-b border-gray-50 sticky top-0 z-30">
        <div className="relative flex items-center">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search menu items..."
            className="w-full bg-gray-50 border border-gray-200 rounded-2xl py-3 pl-11 pr-4 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary text-brand-text font-medium"
          />
          <Search size={18} className="absolute left-4 text-gray-400" />
        </div>
      </div>

      {/* Category Scroll Slider */}
      <div className="py-4 border-b border-gray-50 bg-white">
        <div className="flex overflow-x-auto px-5 gap-2.5 no-scrollbar">
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={`px-4 py-2 text-xs font-semibold rounded-full border transition-all whitespace-nowrap ${
                selectedCategory === cat
                  ? 'bg-primary border-primary text-white shadow-sm'
                  : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* Diet / Sub filters */}
      <div className="px-5 py-3.5 bg-brand-bg/50 flex gap-2">
        {dietFilters.map((df) => (
          <button
            key={df.name}
            onClick={() => setDietFilter(df.name)}
            className={`px-3 py-1.5 text-xs font-semibold rounded-xl border transition-all ${
              dietFilter === df.name
                ? 'bg-white border-primary/25 text-primary shadow-sm'
                : 'bg-transparent border-gray-200/60 text-gray-500 hover:bg-gray-100/50'
            }`}
          >
            {df.name === 'Veg' ? '🟢 ' : df.name === 'Non-Veg' ? '🔴 ' : ''}
            {df.label}
          </button>
        ))}
      </div>

      {/* Grid listing */}
      <div className="flex-1 px-5 py-4 space-y-4">
        {filteredItems.length > 0 ? (
          filteredItems.map((item) => {
            const isSoldOut = !item.isUnlimited && item.dailyLimit !== undefined && (item.soldCount || 0) >= item.dailyLimit;
            return (
              <div
                key={item.id}
                onClick={() => onSelectDish(item)}
                className="flex bg-white rounded-2xl border border-gray-100 p-3 shadow-sm hover:shadow-md transition-all cursor-pointer items-start justify-between group active:scale-[0.99]"
              >
                <div className="flex gap-3.5 flex-1 min-w-0">
                  <div className="relative">
                    <img 
                      src={item.image} 
                      alt={item.name} 
                      className="w-20 h-20 rounded-xl object-cover shadow-sm bg-gray-50"
                    />
                    {isSoldOut && (
                      <div className="absolute inset-0 bg-black/60 rounded-xl flex items-center justify-center">
                        <span className="text-[10px] text-white font-extrabold uppercase tracking-wider">Sold Out</span>
                      </div>
                    )}
                    <span className={`absolute -top-1 -left-1 w-4 h-4 rounded-md border-2 border-white flex items-center justify-center shadow-sm ${item.isVeg ? 'bg-green-600' : 'bg-red-600'}`}>
                      <span className="w-1.5 h-1.5 rounded-full bg-white"></span>
                    </span>
                  </div>
                
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <h4 className="font-bold text-brand-text text-sm truncate group-hover:text-primary transition-colors">
                      {item.name}
                    </h4>
                    {item.spicyLevel && item.spicyLevel > 0 ? (
                      <Flame size={13} className="text-orange-500 flex-shrink-0" fill="currentColor" />
                    ) : null}
                  </div>
                  
                  <div className="flex items-center gap-2 mt-1">
                    <span className="flex items-center text-xs text-yellow-500 font-semibold">
                      ★ {item.rating}
                    </span>
                    <span className="text-[10px] text-gray-400">({item.reviewsCount})</span>
                  </div>
                  
                  <p className="text-xs text-gray-400 mt-1 line-clamp-1">
                    {item.description}
                  </p>
                  
                  <p className="text-sm font-bold text-brand-text mt-1.5">₹{item.price}</p>
                </div>
              </div>

              {/* Add Button */}
              <button 
                onClick={(e) => {
                  e.stopPropagation();
                  onSelectDish(item);
                }}
                className="w-9 h-9 rounded-xl bg-primary text-white flex items-center justify-center font-bold transition-all shadow-md shadow-primary/10 hover:bg-primary-hover active:scale-95 flex-shrink-0 self-center ml-2"
              >
                +
              </button>
            </div>
          )})
        ) : (
          <div className="text-center py-12">
            <p className="text-gray-400 text-sm font-medium">No dishes match your filters.</p>
            <button 
              onClick={() => { setSearchQuery(''); setSelectedCategory('All'); setDietFilter('All'); }}
              className="text-xs text-primary font-semibold mt-2"
            >
              Reset Filters
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
