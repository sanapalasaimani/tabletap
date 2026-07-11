import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { db } from '../../supabase';
import { X, Star, Heart } from 'lucide-react';

interface FeedbackModalProps {
  orderId: string;
  onClose: () => void;
  onSubmitSuccess?: () => void;
}

export const FeedbackModal: React.FC<FeedbackModalProps> = ({ orderId, onClose, onSubmitSuccess }) => {
  const { tableId } = useApp();
  const [foodRating, setFoodRating] = useState(5);
  const [serviceRating, setServiceRating] = useState(5);
  const [ambienceRating, setAmbienceRating] = useState(5);
  const [comments, setComments] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    setLoading(true);
    const success = await db.submitFeedback(
      orderId,
      { food: foodRating, service: serviceRating, ambience: ambienceRating },
      comments
    );
    setLoading(false);
    if (success) {
      if (onSubmitSuccess) onSubmitSuccess();
      onClose();
    }
  };

  const renderStars = (rating: number, setRating: (r: number) => void) => {
    return (
      <div className="flex gap-2.5">
        {[1, 2, 3, 4, 5].map((star) => (
          <button
            key={star}
            onClick={() => setRating(star)}
            className="focus:outline-none transition-transform active:scale-125"
          >
            <Star 
              size={28} 
              fill={star <= rating ? '#EAB308' : 'none'} 
              stroke={star <= rating ? '#EAB308' : '#D1D5DB'} 
              className="stroke-2"
            />
          </button>
        ))}
      </div>
    );
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 animate-fade-in">
      <div className="absolute inset-0" onClick={onClose}></div>

      <div className="relative w-full max-w-[400px] bg-white rounded-3xl overflow-hidden shadow-2xl p-6 z-10 animate-slide-up">
        {/* Close Button */}
        <button 
          onClick={onClose} 
          className="absolute top-4 right-4 w-8 h-8 flex items-center justify-center bg-gray-100 hover:bg-gray-200 rounded-full text-gray-500 transition-colors"
        >
          <X size={16} />
        </button>

        <div className="text-center mb-6">
          <h2 className="text-xl font-bold text-brand-text">Rate Your Experience</h2>
          <p className="text-gray-500 text-xs mt-1">Thank you for dining with us! Help us improve.</p>
        </div>

        <div className="space-y-5 mb-6">
          {/* Food Rating */}
          <div className="flex flex-col items-center">
            <span className="text-sm font-semibold text-gray-600 mb-2">How was the food?</span>
            {renderStars(foodRating, setFoodRating)}
            <span className="text-xs text-yellow-600 font-medium mt-1">
              {foodRating === 5 ? 'Excellent!' : foodRating === 4 ? 'Very Good' : foodRating === 3 ? 'Good' : foodRating === 2 ? 'Average' : 'Poor'}
            </span>
          </div>

          {/* Service Rating */}
          <div className="flex flex-col items-center border-t border-gray-100 pt-4">
            <span className="text-sm font-semibold text-gray-600 mb-2">How was the service?</span>
            {renderStars(serviceRating, setServiceRating)}
            <span className="text-xs text-yellow-600 font-medium mt-1">
              {serviceRating === 5 ? 'Excellent!' : serviceRating === 4 ? 'Very Good' : serviceRating === 3 ? 'Good' : serviceRating === 2 ? 'Average' : 'Poor'}
            </span>
          </div>

          {/* Ambience Rating */}
          <div className="flex flex-col items-center border-t border-gray-100 pt-4">
            <span className="text-sm font-semibold text-gray-600 mb-2">How was the ambience?</span>
            {renderStars(ambienceRating, setAmbienceRating)}
            <span className="text-xs text-yellow-600 font-medium mt-1">
              {ambienceRating === 5 ? 'Excellent!' : ambienceRating === 4 ? 'Very Good' : ambienceRating === 3 ? 'Good' : ambienceRating === 2 ? 'Average' : 'Poor'}
            </span>
          </div>
        </div>

        {/* Text Area */}
        <div className="mb-6">
          <label className="block text-sm font-semibold text-gray-600 mb-2 text-left">Your Feedback</label>
          <textarea
            value={comments}
            onChange={(e) => setComments(e.target.value)}
            placeholder="Tell us what you liked or how we can improve..."
            className="w-full p-3 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary h-24 resize-none bg-gray-50/50"
          />
        </div>

        {/* Submit */}
        <button
          onClick={handleSubmit}
          disabled={loading}
          className="w-full bg-primary text-white font-bold py-3.5 px-6 rounded-full hover:bg-primary-hover transition-colors shadow-lg shadow-primary/25 disabled:bg-gray-300"
        >
          {loading ? 'Submitting...' : 'Submit Feedback'}
        </button>

        <p className="text-[10px] text-gray-400 text-center mt-3 flex items-center justify-center gap-1">
          <Heart size={10} fill="#EF4444" stroke="none" />
          <span>Thank you! Your feedback helps us serve you better.</span>
        </p>
      </div>
    </div>
  );
};
