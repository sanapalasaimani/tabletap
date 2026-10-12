import React, { useState, useEffect } from 'react';
import { useApp } from '../../context/AppContext';
import { db } from '../../supabase';
import { MENU_ITEMS } from '../../data/menu';
import { MenuItem } from '../../types';
import { Search, Star, Flame, Sparkles, Bell } from 'lucide-react';
import { mlService } from '../../services/mlService';

interface HomeScreenProps {
  onSelectDish: (item: MenuItem) => void;
  onNavigateToSearch: (category?: MenuItem['category']) => void;
}

export const HomeScreen: React.FC<HomeScreenProps> = ({ onSelectDish, onNavigateToSearch }) => {
  const { customerName, tableId } = useApp();
  const [menuItems, setMenuItems] = useState<MenuItem[]>(MENU_ITEMS);

  useEffect(() => {
    db.getMenuItems().then(setMenuItems);
  }, []);

  const specialDish = menuItems.find(item => item.isSpecial) || menuItems[0] || MENU_ITEMS[0];
  const recommendedDishes = menuItems.filter(item => item.isSpecial || item.rating >= 4.8).slice(0, 5);

  // Determine greeting based on current time
  const getGreeting = () => {
    const hrs = new Date().getHours();
    if (hrs < 12) return 'Good Morning';
    if (hrs < 17) return 'Good Afternoon';
    return 'Good Evening';
  };

  const categories: { name: MenuItem['category']; label: string; icon: string }[] = [
    { name: 'Breakfast', label: 'Breakfast', icon: '🍳' },
    { name: 'Soups', label: 'Soups', icon: '🥣' },
    { name: 'Starters', label: 'Starters', icon: '🍢' },
    { name: 'Main Course', label: 'Mains', icon: '🍲' },
    { name: 'Combos', label: 'Combos', icon: '🍱' },
    { name: 'Breads', label: 'Breads', icon: '🫓' },
    { name: 'Desserts', label: 'Desserts', icon: '🍰' },
    { name: 'Beverages', label: 'Drinks', icon: '🍹' },
  ];

  return (
    <div className="flex-1 pb-24 overflow-y-auto no-scrollbar">
      {/* Greetings Area */}
      <div className="p-5 bg-gradient-to-b from-primary/5 via-primary/[0.01] to-transparent">
        <div className="flex justify-between items-center mb-4">
          <div>
            <p className="text-xs text-gray-400 font-semibold uppercase tracking-wider">{getGreeting()}</p>
            <h2 className="text-2xl font-bold text-brand-text leading-tight">{customerName || 'Valued Guest'}</h2>
            <div className="flex items-center gap-1.5 mt-0.5">
              <span className="w-2 h-2 rounded-full bg-primary animate-ping"></span>
              <span className="text-xs text-primary font-semibold">Table {tableId}</span>
            </div>
          </div>
          <button className="relative w-10 h-10 bg-white rounded-full flex items-center justify-center border border-gray-100 shadow-sm text-gray-600">
            <Bell size={20} />
            <span className="absolute top-2.5 right-2.5 w-2 h-2 bg-primary rounded-full"></span>
          </button>
        </div>

        {/* Search Bar - clicking redirects to Search View */}
        <div 
          onClick={() => onNavigateToSearch()}
          className="relative flex items-center bg-white border border-gray-100 rounded-2xl p-3.5 shadow-sm text-gray-400 text-sm cursor-pointer mb-5"
        >
          <Search size={18} className="text-gray-400 mr-2.5" />
          <span>Search for dishes, desserts...</span>
        </div>

        {/* Today's Special Banner */}
        <div 
          onClick={() => onSelectDish(specialDish)}
          className="relative bg-brand-text rounded-3xl overflow-hidden shadow-xl text-white cursor-pointer group transition-transform active:scale-[0.99] border border-black"
        >
          <div className="absolute inset-0 bg-gradient-to-r from-black/80 via-black/40 to-transparent z-10"></div>
          <img 
            src={specialDish.image} 
            alt={specialDish.name} 
            className="absolute right-0 top-0 h-full w-[60%] object-cover group-hover:scale-105 transition-transform duration-500"
          />
          <div className="relative p-5 z-20 w-[65%] flex flex-col justify-between min-h-[160px]">
            <div>
              <span className="inline-flex items-center gap-1 bg-primary text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-full mb-3">
                <Sparkles size={10} fill="#fff" />
                Today's Special
              </span>
              <h3 className="text-lg font-bold leading-snug">{specialDish.name}</h3>
              <div className="flex items-center gap-2 mt-1.5 text-xs text-gray-300">
                <span className="flex items-center text-yellow-400">
                  ★ <span className="ml-0.5 font-bold">{specialDish.rating}</span>
                </span>
                <span>({specialDish.reviewsCount})</span>
              </div>
            </div>
            <p className="text-xl font-black text-primary mt-2">₹{specialDish.price}</p>
          </div>
        </div>
      </div>

      {/* Categories Grid */}
      <div className="px-5 mb-6">
        <div className="flex justify-between items-center mb-3">
          <h3 className="font-bold text-brand-text text-base">Categories</h3>
          <button 
            onClick={() => onNavigateToSearch()} 
            className="text-xs font-semibold text-primary"
          >
            View all
          </button>
        </div>
        <div className="grid grid-cols-4 gap-3">
          {categories.map((cat) => (
            <button
              key={cat.name}
              onClick={() => onNavigateToSearch(cat.name)}
              className="flex flex-col items-center bg-white border border-gray-100 hover:border-primary/20 rounded-2xl p-3 shadow-sm transition-all active:scale-95"
            >
              <span className="text-2xl mb-1.5">{cat.icon}</span>
              <span className="text-[10px] font-bold text-gray-500 whitespace-nowrap">{cat.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* 🤖 ML Dynamically Best in Hotel Section (Dynamic Session & Sales Intelligence) */}
      <div className="px-5 mb-6">
        <div className="flex justify-between items-center mb-3">
          <div className="flex items-center gap-2">
            <span className="w-6 h-6 rounded-lg bg-purple-100 text-purple-700 flex items-center justify-center text-xs font-black">
              ML
            </span>
            <div>
              <h3 className="font-extrabold text-brand-text text-base leading-none flex items-center gap-1.5">
                Dynamic Best in Hotel
                <span className="text-[10px] bg-purple-50 text-purple-600 border border-purple-200 px-1.5 py-0.5 rounded-full font-bold">
                  Live AI Scored
                </span>
              </h3>
              <p className="text-[10px] text-gray-400 mt-0.5">Trained on 23,708 real orders & current dining slot</p>
            </div>
          </div>
        </div>

        {/* Horizontal ML Carousel */}
        <div className="flex gap-3 overflow-x-auto no-scrollbar pb-2">
          {mlService.getBestForCurrentSession().dishes.map((mlDish) => {
            const matchedItem = menuItems.find(m => m.name.toLowerCase() === mlDish.name.toLowerCase()) || menuItems[0];
            return (
              <div
                key={mlDish.name}
                onClick={() => onSelectDish(matchedItem)}
                className="min-w-[200px] max-w-[210px] bg-gradient-to-b from-white to-purple-50/20 border border-purple-100/80 rounded-2xl p-3 shadow-xs hover:shadow-md transition-all cursor-pointer flex-shrink-0 group"
              >
                <div className="relative mb-2.5">
                  <img
                    src={matchedItem.image}
                    alt={mlDish.name}
                    className="w-full h-24 rounded-xl object-cover group-hover:scale-105 transition-transform duration-300"
                  />
                  <span className="absolute top-2 left-2 bg-purple-600/90 backdrop-blur-xs text-white text-[9px] font-black px-2 py-0.5 rounded-md shadow-xs">
                    ★ {mlDish.compositeScore}/100 Match
                  </span>
                  <span className="absolute bottom-2 right-2 bg-black/70 backdrop-blur-xs text-white text-[9px] font-bold px-1.5 py-0.5 rounded-md">
                    ⏱️ {mlDish.avgPrepDelayMin}m prep
                  </span>
                </div>
                <h4 className="font-bold text-xs text-brand-text truncate group-hover:text-purple-700 transition-colors">
                  {mlDish.name}
                </h4>
                <div className="flex items-center justify-between mt-2 pt-2 border-t border-purple-100/50">
                  <span className="text-xs font-black text-brand-text">₹{matchedItem.price}</span>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onSelectDish(matchedItem);
                    }}
                    className="text-[10px] font-extrabold bg-purple-600 text-white px-2.5 py-1 rounded-lg hover:bg-purple-700 transition-colors"
                  >
                    Add +
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Recommended for You */}
      <div className="px-5">
        <h3 className="font-bold text-brand-text text-base mb-3">Recommended for You</h3>
        <div className="space-y-4">
          {recommendedDishes.map((dish) => {
            const isSoldOut = !dish.isUnlimited && dish.dailyLimit !== undefined && (dish.soldCount || 0) >= dish.dailyLimit;
            return (
              <div
                key={dish.id}
                onClick={() => onSelectDish(dish)}
                className="flex bg-white rounded-2xl border border-gray-100/80 p-3 shadow-sm hover:shadow-md transition-all cursor-pointer items-center justify-between group active:scale-[0.99]"
              >
                <div className="flex items-center gap-3.5 flex-1">
                  <div className="relative">
                    <img 
                      src={dish.image} 
                      alt={dish.name} 
                      className="w-16 h-16 rounded-xl object-cover shadow-sm bg-gray-50"
                    />
                    {isSoldOut && (
                      <div className="absolute inset-0 bg-black/60 rounded-xl flex items-center justify-center">
                        <span className="text-[8px] text-white font-extrabold uppercase tracking-wider">Sold Out</span>
                      </div>
                    )}
                  </div>
                <div className="flex-1 min-w-0">
                  <h4 className="font-bold text-brand-text text-sm truncate group-hover:text-primary transition-colors">
                    {dish.name}
                  </h4>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="flex items-center text-xs text-yellow-500 font-semibold">
                      ★ {dish.rating}
                    </span>
                    <span className="text-[10px] text-gray-400">({dish.reviewsCount} orders)</span>
                  </div>
                  <p className="text-sm font-bold text-brand-text mt-1">₹{dish.price}</p>
                </div>
              </div>
              
              {/* Plus Button */}
              <button 
                onClick={(e) => {
                  e.stopPropagation();
                  onSelectDish(dish);
                }}
                className="w-9 h-9 rounded-xl bg-primary/10 hover:bg-primary text-primary hover:text-white flex items-center justify-center font-bold transition-all shadow-sm"
              >
                +
              </button>
            </div>
          );})}
        </div>
      </div>
    </div>
  );
};
