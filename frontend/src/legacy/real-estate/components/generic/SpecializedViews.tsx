// @ts-nocheck
import React from 'react';
import { Building, Smartphone, Video } from 'lucide-react';

export const BranchGrid: React.FC = () => (
    <div className="space-y-6 animate-fade-in-up">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Select Active Branch</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[
                { name: 'Headquarters', loc: 'Nairobi CBD', staff: 120, status: 'Active' },
                { name: 'Mombasa Hub', loc: 'Nyali', staff: 45, status: 'Active' },
                { name: 'Western Region', loc: 'Kisumu', staff: 30, status: 'Active' },
                { name: 'Rift Valley Ops', loc: 'Nakuru', staff: 25, status: 'Active' },
                { name: 'Mt. Kenya Branch', loc: 'Nyeri', staff: 15, status: 'Maintenance' },
            ].map((branch, i) => (
                <div key={i} className="group bg-white dark:bg-dark-surface border border-gray-200 dark:border-white/10 p-6 rounded-2xl hover:border-brand-purple/50 hover:shadow-xl transition-all cursor-pointer relative overflow-hidden">
                    <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
                        <Building size={80} />
                    </div>
                    <div className="flex justify-between items-start mb-4">
                        <div className={`p-3 rounded-xl ${branch.status === 'Active' ? 'bg-brand-purple/10 text-brand-purple' : 'bg-gray-100 text-gray-400'}`}>
                            <Building size={24} />
                        </div>
                        <span className={`px-2 py-1 rounded text-xs font-bold ${branch.status === 'Active' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                            {branch.status}
                        </span>
                    </div>
                    <h3 className="text-xl font-bold text-gray-900 dark:text-white">{branch.name}</h3>
                    <p className="text-gray-500 text-sm mb-4">{branch.loc}</p>
                    <div className="flex items-center gap-2 text-sm text-gray-400">
                        <span className="font-bold text-gray-900 dark:text-white">{branch.staff}</span> Staff Members
                    </div>
                </div>
            ))}
        </div>
    </div>
);

export const MobileLinkView: React.FC = () => (
    <div className="flex flex-col items-center justify-center h-[70vh] text-center space-y-8 animate-fade-in-up">
        <div className="space-y-2">
            <h2 className="text-3xl font-bold text-white">GT Mobile App</h2>
            <p className="text-gray-400">Scan to download the Employee Self-Service App</p>
        </div>
        <div className="p-4 bg-white rounded-2xl shadow-2xl">
            <div className="w-64 h-64 bg-gray-900 flex items-center justify-center relative overflow-hidden">
                <div className="z-10 bg-white p-2 rounded-lg">
                    <Smartphone size={32} className="text-brand-purple" />
                </div>
            </div>
        </div>
        <div className="flex gap-4">
            <button 
                className="flex items-center gap-2 px-6 py-3 bg-[#1e1e1e] border border-white/10 rounded-xl hover:bg-white/10 transition"
                title="Download on the App Store"
                aria-label="Download on the App Store"
            >
                <div className="text-left">
                    <p className="text-[10px] text-gray-400 uppercase">Download on the</p>
                    <p className="text-sm font-bold text-white">App Store</p>
                </div>
            </button>
            <button 
                className="flex items-center gap-2 px-6 py-3 bg-[#1e1e1e] border border-white/10 rounded-xl hover:bg-white/10 transition"
                title="Get it on Google Play"
                aria-label="Get it on Google Play"
            >
                <div className="text-left">
                    <p className="text-[10px] text-gray-400 uppercase">Get it on</p>
                    <p className="text-sm font-bold text-white">Google Play</p>
                </div>
            </button>
        </div>
    </div>
);

export const AccessMatrix: React.FC = () => (
    <div className="space-y-6 animate-fade-in-up">
        <div className="flex justify-between items-center">
            <div>
                <h2 className="text-2xl font-bold text-white">Access Control Matrix</h2>
                <p className="text-gray-400 text-sm">Manage role-based permissions.</p>
            </div>
            <button 
                className="bg-brand-purple text-white px-4 py-2 rounded-lg text-sm font-medium"
                title="Add New Role"
                aria-label="Add New Role"
            >
                Add New Role
            </button>
        </div>
        <div className="bg-dark-surface border border-white/10 rounded-xl overflow-hidden">
            <table className="w-full text-sm">
                <thead className="bg-white/5 text-gray-400">
                    <tr>
                        <th className="px-6 py-4 text-left">Module / Page</th>
                        <th className="px-6 py-4 text-center">Super Admin</th>
                        <th className="px-6 py-4 text-center">HR Manager</th>
                        <th className="px-6 py-4 text-center">Security Lead</th>
                        <th className="px-6 py-4 text-center">Staff</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-white/5 text-gray-300">
                    {['Dashboard', 'Security', 'Data Workspaces', 'Payroll Workspace', 'Leave Workspace', 'Time Workspace', 'Admin Reports'].map((page, i) => {
                        const roles = ['Super Admin', 'HR Manager', 'Security Lead', 'Staff'];
                        return (
                            <tr key={i} className="hover:bg-white/5">
                                <td className="px-6 py-4 font-medium">{page}</td>
                                {[1, 2, 3, 4].map((col) => (
                                    <td key={col} className="px-6 py-4 text-center">
                                        <input 
                                            type="checkbox" 
                                            defaultChecked={col === 1 || (col === 2 && i < 3) || (col === 3 && i === 3)} 
                                            className="rounded accent-brand-purple h-4 w-4"
                                            title={`Toggle ${roles[col-1]} access for ${page}`}
                                            aria-label={`Toggle ${roles[col-1]} access for ${page}`}
                                        />
                                    </td>
                                ))}
                            </tr>
                        );
                    })}
                </tbody>
            </table>
        </div>
    </div>
);

export const SurveillanceGrid: React.FC = () => {
    const CAMS = [
        { id: 1, name: 'Main Gate (Ext)', src: 'https://images.unsplash.com/photo-1557597774-9d2739f85a94?auto=format&fit=crop&q=80&w=800' },
        { id: 2, name: 'Lobby West', src: 'https://images.unsplash.com/photo-1497366216548-37526070297c?auto=format&fit=crop&q=80&w=800' },
        { id: 3, name: 'Basement Parking', src: 'https://images.unsplash.com/photo-1590674852885-7c602052c057?auto=format&fit=crop&q=80&w=800' },
    ];

    return (
        <div className="space-y-6 animate-fade-in-up">
            <div className="flex justify-between items-center">
                <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Live Surveillance Feed</h2>
                <div className="flex gap-2">
                    <span className="flex items-center gap-1 text-red-500 text-xs font-bold uppercase animate-pulse">
                        <div className="w-2 h-2 bg-red-500 rounded-full"></div> Recording
                    </span>
                </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {CAMS.map((cam) => (
                    <div key={cam.id} className="aspect-video bg-black rounded-xl border border-gray-800 relative group overflow-hidden shadow-lg">
                        <div className="absolute top-3 left-3 bg-black/60 backdrop-blur-sm text-white text-[10px] px-2 py-0.5 rounded flex items-center gap-2 z-10">
                            <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse"></span>
                            CAM-0{cam.id} : {cam.name}
                        </div>
                        <img
                            src={cam.src}
                            alt={cam.name}
                            className="w-full h-full object-cover opacity-80 group-hover:opacity-100 transition-opacity duration-300"
                        />
                        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-white/5 to-transparent h-8 animate-scan-line pointer-events-none"></div>
                        <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                            <div className="bg-white/10 backdrop-blur rounded-full p-3 border border-white/20">
                                <Video size={32} className="text-white" />
                            </div>
                        </div>
                    </div>
                ))}
            </div>
            <style>{`
                @keyframes scan-line {
                    0% { transform: translateY(-100%); }
                    100% { transform: translateY(400%); }
                }
                .animate-scan-line {
                    animation: scan-line 4s linear infinite;
                }
            `}</style>
        </div>
    );
};
