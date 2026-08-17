// @ts-nocheck
import React from 'react';

interface SkeletonProps {
  className?: string;
  count?: number;
}

/**
 * Basic pulsing skeleton loader component
 */
export const Skeleton: React.FC<SkeletonProps> = ({ className = '', count = 1 }) => {
  return (
    <>
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className={`animate-pulse bg-gray-200 dark:bg-white/5 rounded-lg ${className}`}
        />
      ))}
    </>
  );
};

/**
 * Pre-defined skeleton for a standard dashboard stat card
 */
export const StatCardSkeleton: React.FC<SkeletonProps> = ({ count = 1 }) => (
  <>
    {Array.from({ length: count }).map((_, i) => (
      <div key={i} className="bg-white dark:bg-dark-surface rounded-2xl p-6 border border-gray-100 dark:border-white/5 shadow-sm space-y-4">
        <div className="flex justify-between items-start">
          <Skeleton className="h-4 w-4 rounded-full" />
          <Skeleton className="h-3 w-10" />
        </div>
        <div className="space-y-2">
          <Skeleton className="h-3 w-20" />
          <Skeleton className="h-8 w-24" />
        </div>
      </div>
    ))}
  </>
);

/**
 * Skeleton for listing rows or activity feeds
 */
export const ListRowSkeleton: React.FC<SkeletonProps> = ({ count = 1 }) => (
  <>
    {Array.from({ length: count }).map((_, i) => (
      <div key={i} className="flex items-center justify-between p-4 bg-gray-50/50 dark:bg-white/2 rounded-2xl border border-transparent">
        <div className="flex items-center gap-4">
          <Skeleton className="w-2 h-2 rounded-full" />
          <div className="space-y-2">
            <Skeleton className="h-3 w-32" />
            <Skeleton className="h-2 w-20" />
          </div>
        </div>
        <Skeleton className="h-2 w-12" />
      </div>
    ))}
  </>
);

/**
 * Skeleton for complex cards like Properties
 */
export const PropertyCardSkeleton: React.FC = () => (
  <div className="bg-white dark:bg-dark-surface rounded-3xl overflow-hidden shadow-sm border border-transparent space-y-4 pb-8">
    <Skeleton className="h-56 w-full rounded-none" />
    <div className="px-8 space-y-4">
      <div className="flex gap-4">
        <Skeleton className="h-4 w-16" />
        <Skeleton className="h-4 w-20" />
      </div>
      <Skeleton className="h-6 w-3/4" />
      <Skeleton className="h-4 w-1/2" />
      <div className="flex gap-2">
        <Skeleton className="h-4 w-12" />
        <Skeleton className="h-4 w-12" />
      </div>
    </div>
  </div>
);
