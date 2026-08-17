// @ts-nocheck
/**
 * Guard Mobile App Service
 * Handles all backend operations for guard shift management, check-in/out, and attendance
 */

import { supabase } from '../utils/supabase';
import { SecurityShift } from '../types/security';

// ============================================================================
// TYPES
// ============================================================================

export interface GuardCheckIn {
  id: string;
  shift_id: string;
  guard_id: string;
  site_id: string | null;
  post_id: string | null;
  checked_in_at: string;
  checked_in_location_lat: number | null;
  checked_in_location_lon: number | null;
  checked_in_device_id: string | null;
  checked_in_ip_address: string | null;
  check_in_photo_url: string | null;
  checked_out_at: string | null;
  checked_out_location_lat: number | null;
  checked_out_location_lon: number | null;
  checked_out_device_id: string | null;
  checked_out_ip_address: string | null;
  check_out_photo_url: string | null;
  shift_status: 'pending' | 'verified' | 'disputed' | 'approved';
  early_checkin_minutes: number | null;
  late_checkin_minutes: number | null;
  early_checkout_minutes: number | null;
  late_checkout_minutes: number | null;
  notes: string | null;
  verified_by: string | null;
  verified_at: string | null;
  verification_notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface GuardMobileDevice {
  id: string;
  guard_id: string;
  device_id: string;
  device_name: string | null;
  device_type: 'smartphone' | 'tablet';
  os_type: string | null;
  app_version: string | null;
  is_verified: boolean;
  verified_at: string | null;
  is_active: boolean;
  last_seen: string | null;
  created_at: string;
  updated_at: string;
}

export interface GuardNotification {
  id: string;
  guard_id: string;
  shift_id: string | null;
  title: string;
  body: string;
  notification_type: 'shift_reminder' | 'shift_published' | 'check_in_reminder' | 'check_out_reminder' | 'late_shift' | 'urgent';
  is_sent: boolean;
  sent_at: string | null;
  is_read: boolean;
  read_at: string | null;
  action_type: 'viewed' | 'acknowledged' | 'dismissed' | null;
  action_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface GuardShiftRating {
  id: string;
  shift_id: string;
  guard_id: string;
  rated_by: string | null;
  rating_score: 1 | 2 | 3 | 4 | 5;
  rating_category: 'punctuality' | 'performance' | 'professionalism' | 'hygiene';
  feedback_text: string | null;
  incident_reported: boolean;
  incident_type: string | null;
  created_at: string;
  updated_at: string;
}

export interface GuardAttendanceSummary {
  guard_id: string;
  full_name: string | null;
  phone: string | null;
  total_shifts: number;
  completed_check_ins: number;
  completed_shifts: number;
  late_checkins: number;
  avg_rating: number;
  last_checkin: string | null;
}

export interface GuardShiftWithStatus extends SecurityShift {
  site_name?: string | null;
  post_name?: string | null;
  guard_name?: string | null;
  check_in_status?: 'pending' | 'checked_in' | 'completed';
  time_until_shift?: number; // milliseconds
  is_late?: boolean;
}

// ============================================================================
// GUARD SHIFTS
// ============================================================================

/**
 * Get all shifts for current guard (today and upcoming)
 */
export async function getGuardShifts(
  guardId: string,
  startDate?: Date,
  endDate?: Date
): Promise<GuardShiftWithStatus[]> {
  try {
    let query = supabase
      .from('security_shifts')
      .select(
        `id, site_id, post_id, employee_id, start_time, end_time, status, 
         workflow_status, checked_in_at, checked_out_at, notes, shift_kind,
         security_sites:site_id(id, name),
         security_posts:post_id(id, name),
         profiles:employee_id(id, full_name, phone)`
      )
      .eq('employee_id', guardId)
      .neq('status', 'cancelled')
      .order('start_time', { ascending: true });

    if (startDate) {
      query = query.gte('start_time', startDate.toISOString());
    }

    if (endDate) {
      query = query.lte('start_time', endDate.toISOString());
    }

    const { data, error } = await query;

    if (error) throw error;

    return (data || []).map(shift => ({
      ...shift,
      site_name: shift.security_sites?.name,
      post_name: shift.security_posts?.name,
      guard_name: shift.profiles?.full_name,
      time_until_shift: new Date(shift.start_time).getTime() - Date.now(),
      is_late: new Date() > new Date(shift.start_time),
      check_in_status: shift.checked_in_at ? (shift.checked_out_at ? 'completed' : 'checked_in') : 'pending'
    }));
  } catch (error) {
    console.error('Error fetching guard shifts:', error);
    throw error;
  }
}

/**
 * Get today's shifts for current guard
 */
export async function getTodayShifts(guardId: string): Promise<GuardShiftWithStatus[]> {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  return getGuardShifts(guardId, today, tomorrow);
}

/**
 * Get upcoming shifts (next 7 days)
 */
export async function getUpcomingShifts(guardId: string, daysAhead: number = 7): Promise<GuardShiftWithStatus[]> {
  const today = new Date();
  const future = new Date();
  future.setDate(future.getDate() + daysAhead);

  return getGuardShifts(guardId, today, future);
}

/**
 * Get single shift details
 */
export async function getShiftDetails(shiftId: string): Promise<GuardShiftWithStatus | null> {
  try {
    const { data, error } = await supabase
      .from('security_shifts')
      .select(
        `*, security_sites:site_id(id, name, address, latitude, longitude),
         security_posts:post_id(id, name),
         profiles:employee_id(id, full_name, phone, email)`
      )
      .eq('id', shiftId)
      .single();

    if (error) throw error;

    return data ? {
      ...data,
      site_name: data.security_sites?.name,
      post_name: data.security_posts?.name,
      guard_name: data.profiles?.full_name,
      time_until_shift: new Date(data.start_time).getTime() - Date.now(),
      is_late: new Date() > new Date(data.start_time),
      check_in_status: data.checked_in_at ? (data.checked_out_at ? 'completed' : 'checked_in') : 'pending'
    } : null;
  } catch (error) {
    console.error('Error fetching shift details:', error);
    throw error;
  }
}

// ============================================================================
// CHECK-IN / CHECK-OUT
// ============================================================================

/**
 * Record guard check-in with location and device info
 */
export async function checkInGuard(
  shiftId: string,
  guardId: string,
  location?: { latitude: number; longitude: number },
  deviceId?: string,
  photoUrl?: string
): Promise<GuardCheckIn> {
  try {
    const checkinData = {
      shift_id: shiftId,
      guard_id: guardId,
      checked_in_at: new Date().toISOString(),
      checked_in_location_lat: location?.latitude || null,
      checked_in_location_lon: location?.longitude || null,
      checked_in_device_id: deviceId || null,
      check_in_photo_url: photoUrl || null
    };

    const { data, error } = await supabase
      .from('guard_check_ins')
      .insert([checkinData])
      .select()
      .single();

    if (error) throw error;

    // Update shift status
    await supabase
      .from('security_shifts')
      .update({
        checked_in_at: new Date().toISOString(),
        workflow_status: 'checked_in'
      })
      .eq('id', shiftId);

    return data;
  } catch (error) {
    console.error('Error checking in guard:', error);
    throw error;
  }
}

/**
 * Record guard check-out with location and photo
 */
export async function checkOutGuard(
  checkInId: string,
  shiftId: string,
  location?: { latitude: number; longitude: number },
  deviceId?: string,
  photoUrl?: string,
  notes?: string
): Promise<GuardCheckIn> {
  try {
    const checkoutData = {
      checked_out_at: new Date().toISOString(),
      checked_out_location_lat: location?.latitude || null,
      checked_out_location_lon: location?.longitude || null,
      checked_out_device_id: deviceId || null,
      check_out_photo_url: photoUrl || null,
      notes: notes || null,
      shift_status: 'pending'
    };

    const { data, error } = await supabase
      .from('guard_check_ins')
      .update(checkoutData)
      .eq('id', checkInId)
      .select()
      .single();

    if (error) throw error;

    // Update shift status
    await supabase
      .from('security_shifts')
      .update({
        checked_out_at: new Date().toISOString(),
        workflow_status: 'completed',
        status: 'completed'
      })
      .eq('id', shiftId);

    return data;
  } catch (error) {
    console.error('Error checking out guard:', error);
    throw error;
  }
}

/**
 * Get check-in record for a shift
 */
export async function getCheckInRecord(shiftId: string): Promise<GuardCheckIn | null> {
  try {
    const { data, error } = await supabase
      .from('guard_check_ins')
      .select('*')
      .eq('shift_id', shiftId)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (error && error.code !== 'PGRST116') throw error;
    return data || null;
  } catch (error) {
    console.error('Error fetching check-in record:', error);
    throw error;
  }
}

// ============================================================================
// MOBILE DEVICES
// ============================================================================

/**
 * Register a mobile device for push notifications
 */
export async function registerMobileDevice(
  guardId: string,
  deviceId: string,
  deviceName?: string,
  osType?: string,
  appVersion?: string
): Promise<GuardMobileDevice> {
  try {
    const { data, error } = await supabase
      .from('guard_mobile_devices')
      .insert([{
        guard_id: guardId,
        device_id: deviceId,
        device_name: deviceName,
        device_type: 'smartphone',
        os_type: osType,
        app_version: appVersion,
        is_active: true
      }])
      .select()
      .single();

    if (error) throw error;
    return data;
  } catch (error) {
    console.error('Error registering mobile device:', error);
    throw error;
  }
}

/**
 * Update device last seen timestamp
 */
export async function updateDeviceLastSeen(deviceId: string): Promise<void> {
  try {
    await supabase
      .from('guard_mobile_devices')
      .update({ last_seen: new Date().toISOString() })
      .eq('device_id', deviceId);
  } catch (error) {
    console.error('Error updating device last seen:', error);
  }
}

// ============================================================================
// NOTIFICATIONS
// ============================================================================

/**
 * Get unread notifications for guard
 */
export async function getGuardNotifications(
  guardId: string,
  unreadOnly: boolean = false
): Promise<GuardNotification[]> {
  try {
    let query = supabase
      .from('guard_notifications')
      .select('*')
      .eq('guard_id', guardId)
      .order('created_at', { ascending: false })
      .limit(50);

    if (unreadOnly) {
      query = query.eq('is_read', false);
    }

    const { data, error } = await query;
    if (error) throw error;

    return data || [];
  } catch (error) {
    console.error('Error fetching guard notifications:', error);
    throw error;
  }
}

/**
 * Mark notification as read
 */
export async function markNotificationAsRead(
  notificationId: string,
  actionType: 'viewed' | 'acknowledged' | 'dismissed' = 'viewed'
): Promise<void> {
  try {
    await supabase
      .from('guard_notifications')
      .update({
        is_read: true,
        read_at: new Date().toISOString(),
        action_type: actionType,
        action_at: new Date().toISOString()
      })
      .eq('id', notificationId);
  } catch (error) {
    console.error('Error marking notification as read:', error);
    throw error;
  }
}

/**
 * Get unread notification count
 */
export async function getUnreadNotificationCount(guardId: string): Promise<number> {
  try {
    const { count, error } = await supabase
      .from('guard_notifications')
      .select('*', { count: 'exact', head: true })
      .eq('guard_id', guardId)
      .eq('is_read', false);

    if (error) throw error;
    return count || 0;
  } catch (error) {
    console.error('Error getting unread count:', error);
    return 0;
  }
}

// ============================================================================
// ATTENDANCE & RATINGS
// ============================================================================

/**
 * Get attendance summary for guard
 */
export async function getAttendanceSummary(
  guardId: string,
  startDate?: Date,
  endDate?: Date
): Promise<GuardAttendanceSummary | null> {
  try {
    let query = supabase
      .from('guard_attendance_summary')
      .select('*')
      .eq('guard_id', guardId);

    const { data, error } = await query;

    if (error) throw error;
    return data?.[0] || null;
  } catch (error) {
    console.error('Error fetching attendance summary:', error);
    throw error;
  }
}

/**
 * Get guard shift ratings
 */
export async function getGuardRatings(
  guardId: string,
  limit: number = 10
): Promise<GuardShiftRating[]> {
  try {
    const { data, error } = await supabase
      .from('guard_shift_ratings')
      .select('*')
      .eq('guard_id', guardId)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) throw error;
    return data || [];
  } catch (error) {
    console.error('Error fetching guard ratings:', error);
    throw error;
  }
}

/**
 * Calculate attendance percentage
 */
export async function calculateAttendancePercentage(
  guardId: string,
  startDate?: Date,
  endDate?: Date
): Promise<number> {
  try {
    const { data, error } = await supabase
      .rpc('calculate_guard_attendance_percentage', {
        guard_uuid: guardId,
        start_date: startDate?.toISOString().split('T')[0] || null,
        end_date: endDate?.toISOString().split('T')[0] || null
      });

    if (error) throw error;
    return data || 0;
  } catch (error) {
    console.error('Error calculating attendance:', error);
    return 0;
  }
}

/**
 * Check if guard is late for shift
 */
export async function isGuardLateForShift(shiftId: string): Promise<boolean> {
  try {
    const { data, error } = await supabase
      .rpc('is_guard_late_for_shift', {
        shift_id: shiftId,
        threshold_minutes: 15
      });

    if (error) throw error;
    return data || false;
  } catch (error) {
    console.error('Error checking if guard is late:', error);
    return false;
  }
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Format time until shift
 */
export function formatTimeUntilShift(timeMs: number): string {
  if (timeMs < 0) {
    return 'Shift started';
  }

  const hours = Math.floor(timeMs / (1000 * 60 * 60));
  const minutes = Math.floor((timeMs % (1000 * 60 * 60)) / (1000 * 60));

  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }
  return `${minutes}m`;
}

/**
 * Get shift status badge text
 */
export function getShiftStatusBadge(checkInStatus: string, isLate?: boolean): string {
  if (isLate && checkInStatus === 'pending') {
    return 'LATE';
  }
  return checkInStatus === 'completed' ? 'COMPLETED' : checkInStatus === 'checked_in' ? 'IN PROGRESS' : 'PENDING';
}

/**
 * Get shift status color
 */
export function getShiftStatusColor(checkInStatus: string, isLate?: boolean): string {
  if (isLate && checkInStatus === 'pending') {
    return 'bg-red-500';
  }
  const statusColors: Record<string, string> = {
    completed: 'bg-green-500',
    checked_in: 'bg-blue-500',
    pending: 'bg-yellow-500'
  };
  return statusColors[checkInStatus] || 'bg-gray-500';
}
