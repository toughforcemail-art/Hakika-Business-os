// @ts-nocheck
/**
 * Service Welcome Modal Component
 * 
 * Shows when user first accesses a newly rented service.
 * Inspired by:
 * - Slack's first-run experience (celebratory, brief)
 * - Linear's welcome flow (action-oriented)
 * - Notion's onboarding (minimalist, helpful)
 * 
 * Design principles:
 * - One clear CTA (Call To Action)
 * - Celebration emoji to mark achievement
 * - Clear value proposition
 * - Escape hatch for users who want to explore later
 */

import React, { useState } from 'react';
import { X, ArrowRight } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface ServiceWelcomeModalProps {
  serviceName: string;
  serviceKey: string;
  serviceIcon: string;
  description: string;
  onNavigate: () => void;
  onDismiss: () => void;
  features: string[];
}

const SERVICE_DETAILS: Record<string, {
  emoji: string;
  color: string;
  accentColor: string;
  gradient: string;
}> = {
  hr: {
    emoji: '👥',
    color: 'text-blue-600',
    accentColor: 'bg-blue-500',
    gradient: 'from-blue-400 to-blue-600',
  },
  hakika: {
    emoji: '🏢',
    color: 'text-purple-600',
    accentColor: 'bg-purple-500',
    gradient: 'from-purple-400 to-purple-600',
  },
  tough_force: {
    emoji: '🔒',
    color: 'text-red-600',
    accentColor: 'bg-red-500',
    gradient: 'from-red-400 to-red-600',
  },
  rock_of_ages: {
    emoji: '⛪',
    color: 'text-green-600',
    accentColor: 'bg-green-500',
    gradient: 'from-green-400 to-green-600',
  },
};

export function ServiceWelcomeModal({
  serviceName,
  serviceKey,
  serviceIcon,
  description,
  onNavigate,
  onDismiss,
  features,
}: ServiceWelcomeModalProps) {
  const [isNavigating, setIsNavigating] = useState(false);
  const details = SERVICE_DETAILS[serviceKey] || SERVICE_DETAILS.hakika;

  const handleNavigate = async () => {
    setIsNavigating(true);
    await new Promise(resolve => setTimeout(resolve, 300)); // Brief animation
    onNavigate();
  };

  return (
    <AnimatePresence>
      {/* Backdrop */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onDismiss}
        className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
      >
        {/* Modal Container */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          transition={{ type: 'spring', duration: 0.4 }}
          onClick={(e) => e.stopPropagation()}
          className="bg-white rounded-2xl shadow-2xl max-w-md w-full mx-4 overflow-hidden"
        >
          {/* Header with Gradient */}
          <div
            className={`bg-gradient-to-br ${details.gradient} relative h-32 flex items-end justify-between px-6 py-6`}
          >
            {/* Large Emoji */}
            <motion.div
              initial={{ opacity: 0, scale: 0.5 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ type: 'spring', delay: 0.1 }}
              className="text-6xl"
            >
              {serviceIcon}
            </motion.div>

            {/* Close Button */}
            <button
              onClick={onDismiss}
              className="text-white/80 hover:text-white transition-colors"
              aria-label="Close"
            >
              <X size={24} />
            </button>
          </div>

          {/* Content */}
          <div className="px-6 py-8 space-y-6">
            {/* Headline */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.15 }}
              className="space-y-2"
            >
              <h2 className="text-2xl font-bold text-gray-900">
                {serviceName} is Ready! 🎉
              </h2>
              <p className="text-gray-600 text-sm leading-relaxed">
                {description}
              </p>
            </motion.div>

            {/* Features List (Optional) */}
            {features && features.length > 0 && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
                className="space-y-2"
              >
                <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                  Key Features
                </div>
                <ul className="space-y-2">
                  {features.slice(0, 3).map((feature, idx) => (
                    <li
                      key={idx}
                      className="flex items-start gap-2 text-sm text-gray-700"
                    >
                      <span className={`text-lg ${details.color} flex-shrink-0`}>
                        ✓
                      </span>
                      <span>{feature}</span>
                    </li>
                  ))}
                </ul>
              </motion.div>
            )}

            {/* CTAs */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.25 }}
              className="space-y-3 pt-4"
            >
              {/* Primary CTA */}
              <button
                onClick={handleNavigate}
                disabled={isNavigating}
                className={`w-full ${details.accentColor} hover:opacity-90 text-white font-semibold py-3 rounded-lg transition-all flex items-center justify-center gap-2 disabled:opacity-50`}
              >
                {isNavigating ? (
                  <>
                    <motion.div
                      animate={{ rotate: 360 }}
                      transition={{ repeat: Infinity, duration: 1 }}
                      className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full"
                    />
                    Loading...
                  </>
                ) : (
                  <>
                    Go to {serviceName}
                    <ArrowRight size={18} />
                  </>
                )}
              </button>

              {/* Secondary CTA */}
              <button
                onClick={onDismiss}
                disabled={isNavigating}
                className="w-full text-gray-700 hover:bg-gray-100 font-medium py-2 rounded-lg transition-colors disabled:opacity-50"
              >
                Explore Later
              </button>
            </motion.div>

            {/* Help Text */}
            <p className="text-xs text-gray-500 text-center">
              You can access {serviceName} anytime from the dropdown menu
            </p>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

/**
 * Hook to manage welcome modal state
 * Usage:
 * const { showModal, openModal, closeModal } = useWelcomeModal();
 */
export function useWelcomeModal() {
  const [showModal, setShowModal] = React.useState(false);
  const [serviceInfo, setServiceInfo] = React.useState<ServiceWelcomeModalProps | null>(null);

  const openModal = (info: ServiceWelcomeModalProps) => {
    setServiceInfo(info);
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    // Small delay before clearing info for smoother animation
    setTimeout(() => setServiceInfo(null), 300);
  };

  return {
    showModal,
    serviceInfo,
    openModal,
    closeModal,
  };
}
