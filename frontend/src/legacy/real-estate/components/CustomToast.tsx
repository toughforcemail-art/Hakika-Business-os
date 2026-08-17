// @ts-nocheck
import React, { useEffect, useRef, useState } from 'react';
import { CheckCircle, XCircle, AlertTriangle, Info, X } from 'lucide-react';
import { NotificationService } from '../services/NotificationService';

// ── Types ─────────────────────────────────────────────────────────────────
export type ToastType = 'success' | 'error' | 'warning' | 'info';

export interface ToastProps {
    message: string;
    type?: ToastType;
    isVisible?: boolean;
    onClose: () => void;
    duration?: number;
    title?: string;
}

// ── Config per type ───────────────────────────────────────────────────────
const CONFIGS = {
    success: {
        icon: CheckCircle,
        bg: 'bg-[#0D2B1A]',
        border: 'border-green-500/30',
        iconColor: 'text-green-400',
        iconBg: 'bg-green-500/15',
        titleColor: 'text-green-300',
        textColor: 'text-green-100/80',
        bar: 'bg-green-500',
        defaultTitle: 'Success',
    },
    error: {
        icon: XCircle,
        bg: 'bg-[#2B0D0D]',
        border: 'border-red-500/30',
        iconColor: 'text-red-400',
        iconBg: 'bg-red-500/15',
        titleColor: 'text-red-300',
        textColor: 'text-red-100/80',
        bar: 'bg-red-500',
        defaultTitle: 'Error',
    },
    warning: {
        icon: AlertTriangle,
        bg: 'bg-[#2B1D0D]',
        border: 'border-amber-500/30',
        iconColor: 'text-amber-400',
        iconBg: 'bg-amber-500/15',
        titleColor: 'text-amber-300',
        textColor: 'text-amber-100/80',
        bar: 'bg-amber-500',
        defaultTitle: 'Warning',
    },
    info: {
        icon: Info,
        bg: 'bg-[#0D1A2B]',
        border: 'border-orange-500/30',
        iconColor: 'text-orange-400',
        iconBg: 'bg-orange-500/15',
        titleColor: 'text-orange-300',
        textColor: 'text-orange-100/80',
        bar: 'bg-gradient-to-r from-orange-500 to-amber-400',
        defaultTitle: 'Info',
    },
};

// ── Sanitiser — strips raw status codes & exception details ───────────────
export function sanitizeError(raw: unknown): string {
    if (!raw) return 'Something went wrong. Please try again.';
    
    let s = '';
    if (typeof raw === 'object' && raw !== null) {
        // Handle Supabase/Postgrest errors which often have .message
        const obj = raw as any;
        s = obj.message || obj.details || obj.hint || JSON.stringify(raw);
    } else {
        s = String(raw);
    }
    
    const lower = s.toLowerCase();

    if (/invalid.*(otp|token)|otp.*expired|token.*expir/.test(lower))
        return 'The verification code is incorrect or has expired. Please request a new one.';
    if (/invalid.*credentials|wrong.*password|invalid.*login/.test(lower))
        return 'Incorrect email or password. Please try again.';
    if (/email.*not.*confirmed|not.*confirmed/.test(lower))
        return 'Please verify your email before signing in.';
    if (/invalid.*jwt|jwt.*invalid|authorization.*failed|unauthorized|session.*expired|expired.*session/.test(lower))
        return 'Your session expired or was rejected while completing this action. Please sign in again and try once more.';
    if (/email.*already.*exists|already.*registered/.test(lower))
        return 'An account with this email already exists.';
    if (/already.*exists|duplicate/.test(lower))
        return 'This record already exists. Please use a different name.';
    if (/network|socket|connection|timeout|fetch/.test(lower))
        return 'Connection error. Please check your internet and try again.';
    if (/rate.?limit|too many|429/.test(lower))
        return 'Too many attempts. Please wait a moment and try again.';
    if (/signup.*not.*allowed|signups.*not.*allowed/.test(lower))
        return 'New registrations are currently restricted. Contact your administrator.';
    if (/password.*weak|password.*length|short.*password/.test(lower))
        return 'Password must be at least 8 characters with letters and numbers.';

    // Strip technical noise
    const cleaned = s
        .replace(/AuthApiError|AuthError|PostgrestError|FetchError/gi, '')
        .replace(/statusCode[:\s]+\d+/gi, '')
        .replace(/\{[^}]*\}/g, '')
        .replace(/\s+/g, ' ')
        .trim();

    if (cleaned && cleaned.length < 120) return cleaned;
    return 'Something went wrong. Please try again.';
}

// ── Component ─────────────────────────────────────────────────────────────
const CustomToast: React.FC<ToastProps> = ({
    message,
    type = 'info',
    isVisible = true,
    onClose,
    duration = 5000,
    title,
}) => {
    const [mounted, setMounted] = useState(false);
    const [exiting, setExiting] = useState(false);
    const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const cfg = CONFIGS[type];
    const Icon = cfg.icon;

    const close = () => {
        setExiting(true);
        setTimeout(() => {
            setMounted(false);
            setExiting(false);
            onClose();
        }, 350);
    };

    useEffect(() => {
        if (isVisible) {
            setMounted(true);
            setExiting(false);
            NotificationService.playNotificationSound(type === 'success' ? 'success' : 'error');
            timerRef.current = setTimeout(close, duration);
        }
        return () => {
            if (timerRef.current) clearTimeout(timerRef.current);
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isVisible]);

    if (!mounted && !isVisible) return null;

    const displayTitle = title ?? cfg.defaultTitle;
    const slideClass = exiting
        ? 'translate-x-full opacity-0'
        : 'translate-x-0 opacity-100';

    return (
        <div
            className={`
                fixed top-5 right-5 z-[9999] w-[340px] max-w-[calc(100vw-2rem)]
                transform transition-all duration-350 ease-in-out
                ${slideClass}
            `}
            role="alert"
            aria-live="assertive"
        >
            <div className={`
                ${cfg.bg} ${cfg.border}
                border rounded-xl overflow-hidden
                shadow-2xl shadow-black/40 backdrop-blur-sm
            `}>
                {/* Progress bar */}
                <div className="relative h-0.5 bg-white/5">
                    <div
                        className={`absolute inset-y-0 left-0 ${cfg.bar}`}
                        style={{
                            width: '100%',
                            animation: `shrink ${duration}ms linear forwards`,
                        }}
                    />
                </div>

                <div className="flex items-start gap-3 p-4">
                    {/* Icon */}
                    <div className={`${cfg.iconBg} rounded-lg p-2 mt-0.5 shrink-0`}>
                        <Icon className={`w-4 h-4 ${cfg.iconColor}`} strokeWidth={2.5} />
                    </div>

                    {/* Text */}
                    <div className="flex-1 min-w-0">
                        <p className={`text-xs font-bold tracking-wide uppercase ${cfg.titleColor} mb-0.5`}>
                            {displayTitle}
                        </p>
                        <p className={`text-sm leading-snug ${cfg.textColor}`}>
                            {message}
                        </p>
                    </div>

                    {/* Close */}
                    <button
                        onClick={close}
                        className="shrink-0 p-1 rounded-md hover:bg-white/10 transition-colors text-white/30 hover:text-white/60"
                        aria-label="Dismiss"
                    >
                        <X size={14} />
                    </button>
                </div>
            </div>

            <style>{`
                @keyframes shrink {
                    from { width: 100%; }
                    to { width: 0%; }
                }
            `}</style>
        </div>
    );
};

export default CustomToast;
