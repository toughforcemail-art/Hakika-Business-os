// @ts-nocheck
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Check, ChevronDown, Search } from 'lucide-react';
import { KENYA_COUNTY_OPTIONS } from '../../constants/locationOptions';

interface CountyPickerProps {
  value: string;
  onChange: (value: string) => void;
  label?: string;
  placeholder?: string;
  title?: string;
  required?: boolean;
  className?: string;
  showLabel?: boolean;
}

const CountyPicker: React.FC<CountyPickerProps> = ({
  value,
  onChange,
  label = 'County',
  placeholder = 'Select county',
  title,
  required,
  className = '',
  showLabel = true,
}) => {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState(value);
  const wrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setQuery(value);
  }, [value]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const filteredCounties = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return KENYA_COUNTY_OPTIONS;
    return KENYA_COUNTY_OPTIONS.filter((county) => county.toLowerCase().includes(needle));
  }, [query]);

  const selectCounty = (county: string) => {
    onChange(county);
    setQuery(county);
    setOpen(false);
  };

  return (
    <div ref={wrapperRef} className={className}>
      {showLabel && <label className="text-xs font-bold text-gray-400 uppercase">{label}</label>}
      <div className="relative mt-1">
        <button
          type="button"
          title={title || label}
          aria-required={required}
          onClick={() => setOpen((prev) => !prev)}
          className="w-full flex items-center justify-between gap-3 bg-gray-50 dark:bg-dark-bg border border-gray-200 dark:border-dark-border rounded-xl p-3 text-sm text-left focus:ring-2 focus:ring-brand-purple outline-none"
        >
          <span className={value ? 'text-gray-900 dark:text-white' : 'text-gray-400'}>
            {value || placeholder}
          </span>
          <ChevronDown size={16} className="shrink-0 text-gray-400" />
        </button>

        {open && (
          <div className="absolute z-20 mt-2 w-full rounded-2xl border border-gray-200 dark:border-dark-border bg-white dark:bg-dark-surface shadow-2xl overflow-hidden">
            <div className="p-3 border-b border-gray-100 dark:border-white/5">
              <div className="relative">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  autoFocus
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search counties..."
                  className="w-full rounded-xl border border-gray-200 dark:border-dark-border bg-white dark:bg-dark-bg pl-9 pr-3 py-2 text-sm outline-none focus:ring-2 focus:ring-brand-purple"
                />
              </div>
            </div>

            <div className="max-h-64 overflow-y-auto p-2">
              <button
                type="button"
                onClick={() => selectCounty('')}
                className="w-full flex items-center justify-between rounded-xl px-3 py-2 text-left text-sm text-gray-500 hover:bg-gray-50 dark:hover:bg-white/5"
              >
                <span>Clear selection</span>
                {!value ? <Check size={14} className="text-brand-purple" /> : null}
              </button>

              {filteredCounties.length > 0 ? (
                filteredCounties.map((county) => (
                  <button
                    key={county}
                    type="button"
                    onClick={() => selectCounty(county)}
                    className="w-full flex items-center justify-between rounded-xl px-3 py-2 text-left text-sm text-gray-700 dark:text-gray-200 hover:bg-brand-purple/5 dark:hover:bg-white/5"
                  >
                    <span>{county}</span>
                    {value === county ? <Check size={14} className="text-brand-purple" /> : null}
                  </button>
                ))
              ) : (
                <div className="px-3 py-4 text-sm text-gray-400">No counties match your search.</div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default CountyPicker;
