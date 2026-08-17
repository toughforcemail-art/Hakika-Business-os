// @ts-nocheck
import React from 'react';

interface CustomLoaderProps {
    size?: number;
    className?: string;
    label?: string;
    text?: string;
}

const CustomLoader: React.FC<CustomLoaderProps> = ({ size = 64, className = "", label, text }) => {
    const displayLabel = label || text;
    return (
        <div className={`legacy-custom-loader flex flex-col items-center justify-center gap-6 ${className}`}>
            <div className="legacy-loader-orbit relative group" style={{ width: size, height: size }}>
                {/* Outer Glow & Atmosphere */}
                <div className="legacy-loader-glow absolute -inset-8 bg-brand-purple/20 blur-[40px] rounded-full animate-pulse opacity-50" />
                
                {/* Main Glass Ring */}
                <div className="legacy-loader-ring absolute inset-0 rounded-full border-[3px] border-white/10 backdrop-blur-sm" />
                
                {/* Secondary Orbiting Ring (Gold) */}
                <div 
                  className="legacy-loader-ring absolute inset-0 rounded-full border-[3px] border-transparent border-t-[#c89f5e] animate-[spin_1.5s_linear_infinite] drop-shadow-[0_0_8px_#c89f5e]"
                />

                {/* Primary Orbiting Ring (Purple) */}
                <div 
                  className="legacy-loader-ring legacy-loader-ring-inner absolute inset-[4px] rounded-full border-[3px] border-transparent border-b-brand-purple animate-[spin_2s_linear_infinite_reverse] drop-shadow-[0_0_12px_#9333ea]"
                />

                {/* Central Floating Core */}
                <div className="legacy-loader-core absolute inset-[18px] rounded-full bg-gradient-to-br from-brand-purple to-[#c89f5e] animate-bounce shadow-2xl">
                    <div className="absolute inset-0 rounded-full bg-white/20 blur-[2px]" />
                </div>

                {/* Particle Accents */}
                <div className="legacy-loader-particle absolute -top-2 left-1/2 -translate-x-1/2 w-1.5 h-1.5 rounded-full bg-white shadow-[0_0_10px_white] animate-ping" />
            </div>

            {displayLabel && (
                <div className="text-center space-y-1">
                    <p className="text-[10px] font-black text-brand-purple uppercase tracking-[0.4em] animate-pulse">
                        {displayLabel}
                    </p>
                    <div className="flex justify-center gap-1">
                        {[0, 1, 2].map((i) => (
                            <div 
                              key={i} 
                              className="w-1 h-1 rounded-full bg-[#c89f5e] animate-bounce" 
                              style={{ animationDelay: `${i * 0.1}s` }}
                            />
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
};

export default CustomLoader;
