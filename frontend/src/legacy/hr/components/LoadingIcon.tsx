// @ts-nocheck
import React from 'react';

interface LoadingIconProps {
  size?: 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
  light?: boolean;
}

const LoadingIcon: React.FC<LoadingIconProps> = ({ 
  size = 'md', 
  className = '',
  light = false 
}) => {
  const sizeMap = {
    sm: { box: 'w-5 h-5', border: 'border-2', core: 'w-1 h-1' },
    md: { box: 'w-8 h-8', border: 'border-[2.5px]', core: 'w-1.5 h-1.5' },
    lg: { box: 'w-12 h-12', border: 'border-3', core: 'w-2 h-2' },
    xl: { box: 'w-20 h-20', border: 'border-4', core: 'w-4 h-4' }
  };

  const currentSize = sizeMap[size];

  return (
    <div className={`relative flex items-center justify-center ${currentSize.box} ${className}`}>
      {/* Dynamic Background Glow */}
      <div className={`absolute inset-0 rounded-full bg-brand-purple/10 blur-md animate-pulse`} />
      
      {/* Outer Rotating Segmented Ring */}
      <div className={`
        absolute inset-0 
        ${currentSize.border} 
        border-transparent 
        border-t-brand-purple 
        border-r-[#c89f5e]/40
        rounded-full 
        animate-spin
      `} />
      
      {/* Static Glass Backdrop Ring */}
      <div className={`
        absolute inset-0 
        ${currentSize.border} 
        border-white/10 
        dark:border-white/5 
        rounded-full
      `} />
      
      {/* Pulsing Core */}
      <div className={`
        ${currentSize.core} 
        rounded-full 
        bg-gradient-to-br from-brand-purple to-[#c89f5e]
        shadow-[0_0_10px_rgba(147,51,234,0.5)]
        animate-pulse
      `} />
    </div>
  );
};

export default LoadingIcon;
