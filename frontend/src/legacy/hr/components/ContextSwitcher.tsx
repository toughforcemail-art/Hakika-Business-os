// @ts-nocheck
/**
 * Context Switcher Component
 * 
 * Inspired by Slack's workspace switcher and Notion's team switcher.
 * Allows users to switch between multiple contexts (Parent Company, Services, etc.)
 * 
 * Design patterns from:
 * - Slack: Clean, focused workspace switcher with avatar + dropdown
 * - Notion: Organized list with visual hierarchy and quick actions
 * - Linear: Smooth transitions and service discovery
 */

import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown, Plus, LogOut, Settings, ArrowLeft } from 'lucide-react';
import { useAuth } from '@/legacy/hr/hooks/useAuth';
import { useRouter } from 'next/router';

interface Context {
  type: 'staff' | 'service_admin' | 'landlord' | 'tenant';
  service_key?: string;
  company_code: string;
  company_name: string;
  role: string;
  is_current: boolean;
  is_new?: boolean;
}

interface ContextSwitcherProps {
  currentContext: Context;
  allContexts: Context[];
  onContextSwitch: (context: Context) => Promise<void>;
  onRentService?: () => void;
}

const SERVICE_COLORS: Record<string, string> = {
  hr: 'bg-blue-100 text-blue-700',
  hakika: 'bg-purple-100 text-purple-700',
  tough_force: 'bg-red-100 text-red-700',
  rock_of_ages: 'bg-green-100 text-green-700',
};

const SERVICE_ICONS: Record<string, string> = {
  hr: '👥',
  hakika: '🏢',
  tough_force: '🔒',
  rock_of_ages: '⛪',
};

export function ContextSwitcher({
  currentContext,
  allContexts,
  onContextSwitch,
  onRentService,
}: ContextSwitcherProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleContextSwitch = async (context: Context) => {
    if (context.is_current) {
      setIsOpen(false);
      return;
    }

    setIsLoading(true);
    try {
      await onContextSwitch(context);
      setIsOpen(false);
    } catch (error) {
      console.error('Failed to switch context:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const getContextLabel = (ctx: Context) => {
    switch (ctx.type) {
      case 'service_admin':
        return `${ctx.service_key?.toUpperCase()} Admin`;
      case 'staff':
        return `${ctx.company_name}`;
      case 'landlord':
        return `${ctx.company_name} (Landlord)`;
      case 'tenant':
        return `${ctx.company_name} (Tenant)`;
      default:
        return ctx.company_name;
    }
  };

  const getContextIcon = (ctx: Context) => {
    if (ctx.type === 'service_admin' && ctx.service_key) {
      return SERVICE_ICONS[ctx.service_key] || '📱';
    }
    switch (ctx.type) {
      case 'staff':
        return '🏢';
      case 'landlord':
        return '🏠';
      case 'tenant':
        return '🚪';
      default:
        return '📱';
    }
  };

  const getContextColor = (ctx: Context) => {
    if (ctx.type === 'service_admin' && ctx.service_key) {
      return SERVICE_COLORS[ctx.service_key] || 'bg-gray-100 text-gray-700';
    }
    switch (ctx.type) {
      case 'staff':
        return 'bg-indigo-100 text-indigo-700';
      case 'landlord':
        return 'bg-orange-100 text-orange-700';
      case 'tenant':
        return 'bg-cyan-100 text-cyan-700';
      default:
        return 'bg-gray-100 text-gray-700';
    }
  };

  // Group contexts by type for better organization (like Notion)
  const serviceContexts = allContexts.filter(c => c.type === 'service_admin');
  const otherContexts = allContexts.filter(c => c.type !== 'service_admin');
  const isInServiceContext = currentContext.type === 'service_admin';

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Trigger Button - Minimalist design inspired by Slack */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-gray-100 transition-colors"
        aria-label="Switch context"
        aria-expanded={isOpen}
      >
        <div
          className={`w-8 h-8 rounded-md flex items-center justify-center font-semibold text-sm ${getContextColor(
            currentContext
          )}`}
        >
          {getContextIcon(currentContext)}
        </div>
        <div className="flex flex-col items-start">
          <span className="text-sm font-medium text-gray-900">
            {getContextLabel(currentContext)}
          </span>
          {currentContext.is_new && (
            <span className="text-xs text-green-600 font-semibold">New!</span>
          )}
        </div>
        <ChevronDown
          size={16}
          className={`text-gray-400 transition-transform ${isOpen ? 'rotate-180' : ''}`}
        />
      </button>

      {/* Dropdown Menu - Multi-section layout inspired by Linear */}
      {isOpen && (
        <div className="absolute top-full left-0 mt-2 w-80 bg-white rounded-xl shadow-lg border border-gray-200 z-50 overflow-hidden">
          {/* Header */}
          <div className="px-4 py-3 border-b border-gray-100 bg-gray-50">
            <h3 className="text-xs font-semibold text-gray-600 uppercase tracking-wide">
              {serviceContexts.length > 0 ? 'Switch Context' : 'Your Workspaces'}
            </h3>
          </div>

          {/* Scrollable Content */}
          <div className="max-h-96 overflow-y-auto">
            {/* Service Admin Contexts (if any) */}
            {serviceContexts.length > 0 && (
              <div className="border-b border-gray-100">
                <div className="px-4 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wide">
                  Rented Services
                </div>
                {serviceContexts.map((ctx) => (
                  <ContextItem
                    key={`${ctx.type}-${ctx.service_key}`}
                    context={ctx}
                    isLoading={isLoading}
                    onSwitch={handleContextSwitch}
                    getLabel={getContextLabel}
                    getIcon={getContextIcon}
                    getColor={getContextColor}
                  />
                ))}
              </div>
            )}

            {/* Other Contexts */}
            {otherContexts.length > 0 && (
              <div className={serviceContexts.length > 0 ? '' : ''}>
                {serviceContexts.length > 0 && (
                  <div className="px-4 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wide">
                    Other Roles
                  </div>
                )}
                {otherContexts.map((ctx) => (
                  <ContextItem
                    key={`${ctx.type}-${ctx.company_code}`}
                    context={ctx}
                    isLoading={isLoading}
                    onSwitch={handleContextSwitch}
                    getLabel={getContextLabel}
                    getIcon={getContextIcon}
                    getColor={getContextColor}
                  />
                ))}
              </div>
            )}

            {/* Back to Parent Button (if in service context) */}
            {isInServiceContext && otherContexts.some(c => c.type === 'staff') && (
              <>
                <div className="border-t border-gray-100" />
                <button
                  onClick={() =>
                    handleContextSwitch(
                      otherContexts.find(c => c.type === 'staff')!
                    )
                  }
                  disabled={isLoading}
                  className="w-full px-4 py-3 text-sm font-medium text-gray-600 hover:bg-gray-50 flex items-center gap-2 transition-colors disabled:opacity-50"
                >
                  <ArrowLeft size={16} />
                  Back to Parent Company
                </button>
              </>
            )}
          </div>

          {/* Footer with Actions */}
          <div className="border-t border-gray-100 bg-gray-50 px-4 py-3 space-y-2">
            {onRentService && (
              <button
                onClick={onRentService}
                className="w-full flex items-center gap-2 px-3 py-2 text-sm font-medium text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
              >
                <Plus size={16} />
                Rent New Service
              </button>
            )}
            <button className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg transition-colors">
              <Settings size={16} />
              Settings
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * Individual Context Item Component
 * Reusable list item for each context option
 */
interface ContextItemProps {
  context: Context;
  isLoading: boolean;
  onSwitch: (context: Context) => void;
  getLabel: (ctx: Context) => string;
  getIcon: (ctx: Context) => string;
  getColor: (ctx: Context) => string;
}

function ContextItem({
  context,
  isLoading,
  onSwitch,
  getLabel,
  getIcon,
  getColor,
}: ContextItemProps) {
  return (
    <button
      onClick={() => onSwitch(context)}
      disabled={isLoading || context.is_current}
      className={`w-full px-4 py-3 flex items-center gap-3 hover:bg-gray-50 transition-colors ${
        context.is_current ? 'bg-indigo-50' : ''
      } disabled:opacity-50`}
    >
      {/* Icon */}
      <div
        className={`w-10 h-10 rounded-lg flex items-center justify-center font-semibold flex-shrink-0 ${getColor(
          context
        )}`}
      >
        {getIcon(context)}
      </div>

      {/* Label and Status */}
      <div className="flex-1 text-left min-w-0">
        <div className="text-sm font-medium text-gray-900 truncate">
          {getLabel(context)}
        </div>
        {context.is_new && (
          <div className="text-xs text-green-600 font-semibold">New service</div>
        )}
      </div>

      {/* Current Indicator */}
      {context.is_current && (
        <div className="text-xs font-semibold text-indigo-600">Current</div>
      )}
    </button>
  );
}
