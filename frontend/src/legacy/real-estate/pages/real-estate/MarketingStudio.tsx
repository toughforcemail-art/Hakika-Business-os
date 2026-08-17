// @ts-nocheck
import React, { useState } from 'react';
import { Megaphone, Plus, Search, Filter } from 'lucide-react';
import RealEstateFormModal from '../../components/real-estate/RealEstateFormModal';
import FilterPanel from '../../components/real-estate/FilterPanel';

export default function MarketingStudio() {
  const [showModal, setShowModal] = useState(false);
  const [showFilters, setShowFilters] = useState(false);

  return (
    <div className="flex-1 overflow-y-auto bg-gray-50 dark:bg-gray-900">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8 flex flex-col md:flex-row md:items-center md:justify-between">
          <div>
            <div className="flex items-center mb-2">
              <div className="p-2 bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 rounded-lg mr-3"><Megaphone size={24} /></div>
              <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Marketing Studio</h1>
            </div>
            <p className="text-gray-500 dark:text-gray-400 mt-1">Create property listings, promotions, and marketing campaigns.</p>
          </div>
          <div className="mt-4 md:mt-0 flex space-x-3">
            <button onClick={() => setShowFilters(true)} title="Show advanced marketing campaign filters" className="px-4 py-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-gray-700 dark:text-gray-300 font-medium hover:bg-gray-50 transition-colors shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 flex items-center cursor-pointer">
              <Filter size={18} className="mr-2" />Filters
            </button>
            <button onClick={() => setShowModal(true)} title="Add a new marketing campaign or entry" className="px-4 py-2 bg-indigo-600 text-white rounded-lg font-medium hover:bg-indigo-700 transition-colors shadow-sm flex items-center focus:outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer">
              <Plus size={18} className="mr-2" />Add New
            </button>
          </div>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-750 p-4 mb-6 mt-6">
          <div className="relative w-full max-w-md">
            <label htmlFor="campaign-search" className="sr-only">Search marketing campaigns</label>
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none"><Search className="h-5 w-5 text-gray-400" /></div>
            <input id="campaign-search" type="text" className="block w-full pl-10 pr-3 py-2 border border-gray-200 dark:border-gray-700 rounded-lg bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-gray-100 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 sm:text-sm transition-colors" placeholder="Search campaigns..." title="Search for marketing campaigns by name or description" />
          </div>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-750 p-12 flex flex-col items-center justify-center min-h-[400px]">
          <div className="w-20 h-20 bg-gray-50 dark:bg-gray-900 rounded-full flex items-center justify-center mb-6 shadow-inner border border-gray-100 dark:border-gray-800"><Megaphone size={32} className="text-gray-400" /></div>
          <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">No data available</h3>
          <p className="text-gray-500 dark:text-gray-400 max-w-sm text-center mb-8">Get started by adding your first record.</p>
          <button onClick={() => setShowModal(true)} title="Add your first marketing campaign entry" className="px-5 py-2.5 bg-indigo-600 text-white rounded-lg font-medium hover:bg-indigo-700 transition-colors shadow-sm flex items-center cursor-pointer">
            <Plus size={18} className="mr-2" />Create First Entry
          </button>
        </div>
      </div>
      <RealEstateFormModal isOpen={showModal} onClose={() => setShowModal(false)} entityType="Campaign" />
      <FilterPanel isOpen={showFilters} onClose={() => setShowFilters(false)} entityType="Campaign" />
    </div>
  );
}