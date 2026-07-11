import React, { useState } from 'react';
import { MenuItem } from '../../types';
import { useApp } from '../../context/AppContext';
import { X, Star, Flame, Clock, Heart } from 'lucide-react';

interface DishDetailModalProps {
  item: MenuItem;
  onClose: () => void;
}

export const DishDetailModal: React.FC<DishDetailModalProps> = ({ item, onClose }) => {
  const { addToCart, toggleFavorite, isFavorite } = useApp();
  const [quantity, setQuantity] = useState(1);
  const isSoldOut = !item.isUnlimited && item.dailyLimit !== undefined && (item.soldCount || 0) >= item.dailyLimit;
  
  // Customization choices
  const [selectedInstructions, setSelectedInstructions] = useState<string[]>([]);
  const [extraToppings, setExtraToppings] = useState<string[]>([]);
  const [notes, setNotes] = useState('');

  const customizationOptions = ['Less Spicy', 'No Onion', 'Extra Masala', 'No Garlic'];
  const toppingOptions = [
    { name: 'Extra Cheese', price: 30 },
    { name: 'Double Portion', price: 80 },
    { name: 'Add Paneer Cubes', price: 40 },
  ];

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
        <div className="absolute top-4 left-4 right-4 flex justify-between items-center z-10">
          <button 
            onClick={onClose} 
            className="w-10 h-10 flex items-center justify-center bg-white/80 backdrop-blur-md rounded-full shadow-md text-brand-text hover:bg-white"
          >
            <X size={20} />
          </button>
          <button 
            onClick={() => toggleFavorite(item)} 
            className="w-10 h-10 flex items-center justify-center bg-white/80 backdrop-blur-md rounded-full shadow-md text-primary hover:bg-white"
          >
            <Heart size={20} fill={isFavorite(item.id) ? '#FF7A00' : 'none'} className="transition-all" />
          </button>
        </div>

        <div className="overflow-y-auto no-scrollbar pb-32">
          {/* Cover Image */}
          <div className="w-full h-64 relative bg-gray-100">
            <img 
              src={item.image} 
              alt={item.name} 
              className="w-full h-full object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent"></div>
            <div className="absolute bottom-4 left-4 flex gap-2">
              <span className={`px-2.5 py-1 text-xs font-semibold rounded-full text-white ${item.isVeg ? 'bg-green-600' : 'bg-red-600'}`}>
                {item.isVeg ? 'Veg' : 'Non-Veg'}
              </span>
              {item.spicyLevel && item.spicyLevel > 0 ? (
                <span className="px-2.5 py-1 text-xs font-semibold rounded-full bg-orange-600 text-white flex items-center gap-1">
                  <Flame size={12} fill="#fff" />
                  {item.spicyLevel === 3 ? 'Spicy' : 'Medium'}
                </span>
              ) : null}
            </div>
          </div>

          {/* Dish Details */}
          <div className="p-5">
            <div className="flex justify-between items-start mb-2">
              <h2 className="text-2xl font-bold text-brand-text">{item.name}</h2>
              <div className="text-right">
                <p className="text-2xl font-bold text-primary">₹{item.price}</p>
                {!item.isUnlimited && item.dailyLimit !== undefined && (
                  <span className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full ${
                    isSoldOut ? 'bg-red-100 text-red-600 border border-red-200' : 'bg-orange-100 text-orange-600 border border-orange-200'
                  }`}>
                    {isSoldOut ? 'Sold Out' : `${item.dailyLimit - (item.soldCount || 0)} / ${item.dailyLimit} Left`}
                  </span>
                )}
              </div>
            </div>

            <div className="flex items-center gap-4 text-sm text-gray-500 mb-4">
              <div className="flex items-center gap-1 text-yellow-500 font-semibold">
                <Star size={16} fill="#EAB308" stroke="none" />
                <span>{item.rating}</span>
                <span className="text-gray-400 font-normal">({item.reviewsCount})</span>
              </div>
              <div className="flex items-center gap-1">
                <Clock size={16} />
                <span>{item.prepTime}</span>
              </div>
              <div>
                <span>🔥 {item.calories} kcal</span>
              </div>
            </div>

            <p className="text-gray-600 text-sm leading-relaxed mb-6">
              {item.description}
            </p>

            {/* Special Instructions (Chips select) */}
            <div className="mb-6">
              <h3 className="font-semibold text-brand-text mb-3">Special Instructions <span className="text-xs text-gray-400 font-normal">(Optional)</span></h3>
              <div className="flex flex-wrap gap-2">
                {customizationOptions.map((opt) => {
                  const isSelected = selectedInstructions.includes(opt);
                  return (
                    <button
                      key={opt}
                      onClick={() => handleToggleInstruction(opt)}
                      className={`px-4 py-2 text-xs font-medium rounded-full border transition-all ${
                        isSelected
                          ? 'bg-primary/10 border-primary text-primary font-semibold'
                          : 'border-gray-200 text-gray-600 bg-white hover:bg-gray-50'
                      }`}
                    >
                      {opt}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Extra Toppings (Add-ons) */}
            <div className="mb-6 border-t border-gray-100 pt-5">
              <h3 className="font-semibold text-brand-text mb-3">Add Customizations</h3>
              <div className="space-y-3">
                {toppingOptions.map((topping) => {
                  const isSelected = extraToppings.includes(topping.name);
                  return (
                    <label 
                      key={topping.name}
                      onClick={() => handleToggleTopping(topping.name)}
                      className={`flex justify-between items-center p-3 rounded-xl border text-sm cursor-pointer transition-all ${
                        isSelected 
                          ? 'border-primary/50 bg-primary/5' 
                          : 'border-gray-100 bg-gray-50/50 hover:bg-gray-50'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <input 
                          type="checkbox" 
                          checked={isSelected}
                          onChange={() => {}} // handled by click on parent
                          className="accent-primary w-4 h-4 rounded" 
                        />
                        <span className="font-medium text-brand-text">{topping.name}</span>
                      </div>
                      <span className="text-gray-500 font-semibold">+₹{topping.price}</span>
                    </label>
                  );
                })}
              </div>
            </div>

            {/* Custom Notes */}
            <div className="border-t border-gray-100 pt-5">
              <h3 className="font-semibold text-brand-text mb-3">Custom Note to Chef</h3>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="E.g., Make it sweet, serve extra sauce, extra cutlery..."
                className="w-full p-3 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary h-20 resize-none bg-gray-50/50"
              />
            </div>
          </div>
        </div>

        {/* Bottom Cart Action Bar */}
        <div className="absolute bottom-0 left-0 right-0 bg-white border-t border-gray-100 p-4 flex gap-4 items-center">
          {/* Quantity Selector */}
          <div className="flex items-center border border-gray-200 rounded-full py-2.5 px-4 bg-gray-50">
            <button 
              onClick={() => setQuantity(q => Math.max(1, q - 1))}
              disabled={isSoldOut}
              className={`text-gray-500 hover:text-brand-text font-bold text-lg px-2 ${isSoldOut ? 'opacity-30 cursor-not-allowed' : ''}`}
            >
              -
            </button>
            <span className="w-8 text-center font-bold text-brand-text">{isSoldOut ? 0 : quantity}</span>
            <button 
              onClick={() => setQuantity(q => q + 1)}
              disabled={isSoldOut}
              className={`text-gray-500 hover:text-brand-text font-bold text-lg px-2 ${isSoldOut ? 'opacity-30 cursor-not-allowed' : ''}`}
            >
              +
            </button>
          </div>

          {/* Add to Cart Button */}
          <button
            onClick={handleAddToCart}
            disabled={isSoldOut}
            className={`flex-1 font-bold py-3.5 px-6 rounded-full shadow-lg transition-all text-center ${
              isSoldOut 
                ? 'bg-red-500 text-white cursor-not-allowed hover:bg-red-650' 
                : 'bg-primary text-white hover:bg-primary-hover shadow-primary/25'
            }`}
          >
            {isSoldOut ? 'Sold Out' : `Add to Cart - ₹${totalPrice}`}
          </button>
        </div>

      </div>
    </div>
  );
};
