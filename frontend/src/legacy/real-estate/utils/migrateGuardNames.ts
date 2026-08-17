// @ts-nocheck
import { supabase } from './supabase';

export async function migrateGuardNamesToShifts() {
  try {
    // Fetch ALL shifts (not just ones with null names)
    const { data: allShifts, error: fetchError } = await supabase
      .from('security_shifts')
      .select('id, employee_id, employee_name_snapshot, replacement_id, replacement_name_snapshot');

    if (fetchError) {
      return {
        success: false,
        error: `Failed to fetch shifts: ${fetchError.message}`,
        migratedCount: 0,
      };
    }

    if (!allShifts || allShifts.length === 0) {
      return {
        success: true,
        error: null,
        migratedCount: 0,
      };
    }

    // Get unique employee IDs and replacement IDs
    const employeeIds = new Set<string>();
    const replacementIds = new Set<string>();

    allShifts.forEach((shift) => {
      if (shift.employee_id) employeeIds.add(shift.employee_id);
      if (shift.replacement_id) replacementIds.add(shift.replacement_id);
    });

    // Fetch guard names from profiles
    const allIds = Array.from(new Set([...employeeIds, ...replacementIds]));
    const { data: profiles, error: profileError } = await supabase
      .from('profiles')
      .select('id, full_name')
      .in('id', allIds);

    if (profileError) {
      return {
        success: false,
        error: `Failed to fetch guard names: ${profileError.message}`,
        migratedCount: 0,
      };
    }

    // Create lookup map
    const nameMap = new Map<string, string>();
    profiles?.forEach((profile) => {
      if (profile.full_name) {
        nameMap.set(profile.id, profile.full_name);
      }
    });

    // Prepare updates - update ALL shifts that don't have names OR have empty names
    const updates: Array<{
      id: string;
      employee_name_snapshot: string | null;
      replacement_name_snapshot: string | null;
    }> = [];

    allShifts.forEach((shift: any) => {
      const employeeName = shift.employee_name_snapshot || nameMap.get(shift.employee_id) || null;
      const replacementName = shift.replacement_name_snapshot || (shift.replacement_id ? nameMap.get(shift.replacement_id) : null) || null;

      // Update if employee_name_snapshot is missing or empty
      if (!shift.employee_name_snapshot || shift.employee_name_snapshot.trim() === '') {
        updates.push({
          id: shift.id,
          employee_name_snapshot: employeeName,
          replacement_name_snapshot: replacementName,
        });
      }
    });

    if (updates.length === 0) {
      return {
        success: true,
        error: null,
        migratedCount: 0,
      };
    }

    // Batch update shifts (Supabase has limits, so we'll do it in chunks)
    const chunkSize = 50;
    let migratedCount = 0;

    for (let i = 0; i < updates.length; i += chunkSize) {
      const chunk = updates.slice(i, i + chunkSize);

      for (const update of chunk) {
        const { error: updateError } = await supabase
          .from('security_shifts')
          .update({
            employee_name_snapshot: update.employee_name_snapshot,
            replacement_name_snapshot: update.replacement_name_snapshot,
          })
          .eq('id', update.id);

        if (!updateError) {
          migratedCount++;
        }
      }
    }

    return {
      success: true,
      error: null,
      migratedCount,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred',
      migratedCount: 0,
    };
  }
}
