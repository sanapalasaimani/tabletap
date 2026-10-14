import React, { useState } from 'react';
import { MenuItem } from '../../types';
import { useApp } from '../../context/AppContext';
import { X, Star, Flame, Clock, Heart, AlertTriangle } from 'lucide-react';
import { ImageWithFallback } from '../common/ImageWithFallback';

interface DishDetailModalProps {
  item: MenuItem;
  onClose: () => void;
}

export const DishDetailModal: React.FC<DishDetailModalProps> = ({ item, onClose }) => {
  const { addToCart, toggleFavorite, isFavorite } = useApp();
  const [quantity, setQuantity] = useState(1);
  
  // Note 22: Limit warnings and numbers ("limit pettaka adi warning ivvatle and number chupinchatle")
  const isUnlimited = item.isUnlimited ?? true;
  const limit = item.dailyLimit ?? 50;
  const sold = item.soldCount ?? 0;
  const remaining = Math.max(0, limit - sold);
  const isSoldOut = !isUnlimited && remaining <= 0;
  
  // Customization choices
  const [selectedInstructions, setSelectedInstructions] = useState<string[]>([]);
  const [extraToppings, setExtraToppings] = useState<string[]>([]);
  const [notes, setNotes] = useState('');

  // Note 9: Dynamic customizations tailored per food product category
  const getDynamicCustomizations = (item: MenuItem) => {
    const cat = (item.category || '').toLowerCase();
    const name = (item.name || '').toLowerCase();

    if (cat.includes('breakfast') || name.includes('dosa') || name.includes('idli') || name.includes('poori') || name.includes('vada')) {
      return {
        instructions: ['Crispy Golden Roast', 'Extra Ghee Roast', 'No Onion', 'Less Spicy', 'Gunpowder / Podi Sprinkle'],
        toppings: [
          { name: 'Extra Coconut & Tomato Chutney', price: 20 },
          { name: 'Extra Hot Sambar Bowl', price: 25 },
          { name: 'Add 1pc Medu Vada', price: 35 },
        ]
      };
    }

    if (cat.includes('main') || name.includes('biryani') || name.includes('curry') || name.includes('chicken') || name.includes('paneer') || name.includes('dal') || name.includes('mutton')) {
      return {
        instructions: ['Less Spicy / Mild', 'Extra Dum Gravy / Salan', 'Extra Cucumber Raita', 'No Fresh Coriander', 'Boneless Cut Preference'],
        toppings: [
          { name: 'Boiled Egg (2pcs)', price: 25 },
          { name: 'Extra Spiced Gravy Bowl', price: 40 },
          { name: 'Extra Aromatic Dum Basmati Rice', price: 60 },
        ]
      };
    }

    if (cat.includes('starter') || name.includes('tikka') || name.includes('kebab') || name.includes('65') || name.includes('corn') || name.includes('spring')) {
      return {
        instructions: ['Extra Charred / Crispy', 'Mild Heat', 'Mint Chutney on Side', 'Extra Lemon Wedges', 'No Chat Masala'],
        toppings: [
          { name: 'Creamy Garlic Mayo Dip', price: 30 },
          { name: 'Extra Onion Lachha Salad', price: 25 },
          { name: 'Double Cheese Melting Glaze', price: 45 },
        ]
      };
    }

    if (cat.includes('bread') || name.includes('naan') || name.includes('roti') || name.includes('paratha') || name.includes('kulcha')) {
      return {
        instructions: ['Extra White Butter', 'Crispy Tandoori Charcoal Roast', 'Without Butter / Dry', 'Well Done Thin Cut'],
        toppings: [
          { name: 'Garlic Herb Butter Brush', price: 20 },
          { name: 'Melted Cheddar Stuffed Layer', price: 40 },
          { name: 'Spicy Green Chilli Flakes', price: 15 },
        ]
      };
    }

    if (cat.includes('beverage') || name.includes('lassi') || name.includes('chai') || name.includes('coffee') || name.includes('soda')) {
      return {
        instructions: ['Less Sugar', 'Sugar-Free', 'Extra Chilled', 'No Ice Cubes', 'Strong Brew Decoction'],
        toppings: [
          { name: 'Alphonso Mango Malai Scoop', price: 30 },
          { name: 'Vanilla Ice Cream Crown', price: 40 },
          { name: 'Crushed Almonds & Saffron', price: 35 },
        ]
      };
    }

    if (cat.includes('dessert') || name.includes('jamun') || name.includes('kulfi') || name.includes('halwa') || name.includes('kheer') || name.includes('rasmalai')) {
      return {
        instructions: ['Serve Piping Hot', 'Extra Chilled', 'Less Sweet / Mild Syrup', 'No Cardamom'],
        toppings: [
          { name: 'Thick Shahi Rabri Dip', price: 45 },
          { name: 'Roasted Pistachios & Almonds', price: 35 },
          { name: 'Creamy Vanilla Ice Cream Scoop', price: 40 },
        ]
      };
    }

    if (cat.includes('soup')) {
      return {
        instructions: ['Extra Hot', 'No Black Pepper', 'Low Salt', 'Extra Garlic Flavour'],
        toppings: [
          { name: 'Toasted Garlic Breadsticks (2pcs)', price: 35 },
          { name: 'Herb Croutons Bowl', price: 25 },
          { name: 'Fresh Cream Swirl', price: 20 },
        ]
      };
    }

    return {
      instructions: ['Less Spicy', 'No Onion', 'Extra Gravy', 'No Garlic'],
      toppings: [
        { name: 'Extra Cheese', price: 30 },
        { name: 'Double Portion', price: 80 },
        { name: 'Add Paneer Cubes', price: 40 },
      ]
    };
  };

  const dynamicData = getDynamicCustomizations(item);
  const customizationOptions = dynamicData.instructions;
  const toppingOptions = dynamicData.toppings;

  const handleToggleInstruction = (instruction: string) => {
    setSelectedInstructions(prev =>
      prev.includes(instruction)
        ? prev.filter(i => i !== instruction)
        : [...prev, instruction]
    );
  };

  const handleToggleTopping = (toppingName: string) => {
    setExtraToppings(prev =>
      prev.includes(toppingName)
        ? prev.filter(t => t !== toppingName)
        : [...prev, toppingName]
    );
  };

  const getToppingsPrice = () => {
    return extraToppings.reduce((sum, topping) => {
      const option = toppingOptions.find(o => o.name === topping);
      return sum + (option ? option.price : 0);
    }, 0);
  };

  const unitPrice = item.price + getToppingsPrice();
  const totalPrice = unitPrice * quantity;

  const handleAddToCart = () => {
    if (isSoldOut) return;
    const combinedInstructions = [...selectedInstructions, ...extraToppings];
    addToCart(item, quantity, combinedInstructions, notes);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 animate-fade-in">
      {/* Background overlay click */}
      <div className="absolute inset-0" onClick={onClose}></div>

      {/* Drawer Container */}
      <div className="relative w-full max-w-[480px] bg-white rounded-t-3xl overflow-hidden shadow-2xl z-10 animate-slide-up flex flex-col max-h-[92vh]">
        
        {/* Header Actions */}
        <div className="absolute top-4 left-4 right-4 flex justify-between items-center z-20">
          <button 
            onClick={onClose} 
            className="w-10 h-10 flex items-center justify-center bg-white/90 backdrop-blur-md rounded-full shadow-md text-brand-text hover:bg-white cursor-pointer"
          >
            <X size={20} />
          </button>
          <button 
            onClick={() => toggleFavorite(item)} 
            className="w-10 h-10 flex items-center justify-center bg-white/90 backdrop-blur-md rounded-full shadow-md text-primary hover:bg-white cursor-pointer"
          >
            <Heart size={20} fill={isFavorite(item.id) ? '#FF7A00' : 'none'} className="transition-all" />
          </button>
        </div>

        <div className="overflow-y-auto no-scrollbar pb-32">
          {/* Cover Image with Stable Fallback */}
          <div className="w-full h-64 relative bg-gray-100 overflow-hidden">
            <ImageWithFallback 
              src={item.image} 
              alt={item.name} 
              className="w-full h-full object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent"></div>
            <div className="absolute bottom-4 left-4 flex gap-2">
              <span className={`px-2.5 py-1 text-xs font-bold rounded-full text-white shadow-xs ${item.isVeg ? 'bg-green-600' : 'bg-red-600'}`}>
                {item.isVeg ? 'Veg' : 'Non-Veg'}
              </span>
              {item.spicyLevel && item.spicyLevel > 0 ? (
                <span className="px-2.5 py-1 text-xs font-bold rounded-full bg-orange-600 text-white flex items-center gap-1 shadow-xs">
                  <Flame size={12} fill="#fff" />
                  {item.spicyLevel === 3 ? 'Spicy' : 'Medium'}
                </span>
              ) : null}
              {item.isSpecial && (
                <span className="px-2.5 py-1 text-xs font-extrabold rounded-full bg-amber-500 text-white shadow-xs">
                  Chef's Special
                </span>
              )}
            </div>
          </div>

          {/* Details Content */}
          <div className="p-6">
            <div className="flex justify-between items-start mb-2">
              <div>
                <h2 className="text-xl font-black text-brand-text leading-tight">{item.name}</h2>
                <span className="text-xs font-bold text-orange-600 mt-0.5 inline-block">{item.category}</span>
              </div>
              <div className="text-right">
                <span className="text-2xl font-black text-brand-text">₹{unitPrice}</span>
                {extraToppings.length > 0 && (
                  <p className="text-[10px] text-gray-400 font-medium">incl. add-ons</p>
                )}
              </div>
            </div>

            {/* Note 22: Limit warnings and portions display */}
            {!isUnlimited && (
              <div className="mb-4">
                {isSoldOut ? (
                  <div className="p-2.5 bg-red-50 border border-red-200 rounded-2xl flex items-center gap-2 text-red-700 text-xs font-extrabold">
                    <AlertTriangle size={15} />
                    <span>This dish is currently sold out for today.</span>
                  </div>
                ) : remaining <= 5 ? (
                  <div className="p-2.5 bg-amber-50 border border-amber-200 rounded-2xl flex items-center gap-2 text-amber-800 text-xs font-extrabold">
                    <AlertTriangle size={15} />
                    <span>High demand! Only {remaining} portions left today.</span>
                  </div>
                ) : (
                  <div className="p-2 bg-emerald-50 border border-emerald-100 rounded-2xl text-emerald-800 text-xs font-bold flex items-center gap-1.5">
                    <span>✓ Freshly available: {remaining} portions remaining</span>
                  </div>
                )}
              </div>
            )}

            <p className="text-gray-500 text-xs leading-relaxed mb-4 font-medium">
              {item.description}
            </p>

            {/* Meta tags */}
            <div className="flex gap-4 p-3 bg-gray-50 rounded-2xl mb-6 text-xs text-gray-600 font-semibold border border-gray-100">
              <div className="flex items-center gap-1.5">
                <Clock size={14} className="text-primary" />
                <span>{item.prepTime}</span>
              </div>
              <div className="flex items-center gap-1.5 border-l border-gray-200 pl-4">
                <Flame size={14} className="text-orange-500" />
                <span>{item.calories} kcal</span>
              </div>
              <div className="flex items-center gap-1.5 border-l border-gray-200 pl-4">
                <Star size={14} className="text-yellow-500" fill="#EAB308" />
                <span>{item.rating} ({item.reviewsCount})</span>
              </div>
            </div>

            {/* Dynamic Custom Instructions */}
            <div className="mb-6">
              <h3 className="font-extrabold text-sm text-brand-text mb-3">Kitchen Cooking Instructions</h3>
              <div className="flex flex-wrap gap-2">
                {customizationOptions.map((opt) => (
                  <button
                    key={opt}
                    onClick={() => handleToggleInstruction(opt)}
                    className={`px-3.5 py-2 text-xs font-bold rounded-xl border transition-all cursor-pointer active:scale-95 ${
                      selectedInstructions.includes(opt)
                        ? 'bg-primary border-primary text-white shadow-xs'
                        : 'bg-white border-gray-200 text-gray-700 hover:bg-gray-50'
                    }`}
                  >
                    {opt}
                  </button>
                ))}
              </div>
            </div>

            {/* Dynamic Add-ons & Toppings */}
            <div className="mb-6">
              <h3 className="font-extrabold text-sm text-brand-text mb-3">Pairings & Add-Ons</h3>
              <div className="space-y-2">
                {toppingOptions.map((top) => (
                  <div
                    key={top.name}
                    onClick={() => handleToggleTopping(top.name)}
                    className={`flex justify-between items-center p-3 rounded-2xl border transition-all cursor-pointer ${
                      extraToppings.includes(top.name)
                        ? 'bg-orange-50/60 border-primary text-brand-text'
                        : 'bg-white border-gray-100 text-gray-700 hover:bg-gray-50'
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <input
                        type="checkbox"
                        checked={extraToppings.includes(top.name)}
                        onChange={() => {}}
                        className="rounded text-primary focus:ring-primary w-4 h-4 cursor-pointer accent-orange-500"
                      />
                      <span className="text-xs font-bold">{top.name}</span>
                    </div>
                    <span className="text-xs font-black text-brand-text">+₹{top.price}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Chef Special Notes */}
            <div className="mb-4">
              <h3 className="font-extrabold text-sm text-brand-text mb-2">Special Request for Chef</h3>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="E.g. Extra napkins, less salt, well-done..."
                className="w-full p-3 text-xs border border-gray-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary h-20 resize-none font-medium bg-gray-50/50"
              />
            </div>
          </div>
        </div>

        {/* Sticky Action Footer */}
        <div className="absolute bottom-0 left-0 right-0 p-4 bg-white/95 backdrop-blur-md border-t border-gray-100 flex items-center justify-between gap-4 z-20 shadow-lg">
          <div className="flex items-center gap-3 bg-gray-100 rounded-2xl p-1">
            <button
              onClick={() => setQuantity(Math.max(1, quantity - 1))}
              disabled={isSoldOut}
              className="w-9 h-9 rounded-xl bg-white flex items-center justify-center font-bold text-sm shadow-xs hover:bg-gray-50 active:scale-95 transition-all text-brand-text cursor-pointer disabled:opacity-50"
            >
              -
            </button>
            <span className="font-extrabold text-sm w-5 text-center text-brand-text">{quantity}</span>
            <button
              onClick={() => setQuantity(quantity + 1)}
              disabled={isSoldOut}
              className="w-9 h-9 rounded-xl bg-white flex items-center justify-center font-bold text-sm shadow-xs hover:bg-gray-50 active:scale-95 transition-all text-brand-text cursor-pointer disabled:opacity-50"
            >
              +
            </button>
          </div>

          <button
            onClick={handleAddToCart}
            disabled={isSoldOut}
            className="flex-1 py-3.5 px-6 bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 disabled:from-gray-300 disabled:to-gray-300 text-white font-black text-sm rounded-2xl shadow-lg shadow-orange-500/25 flex justify-between items-center transition-all active:scale-98 cursor-pointer disabled:cursor-not-allowed"
          >
            <span>{isSoldOut ? 'Dish Sold Out' : 'Add to Table Order'}</span>
            <span>₹{totalPrice}</span>
          </button>
        </div>

      </div>
    </div>
  );
};
