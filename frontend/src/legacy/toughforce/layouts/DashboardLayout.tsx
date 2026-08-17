// @ts-nocheck
/**
 * Dashboard Layout Component
 * 
 * Main layout wrapper for authenticated dashboard views.
 * Handles context routing, displays context switcher, and manages modals.
 * 
 * Features:
 * - Automatic context-based routing
 * - Welcome modal for new services
 * - Context switcher in header
 * - Responsive navigation
 */

import React, { ReactNode } from 'react';
import { useRouter } from 'next/router';
import { Menu, X } from 'lucide-react';
import { ContextSwitcher } from '@/legacy/toughforce/components/ContextSwitcher';
import { ServiceWelcomeModal } from '@/legacy/toughforce/components/ServiceWelcomeModal';
import { useContextRouting } from '@/legacy/toughforce/hooks/useContextRouting';
import { useAuth } from '@/legacy/toughforce/hooks/useAuth';

interface DashboardLayoutProps {
  children: ReactNode;
  showSidebar?: boolean;
}

export function DashboardLayout({
  children,
  showSidebar = true,
}: DashboardLayoutProps) {
  const router = useRouter();
  const { user, logout } = useAuth();
  const { isLoading, activeContext, allContexts, switchContext } = useContextRouting();
  const [sidebarOpen, setSidebarOpen] = React.useState(false);

  // Show loading state while determining context
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center space-y-4">
          <div className="w-12 h-12 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin mx-auto" />
          <p className="text-gray-600">Loading your dashboard...</p>
        </div>
      </div>
    );
  }

  // No active context found
  if (!activeContext) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center space-y-4 max-w-md">
          <h1 className="text-2xl font-bold text-gray-900">Welcome</h1>
          <p className="text-gray-600">
            It looks like you don't have access to any services yet.
          </p>
          <button
            onClick={() => router.push('/services')}
            className="inline-block px-6 py-3 bg-indigo-600 text-white font-medium rounded-lg hover:bg-indigo-700"
          >
            Explore Services
          </button>
        </div>
      </div>
    );
  }

  const handleLogout = async () => {
    await logout();
    router.push('/login');
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            {/* Logo & Company Name */}
            <div className="flex items-center gap-3">
              <button
                onClick={() => setSidebarOpen(!sidebarOpen)}
                className="lg:hidden p-2 hover:bg-gray-100 rounded-lg"
              >
                {sidebarOpen ? <X size={20} /> : <Menu size={20} />}
              </button>
              <div className="flex items-center gap-2">
                <div className="w-10 h-10 bg-gradient-to-br from-indigo-600 to-indigo-700 rounded-lg flex items-center justify-center text-white font-bold">
                  O
                </div>
                <div>
                  <h1 className="font-bold text-gray-900">Hakika</h1>
                  <p className="text-xs text-gray-500">Hakika app</p>
                </div>
              </div>
            </div>

            {/* Center: Context Switcher */}
            <div className="hidden md:block flex-1 px-8">
              {activeContext && (
                <ContextSwitcher
                  currentContext={{
                    ...activeContext,
                    is_current: true,
                  }}
                  allContexts={allContexts.map((ctx) => ({
                    ...ctx,
                    is_current: ctx === activeContext,
                  }))}
                  onContextSwitch={switchContext}
                  onRentService={() => router.push('/services')}
                />
              )}
            </div>

            {/* Right: User Menu */}
            <div className="flex items-center gap-4">
              <div className="text-right hidden sm:block">
                <p className="text-sm font-medium text-gray-900">
                  {user?.user_metadata?.full_name || user?.email}
                </p>
                <p className="text-xs text-gray-500">
                  {activeContext.role}
                </p>
              </div>

              <button
                onClick={handleLogout}
                className="px-4 py-2 text-sm font-medium text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
              >
                Logout
              </button>
            </div>
          </div>
        </div>

        {/* Mobile Context Switcher */}
        <div className="md:hidden px-4 pb-4">
          {activeContext && (
            <ContextSwitcher
              currentContext={{
                ...activeContext,
                is_current: true,
              }}
              allContexts={allContexts.map((ctx) => ({
                ...ctx,
                is_current: ctx === activeContext,
              }))}
              onContextSwitch={switchContext}
              onRentService={() => router.push('/services')}
            />
          )}
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto">
        <div className="px-4 sm:px-6 lg:px-8 py-8">
          {children}
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-gray-200 bg-white mt-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <p className="text-sm text-gray-500 text-center">
            © 2026 Hakika app. All rights reserved.
          </p>
        </div>
      </footer>
    </div>
  );
}

/**
 * Simplified Layout for Services/Admin Pages
 */
export function SimpleLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 to-white">
      {children}
    </div>
  );
}
