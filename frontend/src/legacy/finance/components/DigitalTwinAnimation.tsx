// @ts-nocheck
import React, { useEffect, useMemo, useState, useRef } from 'react';
import { Building, Users, Shield, Server, Activity, Cpu, Database, Zap, Globe, Link } from 'lucide-react';
import { supabase } from '../utils/supabase';

const DigitalTwinAnimation: React.FC = () => {
    const [rotation, setRotation] = useState({ x: 65, y: 0, z: 0 });
    const [hover, setHover] = useState(false);
    const [pulsePos, setPulsePos] = useState(0);
    const [throughputMbps, setThroughputMbps] = useState<number | null>(null);
    const [latencyMs, setLatencyMs] = useState<number | null>(null);
    const [activeNodes, setActiveNodes] = useState<number | null>(null);
    const [uplinkState, setUplinkState] = useState<'secure' | 'degraded' | 'offline'>('secure');
    const sceneRef = useRef<HTMLDivElement>(null);

    // Auto-rotation and Energy Pulse
    useEffect(() => {
        const interval = setInterval(() => {
            if (!hover) {
                setRotation(prev => ({ ...prev, z: (prev.z + 0.15) % 360 }));
            }
            setPulsePos(prev => (prev + 1) % 100);
        }, 16);
        return () => clearInterval(interval);
    }, [hover]);

    useEffect(() => {
        const connection = (navigator as Navigator & {
            connection?: { downlink?: number; effectiveType?: string; rtt?: number; saveData?: boolean };
        }).connection;

        if (connection?.downlink) {
            setThroughputMbps(Number(connection.downlink.toFixed(1)) * 125);
            setLatencyMs(connection.rtt ?? null);
            setUplinkState(connection.effectiveType === 'slow-2g' || connection.effectiveType === '2g' ? 'degraded' : 'secure');
        }

        const measureLatency = async () => {
            const started = performance.now();
            try {
                await supabase.from('companies').select('id', { count: 'exact', head: true });
                setLatencyMs(Math.max(1, Math.round(performance.now() - started)));
            } catch {
                setLatencyMs((current) => current ?? Math.max(1, Math.round(performance.now() - started)));
                setUplinkState((current) => (current === 'secure' ? 'degraded' : current));
            }
        };

        const loadNodeCount = async () => {
            const queries = [
                supabase.from('companies').select('id', { count: 'exact', head: true }),
                supabase.from('profiles').select('id', { count: 'exact', head: true }),
            ];

            const results = await Promise.allSettled(queries);
            const counts = results
                .map((result) => (result.status === 'fulfilled' ? result.value.count ?? 0 : 0))
                .filter((count) => typeof count === 'number') as number[];

            const total = counts.reduce((sum, count) => sum + count, 0);
            if (total > 0) {
                setActiveNodes(total);
            }
        };

        void measureLatency();
        void loadNodeCount();
    }, []);

    const throughputLabel = useMemo(() => {
        if (throughputMbps === null) return 'Live network';
        return `${throughputMbps.toLocaleString(undefined, { maximumFractionDigits: 1 })} MB/S`;
    }, [throughputMbps]);

    const latencyLabel = useMemo(() => {
        if (latencyMs === null) return 'measuring...';
        return `${latencyMs}ms`;
    }, [latencyMs]);

    const handleMouseMove = (e: React.MouseEvent) => {
        setHover(true);
        const rect = e.currentTarget.getBoundingClientRect();
        const x = (e.clientX - rect.left - rect.width / 2) / 15;
        const y = (e.clientY - rect.top - rect.height / 2) / 15;
        setRotation(prev => ({ ...prev, x: 65 - y, y: x }));
    };

    const handleMouseLeave = () => {
        setHover(false);
        setRotation(prev => ({ ...prev, x: 65, y: 0 }));
    };

    // --- Sub-components for cleaner structure ---

    // Crystalline Pillar
    const Pillar = ({ color, icon: Icon, delay = 0, zOffset = 40, size = "w-10 h-10" }: any) => (
        <div className="absolute transform-style-3d transition-all duration-1000" style={{ transform: `translateZ(${zOffset}px)` }}>
            {/* Holographic Beam */}
            <div className={`absolute bottom-0 left-1/2 -translate-x-1/2 w-1 h-[200px] bg-gradient-to-t from-${color}/50 to-transparent blur-[2px] opacity-40 -rotate-x-90 translate-y-[100px]`}></div>
            
            {/* The Polygon structure */}
            <div className={`relative ${size} transform-style-3d animate-spin-slow`}>
                {[0, 60, 120, 180, 240, 300].map(deg => (
                    <div key={deg} 
                         className={`absolute inset-0 border border-${color}/40 bg-${color}/40 backdrop-blur-[2px]`}
                         style={{ transform: `rotateY(${deg}deg) translateZ(20px)` }}>
                    </div>
                ))}
                <div className={`absolute inset-0 flex items-center justify-center bg-${color}/60 border border-${color}/50`} style={{ transform: 'translateZ(20px)', boxShadow: `0 0 20px -2px var(--tw-color-${color}-400, ${color})` }}>
                    <Icon className={`text-white animate-pulse-slow`} size={18} />
                    {/* Success indicator */}
                    <div className="absolute -top-1 -right-1 w-2 h-2 bg-green-500 rounded-full border border-black shadow-[0_0_10px_#22c55e]"></div>
                </div>
            </div>
        </div>
    );

    // Data Link Beam
    const DataLink = ({ rotation = 0, color = "pink-500", length = "w-48" }: any) => (
        <div className="absolute top-1/2 left-1/2 origin-left transform-style-3d" style={{ transform: `translateZ(10px) rotate(${rotation}deg)` }}>
            <div className={`${length} h-px bg-gradient-to-r from-${color}/80 via-${color}/20 to-transparent`}>
                {/* Moving Packet */}
                <div className={`absolute h-1 w-4 bg-${color} blur-[2px] rounded-full`}
                     style={{ left: `${pulsePos}%`, opacity: pulsePos > 90 || pulsePos < 10 ? 0 : 1 }}></div>
            </div>
        </div>
    );

    return (
        <div
            className="relative w-full h-[350px] flex items-center justify-center perspective-2000 overflow-hidden cursor-crosshair"
            onMouseMove={handleMouseMove}
            onMouseLeave={handleMouseLeave}
        >
            {/* --- THE SCENE --- */}
            <div
                className="relative w-[320px] h-[320px] transform-style-3d transition-transform duration-300 ease-out"
                style={{
                    transform: `rotateX(${rotation.x}deg) rotateY(${rotation.y}deg) rotateZ(${rotation.z}deg)`
                }}
            >
                {/* 1. LAYER: THE GRID PLATFORM */}
                <div className="absolute inset-0 border-4 border-white/5 rounded-full transform-style-3d">
                    <div className="absolute inset-0 bg-[radial-gradient(circle,rgba(168,85,247,0.1)_0%,transparent_70%)] rounded-full"></div>
                    <div className="absolute inset-0 opacity-20 bg-[radial-gradient(circle_at_center,#8b5cf6_1px,transparent_1px)] bg-[size:20px_20px]"></div>
                    
                    {/* Scanning Sweep */}
                    <div className="absolute top-1/2 left-1/2 w-[120%] h-[120%] border border-brand-purple/20 rounded-full -translate-x-1/2 -translate-y-1/2 animate-ping opacity-20"></div>
                </div>

                {/* 2. LAYER: CENTRAL NEXUS */}
                <div className="absolute top-1/2 left-1/2 transform-style-3d -translate-x-1/2 -translate-y-1/2">
                    <div className="relative w-24 h-24 transform-style-3d animate-spin-reverse">
                        {/* Core Cube Structure */}
                        {[0, 90, 180, 270].map(y => (
                            <div key={y} 
                                 className="absolute inset-0 border-2 border-brand-purple bg-brand-purple/60 backdrop-blur-md shadow-[0_0_40px_rgba(168,85,247,0.6)]"
                                 style={{ transform: `rotateY(${y}deg) translateZ(48px)` }}>
                            </div>
                        ))}
                        <div className="absolute inset-0 flex items-center justify-center translate-z-[60px] -rotate-x-90">
                            <Server className="text-white drop-shadow-[0_0_20px_rgba(168,85,247,1)]" size={40} />
                        </div>
                    </div>
                </div>

                {/* 3. LAYER: SATELLITE TOWERS */}
                
                {/* HR Module (Orange) */}
                <div className="absolute top-0 left-1/2 -translate-x-1/2 transform-style-3d">
                    <Pillar color="orange-500" icon={Users} zOffset={60} />
                    <DataLink rotation={90} color="orange-500" />
                </div>

                {/* Security Module (Green) */}
                <div className="absolute bottom-1/4 left-0 transform-style-3d">
                    <Pillar color="green-500" icon={Shield} zOffset={40} />
                    <DataLink rotation={-30} color="green-500" />
                </div>

                {/* Real Estate Module (Cyan) */}
                <div className="absolute bottom-1/4 right-0 transform-style-3d">
                    <Pillar color="cyan-400" icon={Building} zOffset={80} />
                    <DataLink rotation={210} color="cyan-400" />
                </div>

                {/* 4. LAYER: ORBITAL RINGS */}
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[280px] h-[280px] border border-white/10 rounded-full transform-style-3d animate-spin-slow">
                    <div className="absolute top-0 left-1/2 w-4 h-4 bg-white rounded-full shadow-[0_0_20px_white] -translate-x-1/2 -translate-y-1/2"></div>
                    <div className="absolute top-1/2 left-0 w-2 h-2 bg-brand-purple rounded-full shadow-[0_0_15px_#a855f7] -translate-x-1/2 -translate-y-1/2"></div>
                </div>
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[340px] h-[340px] border-2 border-dashed border-brand-purple/20 rounded-full transform-style-3d animate-spin-reverse opacity-40"></div>

                {/* --- DATA PARTICLES --- */}
                {[...Array(12)].map((_, i) => (
                    <div key={i} 
                         className="absolute w-1 h-1 bg-white rounded-full animate-float opacity-30 shadow-[0_0_10px_white]"
                         style={{
                             left: `${Math.random() * 100}%`,
                             top: `${Math.random() * 100}%`,
                             transform: `translateZ(${Math.random() * 200 - 100}px)`,
                             animationDelay: `${Math.random() * 5}s`
                         }}></div>
                ))}

            </div>

            {/* --- HOLOGRAPHIC HUD OVERLAY --- */}
            <div className="absolute inset-0 pointer-events-none z-30">
                {/* Top Corner Details */}
                <div className="absolute top-8 left-8 p-4 border-l-2 border-t-2 border-brand-purple/40 backdrop-blur-md bg-black/10 rounded-tl-xl animate-fade-in">
                    <div className="flex items-center gap-3 text-brand-purple mb-2">
                        <Activity className="animate-pulse" size={16} />
                        <span className="text-[10px] font-black tracking-widest uppercase">Nexus Core Status</span>
                    </div>
                    <div className="space-y-1">
                        <div className="flex justify-between items-center gap-8">
                            <span className="text-[9px] text-gray-500">THROUGHPUT</span>
                            <span className="text-[10px] font-mono font-bold text-white">{throughputLabel}</span>
                        </div>
                        <div className="w-full bg-gray-800 h-1 rounded-full overflow-hidden">
                            <div className="h-full bg-brand-purple animate-ping-slow origin-left w-3/4"></div>
                        </div>
                    </div>
                </div>

                <div className="absolute top-8 right-8 text-right p-4 border-r-2 border-t-2 border-cyan-500/40 backdrop-blur-md bg-black/10 rounded-tr-xl">
                    <div className="flex items-center justify-end gap-3 text-cyan-400 mb-2">
                        <span className="text-[10px] font-black tracking-widest uppercase">Module Sync</span>
                        <Globe size={16} />
                    </div>
                    <div className="text-[9px] text-gray-400 font-mono">
                        LATENCY: {latencyLabel}<br/>
                        ACTIVE NODES: {activeNodes?.toLocaleString() ?? 'syncing...'}<br/>
                        UPLINK: {uplinkState.toUpperCase()}
                    </div>
                </div>

                {/* Bottom Center Visualizer */}
                <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex items-end gap-1 h-12">
                    {[1,2,3,4,5,6,7,8].map(i => (
                        <div key={i} 
                             className="w-1 bg-brand-purple opacity-40 rounded-full animate-bounce" 
                             style={{ height: `${Math.random() * 100}%`, animationDelay: `${i * 100}ms` }}></div>
                    ))}
                    <span className="ml-3 text-[10px] font-mono text-gray-500">SIG_INT_FREQ</span>
                </div>
            </div>

            <style>{`
                .perspective-2000 { perspective: 2000px; }
                .transform-style-3d { transform-style: preserve-3d; }
                .animate-spin-slow { animation: spin 25s linear infinite; }
                .animate-spin-reverse { animation: spin 35s linear infinite reverse; }
                .animate-pulse-slow { animation: pulse 3s ease-in-out infinite; }
                @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
                @keyframes pulse { 0%, 100% { opacity: 1; transform: scale(1); } 50% { opacity: 0.7; transform: scale(0.95); } }
                @keyframes float { 
                    0%, 100% { transform: translateY(0) translateZ(50px); opacity: 0.1; }
                    50% { transform: translateY(-100px) translateZ(100px); opacity: 0.4; }
                }
                .animate-float { animation: float 10s ease-in-out infinite; }
                .animate-ping-slow { animation: ping 4s cubic-bezier(0, 0, 0.2, 1) infinite; }
            `}</style>
        </div>
    );
};

export default DigitalTwinAnimation;
