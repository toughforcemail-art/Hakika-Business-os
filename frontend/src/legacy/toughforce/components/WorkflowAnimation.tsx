// @ts-nocheck
import React, { useState, useEffect } from 'react';
import { Smartphone, CreditCard, Server, FileText, Users, BarChart3, CheckCircle2, ArrowRight, Zap, Database, Lock } from 'lucide-react';

const WorkflowAnimation: React.FC = () => {
    const [activeStep, setActiveStep] = useState(0);

    // Auto-cycle through steps for the animation focus, but let the user click too
    useEffect(() => {
        const interval = setInterval(() => {
            setActiveStep((prev) => (prev + 1) % 3);
        }, 5000); // 5 seconds per step
        return () => clearInterval(interval);
    }, []);

    return (
        <div className="py-24 bg-transparent dark:bg-dark-bg relative overflow-hidden transition-colors duration-300">
            {/* Background Gradients */}
            <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none">
                <div className="absolute top-[20%] left-[10%] w-[500px] h-[500px] bg-brand-purple/5 rounded-full blur-[100px]" />
                <div className="absolute bottom-[20%] right-[10%] w-[500px] h-[500px] bg-brand-cyan/5 rounded-full blur-[100px]" />
            </div>

            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
                <div className="text-center mb-16">
                    <h2 className="text-4xl font-bold text-gray-900 dark:text-white mb-4">Workflow Automation</h2>
                    <p className="text-gray-500 text-lg max-w-2xl mx-auto">
                        From setup to scale in three simple steps. Watch your operations run themselves.
                    </p>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
                    {/* Left Side: 3D Animation Stage */}
                    <div className="h-[500px] relative perspective-1000 group">
                        {/* The 3D Rotatable Container */}
                        <div className="relative w-full h-full transform-style-3d transition-transform duration-700 ease-out rotate-x-[10deg] rotate-y-[15deg]">

                            {/* Base Platform */}
                            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[90%] h-[90%] bg-white/5 dark:bg-white/5 backdrop-blur-sm border border-white/10 rounded-3xl transform-style-3d shadow-2xl -translate-z-[50px]">
                                {/* Grid Lines on Platform */}
                                <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.05)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.05)_1px,transparent_1px)] bg-[size:40px_40px] rounded-3xl" />
                            </div>

                            {/* --- STEP 1: CONNECT (Floating inputs) --- */}
                            <div className={`absolute top-1/4 left-10 transform-style-3d transition-all duration-700 ${activeStep === 0 ? 'opacity-100 translate-z-20' : 'opacity-40 translate-z-0 blur-sm'}`}>
                                <div className="relative">
                                    {/* Floating Device Icons */}
                                    <div className="absolute -top-12 -left-8 p-3 bg-white dark:bg-[#1a1a1a] rounded-2xl shadow-xl border border-brand-purple/20 animate-float-slow">
                                        <Smartphone className="text-brand-purple" size={24} />
                                    </div>
                                    <div className="absolute top-8 left-12 p-3 bg-white dark:bg-[#1a1a1a] rounded-2xl shadow-xl border border-brand-cyan/20 animate-float-delayed">
                                        <CreditCard className="text-brand-cyan" size={24} />
                                    </div>
                                    <div className="w-24 h-24 bg-gradient-to-br from-brand-purple to-brand-cyan rounded-2xl flex items-center justify-center shadow-lg shadow-brand-purple/20 relative z-10">
                                        <Database className="text-white" size={40} />
                                    </div>
                                    {/* Connection Lines */}
                                    <div className="absolute top-1/2 left-full w-24 h-1 bg-gradient-to-r from-brand-purple to-gray-200 dark:to-gray-800 transform origin-left animate-pulse" />
                                </div>
                                <div className="mt-8 text-center bg-white/80 dark:bg-dark-surface/80 backdrop-blur px-4 py-2 rounded-lg border border-white/10 shadow-lg">
                                    <span className="font-bold text-gray-900 dark:text-white">Unified API</span>
                                </div>
                            </div>

                            {/* --- STEP 2: AUTOMATE (Central Processing Engine) --- */}
                            <div className={`absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 transform-style-3d transition-all duration-700 ${activeStep === 1 ? 'scale-110 opacity-100' : 'scale-90 opacity-40 blur-sm'}`}>
                                {/* Spinning Rings */}
                                <div className="absolute inset-0 border-2 border-dashed border-gray-300 dark:border-gray-700 rounded-full animate-spin-slow w-[200px] h-[200px] -m-6" />
                                <div className="relative w-40 h-40 bg-gray-900 dark:bg-dark-surface rounded-full border border-gray-700 flex items-center justify-center shadow-2xl overflow-hidden">
                                    <div className="absolute inset-0 opacity-20 bg-gray-800" />
                                    {/* Code Scrolling Effect */}
                                    <div className="absolute inset-0 flex flex-col items-center justify-center opacity-30">
                                        {[1, 2, 3, 4, 5].map(i => (
                                            <div key={i} className="text-[8px] text-green-500 font-mono whitespace-nowrap animate-slide-up" style={{ animationDelay: `${i * 0.2}s` }}>
                                                {`if (log.time > shift.end) alert("Overtime");`}
                                            </div>
                                        ))}
                                    </div>
                                    <Zap className={`text-yellow-400 fill-current ${activeStep === 1 ? 'animate-pulse' : ''}`} size={48} />
                                </div>
                                {/* Spawning Output Cards */}
                                <div className="absolute -right-24 top-0 space-y-2">
                                    <div className={`flex items-center gap-2 p-2 bg-white dark:bg-[#1a1a1a] rounded-lg shadow-lg border border-green-500/30 transition-all duration-500 ${activeStep === 1 ? 'opacity-100 translate-x-0' : 'opacity-0 -translate-x-4'}`}>
                                        <CheckCircle2 size={14} className="text-green-500" />
                                        <span className="text-xs font-bold text-gray-700 dark:text-gray-300">Shift_Gen_OK</span>
                                    </div>
                                    <div className={`flex items-center gap-2 p-2 bg-white dark:bg-[#1a1a1a] rounded-lg shadow-lg border border-green-500/30 transition-all duration-500 delay-100 ${activeStep === 1 ? 'opacity-100 translate-x-0' : 'opacity-0 -translate-x-4'}`}>
                                        <CheckCircle2 size={14} className="text-green-500" />
                                        <span className="text-xs font-bold text-gray-700 dark:text-gray-300">Payroll_Calc_OK</span>
                                    </div>
                                </div>
                            </div>

                            {/* --- STEP 3: ANALYZE (Dashboard Outputs) --- */}
                            <div className={`absolute bottom-0 right-10 transform-style-3d transition-all duration-700 ${activeStep === 2 ? 'opacity-100 translate-z-20' : 'opacity-40 translate-z-0 blur-sm'}`}>
                                <div className="relative w-48 h-32 bg-white dark:bg-[#151515] rounded-xl border border-gray-200 dark:border-white/10 shadow-2xl flex flex-col p-3 overflow-hidden group-hover:rotate-y-12 transition-transform">
                                    <div className="flex justify-between items-center mb-2">
                                        <span className="text-[10px] font-bold text-gray-500 uppercase">Yield Report</span>
                                        <div className="flex gap-1">
                                            <div className="w-2 h-2 rounded-full bg-red-400" />
                                            <div className="w-2 h-2 rounded-full bg-yellow-400" />
                                            <div className="w-2 h-2 rounded-full bg-green-400" />
                                        </div>
                                    </div>
                                    <div className="flex-1 flex items-end justify-between gap-1 px-1">
                                        {[40, 70, 50, 90, 60, 80].map((h, i) => (
                                            <div key={i} className="w-full bg-brand-purple/80 rounded-t-sm transition-all duration-1000" style={{ height: activeStep === 2 ? `${h}%` : '10%' }} />
                                        ))}
                                    </div>
                                </div>
                                {/* Floating Stat Badge */}
                                <div className={`absolute -top-6 -right-6 bg-green-500 text-white px-3 py-1 rounded-full text-xs font-bold shadow-lg transition-all duration-500 delay-300 ${activeStep === 2 ? 'scale-100 opacity-100' : 'scale-50 opacity-0'}`}>
                                    +24% Efficiency
                                </div>
                            </div>

                        </div>
                    </div>

                    {/* Right Side: Narrative Steps */}
                    <div className="space-y-8">
                        {[
                            {
                                id: 0,
                                label: "1. Connect",
                                title: "Integrate Devices",
                                desc: "Integrate your existing biometric devices and payment gateways via our unified API. No hardware replacement needed.",
                                icon: Server
                            },
                            {
                                id: 1,
                                label: "2. Automate",
                                title: "Set Rulesets",
                                desc: "Auto-generate shifts, invoices, and payroll based on live data. Remove manual entry errors forever.",
                                icon: Zap
                            },
                            {
                                id: 2,
                                label: "3. Analyze",
                                title: "Real-time Metrics",
                                desc: "View real-time yield reports and operational efficiency metrics from the dashboard. Make decisions on facts, not fasts.",
                                icon: BarChart3
                            }
                        ].map((step, index) => (
                            <div
                                key={index}
                                onClick={() => setActiveStep(index)}
                                className={`group p-6 rounded-2xl border transition-all duration-300 cursor-pointer ${activeStep === index
                                    ? 'bg-white dark:bg-white/10 border-brand-purple shadow-xl scale-105'
                                    : 'bg-transparent border-transparent hover:bg-gray-100 dark:hover:bg-white/5'
                                    }`}
                            >
                                <div className="flex items-start gap-4">
                                    <div className={`p-3 rounded-xl transition-colors ${activeStep === index ? 'bg-brand-purple text-white' : 'bg-gray-200 dark:bg-white/10 text-gray-500'}`}>
                                        <step.icon size={24} />
                                    </div>
                                    <div>
                                        <h4 className={`text-sm font-bold uppercase tracking-wider mb-1 ${activeStep === index ? 'text-brand-purple' : 'text-gray-500'}`}>
                                            {step.label}
                                        </h4>
                                        <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">{step.title}</h3>
                                        <p className="text-gray-600 dark:text-gray-400 text-sm leading-relaxed">
                                            {step.desc}
                                        </p>
                                    </div>
                                </div>
                                {/* Progress Bar */}
                                {activeStep === index && (
                                    <div className="w-full h-1 bg-gray-200 dark:bg-gray-700 rounded-full mt-6 overflow-hidden">
                                        <div className="h-full bg-brand-purple animate-progress" />
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            <style>{`
                .perspective-1000 { perspective: 1000px; }
                .transform-style-3d { transform-style: preserve-3d; }
                .translate-z-20 { transform: translateZ(20px); }
                .translate-z-0 { transform: translateZ(0px); }
                @keyframes float-slow {
                    0%, 100% { transform: translateY(0px); }
                    50% { transform: translateY(-10px); }
                }
                .animate-float-slow { animation: float-slow 4s ease-in-out infinite; }
                .animate-float-delayed { animation: float-slow 4s ease-in-out infinite 2s; }
                
                @keyframes slide-up {
                    0% { transform: translateY(100%); opacity: 0; }
                    50% { opacity: 1; }
                    100% { transform: translateY(-100%); opacity: 0; }
                }
                .animate-slide-up { animation: slide-up 2s linear infinite; }
                
                @keyframes progress {
                    from { width: 0%; }
                    to { width: 100%; }
                }
                .animate-progress { animation: progress 5s linear; }
            `}</style>
        </div>
    );
};

export default WorkflowAnimation;
