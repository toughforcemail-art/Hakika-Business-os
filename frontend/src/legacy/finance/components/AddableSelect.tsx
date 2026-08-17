// @ts-nocheck
import React, { useState, useEffect } from 'react';
import { Plus, Check, X, Loader2 } from 'lucide-react';
import { supabase } from '../utils/supabase';

interface AddableSelectProps {
  label?: string;
  tableName?: string;
  options?: string[];
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  required?: boolean;
  allowCustomOption?: boolean;
}

const AddableSelect: React.FC<AddableSelectProps> = ({
  label,
  tableName,
  options: staticOptions,
  value,
  onChange,
  placeholder = "Select option",
  className = "",
  required = false,
  allowCustomOption = false
}) => {
  const [options, setOptions] = useState<{ id: string; name: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAdding, setIsAdding] = useState(false);
  const [newItemName, setNewItemName] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (tableName) {
      fetchOptions();
    } else if (staticOptions) {
      const mergedStaticOptions = value && !staticOptions.includes(value)
        ? [...staticOptions, value]
        : staticOptions;
      setOptions(mergedStaticOptions.map(opt => ({ id: opt, name: opt })));
      setLoading(false);
    }
  }, [tableName, staticOptions, value]);

  const fetchOptions = async () => {
    if (!tableName) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from(tableName as any)
        .select('id, name')
        .order('name');
      
      if (error) throw error;
      setOptions(data || []);
    } catch (error) {
      console.error(`Error fetching from ${tableName}:`, error);
    } finally {
      setLoading(false);
    }
  };

  const handleAdd = async () => {
    if (!newItemName.trim()) return;
    const normalizedName = newItemName.trim();
    setIsSaving(true);
    try {
      if (!tableName) {
        setOptions(prev => {
          if (prev.some(option => option.name.toLowerCase() === normalizedName.toLowerCase())) {
            return prev;
          }

          return [...prev, { id: normalizedName, name: normalizedName }].sort((a, b) =>
            a.name.localeCompare(b.name)
          );
        });
        onChange(normalizedName);
        setNewItemName('');
        setIsAdding(false);
        return;
      }

      const { data, error } = await supabase
        .from(tableName as any)
        .insert([{ name: normalizedName }])
        .select()
        .single();

      if (error) throw error;

      // Update local options and select the new one
      setOptions(prev => [...prev, data].sort((a, b) => a.name.localeCompare(b.name)));
      onChange(data.name);
      setNewItemName('');
      setIsAdding(false);
    } catch (error) {
      console.error(`Error adding to ${tableName}:`, error);
      alert('Failed to add new option. It might already exist.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className={`space-y-1 ${className}`}>
      {label && <label className="text-xs font-bold text-gray-400 uppercase tracking-widest">{label}</label>}
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          {isAdding ? (
            <div className="flex items-center gap-1 bg-white dark:bg-dark-surface border border-brand-purple rounded-xl px-3 py-2">
              <input
                type="text"
                autoFocus
                placeholder="New option name..."
                className="bg-transparent border-none outline-none text-sm w-full text-gray-900 dark:text-white"
                value={newItemName}
                onChange={(e) => setNewItemName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') { e.preventDefault(); handleAdd(); }
                  if (e.key === 'Escape') setIsAdding(false);
                }}
              />
              <button 
                type="button" 
                onClick={handleAdd} 
                className="text-emerald-500 hover:scale-110 transition-transform"
                disabled={isSaving}
              >
                {isSaving ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />}
              </button>
              <button 
                type="button" 
                onClick={() => setIsAdding(false)} 
                className="text-rose-500 hover:scale-110 transition-transform"
                title="Cancel"
              >
                <X size={16} />
              </button>
            </div>
          ) : (
            <select
              required={required}
              className="w-full bg-gray-50 dark:bg-dark-surface border border-gray-200 dark:border-dark-border rounded-xl px-3 py-2.5 text-sm focus:ring-2 focus:ring-brand-purple outline-none appearance-none text-gray-900 dark:text-white"
              value={value}
              onChange={(e) => onChange(e.target.value)}
              disabled={loading}
              title={label || placeholder}
            >
              <option value="">{loading ? 'Loading...' : placeholder}</option>
              {options.map((opt) => (
                <option key={opt.id} value={opt.name}>{opt.name}</option>
              ))}
            </select>
          )}
        </div>
        {!isAdding && (tableName || allowCustomOption) && (
          <button
            type="button"
            onClick={() => setIsAdding(true)}
            className="p-2.5 bg-brand-purple/10 text-brand-purple rounded-xl hover:bg-brand-purple hover:text-white transition-all shadow-sm border border-brand-purple/20"
            title={`Add new ${label || 'option'}`}
          >
            <Plus size={16} />
          </button>
        )}
      </div>
    </div>
  );
};

export default AddableSelect;
