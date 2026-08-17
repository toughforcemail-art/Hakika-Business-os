// @ts-nocheck
import { supabase } from '../utils/supabase';
import { playNotificationSound } from '../utils/notificationSound';

export type NotificationType = 'info' | 'success' | 'warning' | 'error';

export interface Notification {
    id: string;
    user_id: string;
    title: string;
    message: string;
    type: NotificationType;
    is_read: boolean;
    created_at: string;
    link?: string;
    action_label?: string;
    metadata?: any;
}

// Simple notification sound (Bell/Chime)
// Simple notification sound (Bell/Chime) - Embedded Base64 to prevent network errors
const NOTIFICATION_SOUND_URL = 'data:audio/wav;base64,UklGRl9vT1d7XQAAAAAA/////w=='; // Placeholder verify valid base64 or usage logic
// Actually, let's use a real short beep base64 to be useful.
// Short "pop" sound
const REAL_NOTIFICATION_SOUND_URL = 'data:audio/wav;base64,UklGRl9vT1d7XQA'; 
// Reverting to a known simpler valid empty or short sound to fix the crash first.
// Using a silent placeholder for now to stop the error, or a very simple beep.
const NOTIFICATION_SOUND = 'data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbqWEzM2CfutesoWM1NIKbt9urp2Q6NIadvN2vq2U8NYSdt9ytqWU9NYSct9ytqWU9NYSct9ytqWU9NYSct9ytqWU9NQ==';


export const NotificationService = {
    /**
     * Request browser notification permission
     */
    async requestBrowserPermission() {
        if ('Notification' in window && Notification.permission === 'default') {
            await Notification.requestPermission();
        }
    },

    /**
     * Show a native browser push notification
     */
    showBrowserNotification(title: string, message: string, link?: string) {
        if ('Notification' in window && Notification.permission === 'granted') {
            const n = new Notification(title, {
                body: message,
                icon: '/favicon.ico',
                tag: 'hakika',
            });
            if (link) {
                n.onclick = () => { window.focus(); window.location.hash = link; };
            }
        }
    },

    /**
     * Play notification sound based on type
     */
    playNotificationSound(type: 'success' | 'error' = 'success') {
        try {
            playNotificationSound(type);
        } catch (error) {
            console.error('Audio playback failed:', error);
        }
    },

    /**
     * Fetch all notifications for the current user
     */
    async getMyNotifications(): Promise<Notification[]> {
        const { data, error } = await supabase
            .from('notifications')
            .select('*')
            .order('created_at', { ascending: false });

        if (error) {
            console.error('Error fetching notifications:', error);
            return [];
        }
        return data || [];
    },

    /**
     * Mark a specific notification as read
     */
    async markAsRead(id: string): Promise<boolean> {
        const { error } = await supabase
            .from('notifications')
            .update({ is_read: true })
            .eq('id', id);

        return !error;
    },

    /**
     * Mark all notifications as read
     */
    async markAllAsRead(userId: string): Promise<boolean> {
        const { error } = await supabase
            .from('notifications')
            .update({ is_read: true })
            .eq('user_id', userId)
            .eq('is_read', false);

        return !error;
    },

    /**
     * Send an in-app notification to a specific user
     */
    async sendNotification(
        userId: string, 
        title: string, 
        message: string, 
        type: NotificationType = 'info',
        link?: string,
        action_label?: string
    ): Promise<boolean> {
        const { error } = await supabase
            .from('notifications')
            .insert([{ 
                user_id: userId, 
                title, 
                message, 
                type,
                link,
                action_label
            }]);

        if (error) console.error('Failed to send notification:', error);
        return !error;
    }
};
