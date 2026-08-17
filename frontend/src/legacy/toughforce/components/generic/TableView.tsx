// @ts-nocheck
import React from 'react';
import { Filter, Search, Plus, FileText, MoreHorizontal } from 'lucide-react';

interface TableViewProps {
    title: string;
    columns: string[];
    data: any[];
    path: string;
    actionLabel?: string;
    onAction?: () => void;
}

const TableView: React.FC<TableViewProps> = ({ title, columns, data, path, actionLabel, onAction }) => (
    <div className="space-y-6 animate-fade-in-up">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div>
                <h2 className="text-2xl font-bold text-gray-900 dark:text-white">{title}</h2>
                <p className="text-gray-500 dark:text-gray-400 text-sm mt-1">Manage {title.toLowerCase()} records.</p>
            </div>
            <div className="flex gap-3">
                <button 
                    className="p-2 border border-gray-200 dark:border-white/10 rounded-lg hover:bg-gray-50 dark:hover:bg-white/5 text-gray-500"
                    title="Filter Results"
                    aria-label="Filter Results"
                >
                    <Filter size={18} aria-hidden="true" />
                </button>
                <div className="relative">
                    <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                    <input
                        type="text"
                        placeholder="Search..."
                        className="pl-9 pr-4 py-2 bg-white dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-lg text-sm outline-none focus:border-brand-purple w-full md:w-64"
                    />
                </div>
                {actionLabel && (
                    <button 
                        onClick={onAction} 
                        className="bg-brand-purple text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-brand-pink transition shadow-lg shadow-brand-purple/20 flex items-center gap-2"
                        title={actionLabel}
                        aria-label={actionLabel}
                    >
                        <Plus size={16} aria-hidden="true" /> {actionLabel}
                    </button>
                )}
            </div>
        </div>

        <div className="bg-white dark:bg-dark-surface border border-gray-200 dark:border-white/10 rounded-xl overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
                <table className="w-full text-sm text-left">
                    <thead className="bg-gray-50 dark:bg-white/5 text-gray-500 dark:text-gray-400 font-medium border-b border-gray-200 dark:border-white/10">
                        <tr>
                            {columns.map((col, i) => (
                                <th key={i} className="px-6 py-4">{col}</th>
                            ))}
                            <th className="px-6 py-4 text-right">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 dark:divide-white/5">
                        {data.length > 0 ? data.map((row, i) => (
                            <tr key={i} className="hover:bg-gray-50 dark:hover:bg-white/5 transition-colors">
                                {columns.map((col, j) => (
                                    <td key={j} className="px-6 py-4 text-gray-700 dark:text-gray-300">
                                        {col.includes('Status') ? (
                                            <span className={`px-2 py-1 rounded-full text-xs font-medium ${row[col] === 'Active' || row[col] === 'Paid' || row[col] === 'Completed' || row[col] === 'Signed' || row[col] === 'Approved' ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' :
                                                row[col] === 'Pending' || row[col] === 'Draft' || row[col] === 'In Progress' ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400' :
                                                    'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                                                }`}>
                                                {row[col]}
                                            </span>
                                        ) : row[col]}
                                    </td>
                                ))}
                                <td className="px-6 py-4 text-right">
                                    <div className="flex items-center justify-end gap-2">
                                        {(path.includes('expense') || path.includes('report') || path.includes('invoice') || path.includes('payroll')) && (
                                            <button
                                                onClick={() => {
                                                    const control = `KRA-${Math.random().toString(36).substring(2, 9).toUpperCase()}`;
                                                    window.open(`/verify-invoice?id=${control}`, '_blank');
                                                }}
                                                className="p-1.5 text-pink-500 hover:bg-pink-500/10 rounded-lg transition-colors"
                                                title="Verify with eTIMS"
                                            >
                                                <FileText size={16} aria-hidden="true" />
                                            </button>
                                        )}
                                        <button 
                                            className="text-gray-400 hover:text-brand-purple transition-colors"
                                            title="More Actions"
                                            aria-label="More Actions"
                                        >
                                            <MoreHorizontal size={18} aria-hidden="true" />
                                        </button>
                                    </div>
                                </td>
                            </tr>
                        )) : (
                            <tr>
                                <td colSpan={columns.length + 1} className="px-6 py-12 text-center text-gray-500">
                                    No records found.
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>
            <div className="px-6 py-4 border-t border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-white/5 flex justify-between items-center text-xs text-gray-500">
                <span>Showing 1 to {data.length} of {data.length} entries</span>
                <div className="flex gap-2">
                    <button 
                        className="px-3 py-1 border border-gray-200 dark:border-white/10 rounded hover:bg-white dark:hover:bg-white/10"
                        title="Previous Page"
                        aria-label="Previous Page"
                    >
                        Previous
                    </button>
                    <button 
                        className="px-3 py-1 border border-gray-200 dark:border-white/10 rounded hover:bg-white dark:hover:bg-white/10"
                        title="Next Page"
                        aria-label="Next Page"
                    >
                        Next
                    </button>
                </div>
            </div>
        </div>
    </div>
);

export default TableView;
