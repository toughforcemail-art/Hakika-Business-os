// @ts-nocheck
import React from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { AlertTriangle, X } from 'lucide-react';

type ThemedConfirmDialogProps = {
  open: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: 'danger' | 'warning' | 'brand';
  onConfirm: () => void;
  onClose: () => void;
};

const toneStyles = {
  danger: {
    accent: 'text-rose-400',
    confirm: 'bg-rose-500 text-white hover:bg-rose-400',
    ring: 'ring-rose-400/30',
  },
  warning: {
    accent: 'text-amber-400',
    confirm: 'bg-amber-500 text-black hover:bg-amber-400',
    ring: 'ring-amber-400/30',
  },
  brand: {
    accent: 'text-brand-purple',
    confirm: 'bg-brand-purple text-white hover:bg-brand-purple/90',
    ring: 'ring-brand-purple/30',
  },
} as const;

const ThemedConfirmDialog: React.FC<ThemedConfirmDialogProps> = ({
  open,
  title,
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  tone = 'danger',
  onConfirm,
  onClose,
}) => {
  const styles = toneStyles[tone];

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[70] flex items-center justify-center bg-black/60 px-4 py-8 backdrop-blur-sm"
          role="presentation"
          onClick={onClose}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 12 }}
            transition={{ duration: 0.18 }}
            onClick={(event) => event.stopPropagation()}
            className={`w-full max-w-lg rounded-3xl border border-white/10 bg-dark-surface p-5 text-white shadow-2xl ring-1 ${styles.ring}`}
            role="dialog"
            aria-modal="true"
            aria-labelledby="confirm-dialog-title"
          >
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-start gap-3">
                <div className={`rounded-2xl bg-white/5 p-3 ${styles.accent}`}>
                  <AlertTriangle size={20} />
                </div>
                <div>
                  <h2 id="confirm-dialog-title" className="text-lg font-black">
                    {title}
                  </h2>
                  <p className="mt-1 text-sm text-white/70">{message}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="rounded-full border border-white/10 bg-white/5 p-2 text-white/70 transition hover:bg-white/10 hover:text-white"
                aria-label="Close confirmation"
              >
                <X size={16} />
              </button>
            </div>

            <div className="mt-6 flex flex-wrap justify-end gap-3">
              <button
                type="button"
                onClick={onClose}
                className="rounded-2xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm font-bold text-white/80 transition hover:bg-white/10"
              >
                {cancelLabel}
              </button>
              <button
                type="button"
                onClick={onConfirm}
                className={`rounded-2xl px-4 py-2.5 text-sm font-black transition ${styles.confirm}`}
              >
                {confirmLabel}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default ThemedConfirmDialog;
