import React, { useState } from 'react';
import { COMING_SOON_IMAGE } from '../../data/menu';

interface ImageWithFallbackProps extends React.ImgHTMLAttributes<HTMLImageElement> {
  fallbackSrc?: string;
  wrapperClassName?: string;
  dishName?: string;
}

export const ImageWithFallback: React.FC<ImageWithFallbackProps> = ({
  src,
  alt,
  className = '',
  wrapperClassName = '',
  fallbackSrc = COMING_SOON_IMAGE,
  ...props
}) => {
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState(false);

  const finalSrc = error || !src ? fallbackSrc : src;

  return (
    <div className={`relative overflow-hidden bg-slate-100 ${wrapperClassName}`}>
      {/* Skeleton Shimmer Placeholder to prevent layout shift */}
      {!loaded && !error && (
        <div className="absolute inset-0 bg-gradient-to-r from-gray-200 via-gray-100 to-gray-200 animate-pulse" />
      )}
      
      <img
        src={finalSrc}
        alt={alt || 'Dish'}
        loading="lazy"
        onLoad={() => setLoaded(true)}
        onError={() => {
          setError(true);
          setLoaded(true);
        }}
        className={`w-full h-full object-cover transition-opacity duration-300 ${
          loaded ? 'opacity-100' : 'opacity-0'
        } ${className}`}
        {...props}
      />
    </div>
  );
};
