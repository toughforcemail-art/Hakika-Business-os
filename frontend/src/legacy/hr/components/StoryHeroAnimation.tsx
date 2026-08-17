// @ts-nocheck
import React, { useEffect, useState, useRef } from 'react';
import { Shield, Users, Building, Lock, Database, Zap, Activity, Globe, Server, CheckCircle2 } from 'lucide-react';

const StoryHeroAnimation: React.FC = () => {
    // Animation Phases: 'chaos' | 'unifying' | 'harmonized'
    const [phase, setPhase] = useState<'chaos' | 'unifying' | 'harmonized'>('chaos');
    const [mousePos, setMousePos] = useState({ x: 0, y: 0 });

    useEffect(() => {
        // Cycle through the "Story"
        const chaosTimer = setTimeout(() => setPhase('unifying'), 2500); // Start unifying after 2.5s
        const harmonyTimer = setTimeout(() => setPhase('harmonized'), 5500); // Fully harmonized after 5.5s

        return () => {
            clearTimeout(chaosTimer);
            clearTimeout(harmonyTimer);
        };
    }, []);

    const handleMouseMove = (e: React.MouseEvent) => {
        const rect = e.currentTarget.getBoundingClientRect();
        const x = (e.clientX - rect.left - rect.width / 2) / 20;
        const y = (e.clientY - rect.top - rect.height / 2) / 20;
        setMousePos({ x, y });
    };

    return (
        <div
            className="w-full h-[500px] flex items-center justify-center perspective-1000 overflow-hidden cursor-pointer"
            onMouseMove={handleMouseMove}
            onClick={() => setPhase('chaos')} // Click to restart story
        >
            <div
                className="relative w-[300px] h-[300px] transform-style-3d transition-transform duration-200 ease-out"
                style={{
                    transform: `rotateX(${10 - mousePos.y}deg) rotateY(${mousePos.x}deg)`
                }}
            >
                {/* --- THE CORE (The Unified Database) --- */}
                <div className={`absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-24 h-24 transform-style-3d transition-all duration-1000 ease-in-out z-20 ${phase === 'chaos' ? 'scale-0 opacity-0' : 'scale-100 opacity-100'
                    }`}>
                    {/* Glowing Cube */}
                    <div className="absolute inset-0 bg-brand-purple/20 border border-brand-purple/50 rounded-xl backdrop-blur-md shadow-[0_0_50px_rgba(168,85,247,0.4)] animate-pulse-slow"></div>
                    <div className="absolute inset-0 flex items-center justify-center">
                        <Database size={32} className="text-white animate-bounce-slow" />
                    </div>
                    {/* Laser Connectivity Beams */}
                    <div className={`absolute top-1/2 left-1/2 w-[200px] h-[2px] bg-gradient-to-r from-brand-purple to-transparent -translate-y-1/2 origin-left rotate-0 transition-opacity duration-1000 ${phase === 'harmonized' ? 'opacity-100' : 'opacity-0'}`} />
                    <div className={`absolute top-1/2 left-1/2 w-[200px] h-[2px] bg-gradient-to-r from-brand-cyan to-transparent -translate-y-1/2 origin-left rotate-120 transition-opacity duration-1000 ${phase === 'harmonized' ? 'opacity-100' : 'opacity-0'}`} />
                    <div className={`absolute top-1/2 left-1/2 w-[200px] h-[2px] bg-gradient-to-r from-brand-gold to-transparent -translate-y-1/2 origin-left rotate-240 transition-opacity duration-1000 ${phase === 'harmonized' ? 'opacity-100' : 'opacity-0'}`} />
                </div>

                {/* --- MODULE 1: HR (Purple) --- */}
                <div className={`absolute top-1/2 left-1/2 transition-all duration-1000 ease-in-out transform-style-3d ${phase === 'chaos'
                        ? '-translate-x-32 -translate-y-40 translate-z-20 rotate-12'
                        : phase === 'unifying'
                            ? '-translate-x-16 -translate-y-16 scale-50 opacity-50'
                            : 'rotate-[0deg] translate-x-[120px] translate-y-0' // Orbit Status
                    }`}>
                    <div className={`relative p-4 rounded-2xl border backdrop-blur-md transition-all duration-700 ${phase === 'harmonized'
                            ? 'bg-brand-purple/10 border-brand-purple text-white w-16 h-16 flex items-center justify-center shadow-[0_0_30px_rgba(168,85,247,0.3)] animate-float'
                            : 'bg-white/5 border-white/10 text-gray-400 w-32 h-auto'
                        }`}>
                        <Users size={phase === 'harmonized' ? 24 : 32} className="mx-auto mb-2" />
                        {phase !== 'harmonized' && (
                            <div className="text-[10px] text-center font-mono">
                                <div className="h-1 w-full bg-gray-700 rounded mb-1 overflow-hidden"><div className="w-1/2 h-full bg-red-500"></div></div>
                                Fragmented Data
                            </div>
                        )}
                        {/* Success Badge */}
                        {phase === 'harmonized' && <div className="absolute -top-2 -right-2 w-4 h-4 bg-green-500 rounded-full border-2 border-black" />}
                    </div>
                </div>

                {/* --- MODULE 2: SECURITY (Cyan) --- */}
                <div className={`absolute top-1/2 left-1/2 transition-all duration-1000 ease-in-out delay-100 transform-style-3d ${phase === 'chaos'
                        ? 'translate-x-40 translate-y-10 translate-z-[-20px] -rotate-12'
                        : phase === 'unifying'
                            ? 'translate-x-16 translate-y-16 scale-50 opacity-50'
                            : 'rotate-[120deg] translate-x-[-60px] translate-y-[100px]'
                    }`}>
                    <div className={`relative p-4 rounded-2xl border backdrop-blur-md transition-all duration-700 ${phase === 'harmonized'
                            ? 'bg-brand-cyan/10 border-brand-cyan text-white w-16 h-16 flex items-center justify-center shadow-[0_0_30px_rgba(34,211,238,0.3)] animate-float-delayed'
                            : 'bg-white/5 border-white/10 text-gray-400 w-32 h-auto'
                        }`}>
                        <Shield size={phase === 'harmonized' ? 24 : 32} className="mx-auto mb-2" />
                        {phase !== 'harmonized' && (
                            <div className="text-[10px] text-center font-mono">
                                <div className="h-1 w-full bg-gray-700 rounded mb-1 overflow-hidden"><div className="w-1/3 h-full bg-yellow-500"></div></div>
                                Offline Logs
                            </div>
                        )}
                        {phase === 'harmonized' && <div className="absolute -top-2 -right-2 w-4 h-4 bg-green-500 rounded-full border-2 border-black" />}
                    </div>
                </div>

                {/* --- MODULE 3: REAL ESTATE (Gold) --- */}
                <div className={`absolute top-1/2 left-1/2 transition-all duration-1000 ease-in-out delay-200 transform-style-3d ${phase === 'chaos'
                        ? '-translate-x-10 translate-y-48 translate-z-10 rotate-45'
                        : phase === 'unifying'
                            ? 'translate-x-0 translate-y-[-30px] scale-50 opacity-50'
                            : 'rotate-[240deg] translate-x-[-60px] translate-y-[-100px]'
                    }`}>
                    <div className={`relative p-4 rounded-2xl border backdrop-blur-md transition-all duration-700 ${phase === 'harmonized'
                            ? 'bg-brand-gold/10 border-brand-gold text-white w-16 h-16 flex items-center justify-center shadow-[0_0_30px_rgba(250,204,21,0.3)] animate-float'
                            : 'bg-white/5 border-white/10 text-gray-400 w-32 h-auto'
                        }`}>
                        <Building size={phase === 'harmonized' ? 24 : 32} className="mx-auto mb-2" />
                        {phase !== 'harmonized' && (
                            <div className="text-[10px] text-center font-mono">
                                <div className="h-1 w-full bg-gray-700 rounded mb-1 overflow-hidden"><div className="w-1/4 h-full bg-orange-500"></div></div>
                                Unsync Leases
                            </div>
                        )}
                        {phase === 'harmonized' && <div className="absolute -top-2 -right-2 w-4 h-4 bg-green-500 rounded-full border-2 border-black" />}
                    </div>
                </div>

                {/* --- ORBITAL RINGS (Only visible in Harmonized) --- */}
                <div className={`absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[300px] h-[300px] border border-white/10 rounded-full transition-all duration-1000 -rotate-x-60 ${phase === 'harmonized' ? 'opacity-100 scale-100 animate-spin-slow' : 'opacity-0 scale-50'}`}>
                </div>
                <div className={`absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[200px] h-[200px] border border-brand-purple/20 rounded-full transition-all duration-1000 rotate-x-60 rotate-y-[20deg] ${phase === 'harmonized' ? 'opacity-100 scale-100 animate-spin-reverse' : 'opacity-0 scale-50'}`}>
                </div>

                {/* --- FLOATING DEBRIS (Chaos Mode) --- */}
                {phase === 'chaos' && (
                    <>
                        <div className="absolute top-0 right-0 p-2 bg-red-500/10 border border-red-500/30 rounded text-[10px] text-red-400 animate-pulse">Critical Error</div>
                        <div className="absolute bottom-10 left-10 p-2 bg-yellow-500/10 border border-yellow-500/30 rounded text-[10px] text-yellow-400 animate-bounce">Sync Failed</div>
                    </>
                )}

                {/* --- CAPTION --- */}
                <div className="absolute -bottom-20 left-1/2 -translate-x-1/2 text-center w-full transition-opacity duration-500">
                    <p className="text-sm font-mono text-brand-purple uppercase tracking-widest">
                        {phase === 'chaos' && 'Detecting Operational Silos...'}
                        {phase === 'unifying' && 'Initiating Nexus Protocol...'}
                        {phase === 'harmonized' && 'System Harmonized'}
                    </p>
                </div>
            </div>

            <style>{`
                .perspective-1000 { perspective: 1000px; }
                .transform-style-3d { transform-style: preserve-3d; }
                .animate-spin-slow { animation: spin 20s linear infinite; }
                .animate-spin-reverse { animation: spin 25s linear infinite reverse; }
                .animate-float { animation: float 4s ease-in-out infinite; }
                .animate-float-delayed { animation: float 4s ease-in-out infinite 2s; }
                .animate-pulse-slow { animation: pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite; }
                
                @keyframes spin { from { transform: translate(-50%, -50%) rotateX(60deg) rotate(0deg); } to { transform: translate(-50%, -50%) rotateX(60deg) rotate(360deg); } }
                @keyframes float { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-10px); } }
                @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: .5; } }
            `}</style>
        </div>
    );
};

export default StoryHeroAnimation;
