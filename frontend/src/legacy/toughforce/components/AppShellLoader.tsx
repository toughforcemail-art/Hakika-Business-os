// @ts-nocheck
import React from 'react';
import CustomLoader from './CustomLoader';

interface AppShellLoaderProps {
  label?: string;
  variant?: 'screen' | 'panel';
}

const AppShellLoader: React.FC<AppShellLoaderProps> = ({
  label = 'Loading workspace...',
  variant = 'screen',
}) => {
  if (variant === 'panel') {
    return (
      <div className="grid min-h-[320px] place-items-center rounded-3xl border border-gray-200 bg-white/80 p-6 shadow-sm dark:border-dark-border dark:bg-dark-surface/70 sm:p-8">
        <div className="flex w-full max-w-[18rem] items-center justify-center">
          <CustomLoader size={36} label={label} />
        </div>
      </div>
    );
  }

  return (
    <div className="grid min-h-screen place-items-center bg-gray-50 px-4 dark:bg-dark-bg sm:px-6">
      <div className="w-full max-w-4xl">
        <div className="mx-auto flex w-full max-w-md justify-center rounded-3xl border border-gray-200 bg-white/90 p-6 shadow-xl shadow-slate-900/5 dark:border-dark-border dark:bg-dark-surface/80 dark:shadow-black/20 sm:p-8">
          <CustomLoader size={40} label={label} />
        </div>
      </div>
    </div>
  );
};

export default AppShellLoader;
