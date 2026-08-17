// @ts-nocheck
import React from 'react';
import { Printer, Share2, Download } from 'lucide-react';
import { printWorkspacePage } from '../../utils/printHelpers';

interface DocumentViewProps {
    title: string;
}

const DocumentView: React.FC<DocumentViewProps> = ({ title }) => (
    <div className="space-y-6 animate-fade-in-up h-[calc(100vh-140px)] flex flex-col">
        <div className="flex justify-between items-center">
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white">{title}</h2>
            <div className="flex gap-2">
                <button 
                    className="p-2 text-gray-500 hover:text-brand-purple border border-gray-200 dark:border-white/10 rounded-lg"
                    title="Print Document"
                    aria-label="Print Document"
                    onClick={() => printWorkspacePage({ title })}
                >
                    <Printer size={18} aria-hidden="true" />
                </button>
                <button 
                    className="p-2 text-gray-500 hover:text-brand-purple border border-gray-200 dark:border-white/10 rounded-lg"
                    title="Share Document"
                    aria-label="Share Document"
                >
                    <Share2 size={18} aria-hidden="true" />
                </button>
                <button 
                    className="p-2 text-gray-500 hover:text-brand-purple border border-gray-200 dark:border-white/10 rounded-lg"
                    title="Download Document"
                    aria-label="Download Document"
                >
                    <Download size={18} aria-hidden="true" />
                </button>
            </div>
        </div>
        <div className="flex-1 bg-white dark:bg-dark-surface border border-gray-200 dark:border-white/10 rounded-xl p-8 overflow-y-auto shadow-sm">
            <div className="max-w-3xl mx-auto prose dark:prose-invert">
                <h1>Staff Operational Manual (v2026.1)</h1>
                <p className="lead">Comprehensive guidelines for HR, Security, and Facility operations within the HAKIKA ecosystem.</p>

                <h3>1. Core Values</h3>
                <p>Integrity, Vigilance, and Automation. All staff are expected to utilize the "One Piece" system for all official logs.</p>

                <h3>2. Biometric Protocols</h3>
                <p>All shifts must begin with a biometric face scan. Lateness {">"} 15 mins triggers an automatic deduction flag.</p>

                <h3>3. Security SOPs</h3>
                <p>Patrol chips must be scanned every 45 minutes. Missed scans trigger a Level 2 Alert at the Command Center.</p>

                <div className="p-4 bg-yellow-50 dark:bg-yellow-900/10 border-l-4 border-yellow-500 my-6">
                    <strong>Note:</strong> This document is confidential. Do not distribute outside the organization.
                </div>

                <p>{Array(10).fill("Section content for demonstration purposes. ").join("")}</p>
            </div>
        </div>
    </div>
);

export default DocumentView;
