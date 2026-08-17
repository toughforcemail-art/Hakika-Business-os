// @ts-nocheck
import { supabase } from '../utils/supabase';

export interface TenantAssetAssignment {
  id: string;
  asset_id: string;
  tenant_id: string;
  unit_id: string;
  property_id: string;
  assigned_at: string;
  assigned_by: string | null;
  returned_at: string | null;
  condition_on_return: string | null;
  returned_by: string | null;
  notes: string | null;
  company_id?: string;
}

export interface TenantAsset extends TenantAssetAssignment {
  asset_name: string;
  asset_type: string;
  serial_number: string;
  asset_condition: string;
  color: string;
  image_url: string;
  tenant_name: string;
  tenant_email: string;
  unit_number: string;
  floor_number: number;
  unit_type: string;
  property_name: string;
  address: string;
}

export const tenantAssetService = {
  /**
   * Assign an asset to a tenant in a specific unit
   */
  async assignAssetToTenant(
    assetId: string,
    tenantId: string,
    unitId: string,
    propertyId: string,
    assignedBy: string,
    notes?: string,
    companyId?: string
  ): Promise<TenantAssetAssignment> {
    const { data, error } = await supabase
      .from('re_tenant_asset_assignments')
      .insert({
        asset_id: assetId,
        tenant_id: tenantId,
        unit_id: unitId,
        property_id: propertyId,
        assigned_by: assignedBy,
        notes,
        company_id: companyId,
      })
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  /**
   * Return an asset from a tenant
   */
  async returnAssetFromTenant(
    assignmentId: string,
    conditionOnReturn: string,
    returnedBy: string,
    notes?: string
  ): Promise<TenantAssetAssignment> {
    const { data, error } = await supabase
      .from('re_tenant_asset_assignments')
      .update({
        returned_at: new Date().toISOString(),
        condition_on_return: conditionOnReturn,
        returned_by: returnedBy,
        notes,
      })
      .eq('id', assignmentId)
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  /**
   * Get all active assets assigned to a tenant
   */
  async getTenantActiveAssets(tenantId: string): Promise<TenantAsset[]> {
    const { data, error } = await supabase
      .from('re_active_tenant_assets')
      .select('*')
      .eq('tenant_id', tenantId)
      .order('assigned_at', { ascending: false });

    if (error) throw error;
    return data || [];
  },

  /**
   * Get all assets assigned to a specific unit
   */
  async getUnitAssets(unitId: string): Promise<TenantAsset[]> {
    const { data, error } = await supabase
      .from('re_active_tenant_assets')
      .select('*')
      .eq('unit_id', unitId)
      .order('assigned_at', { ascending: false });

    if (error) throw error;
    return data || [];
  },

  /**
   * Get all assets assigned to a specific property (all units)
   */
  async getPropertyAssets(propertyId: string): Promise<TenantAsset[]> {
    const { data, error } = await supabase
      .from('re_active_tenant_assets')
      .select('*')
      .eq('property_id', propertyId)
      .order('property_name', { ascending: true })
      .order('unit_number', { ascending: true });

    if (error) throw error;
    return data || [];
  },

  /**
   * Get assignment history for a specific asset
   */
  async getAssetHistory(assetId: string): Promise<TenantAsset[]> {
    const { data, error } = await supabase
      .from('re_tenant_asset_history')
      .select('*')
      .eq('asset_id', assetId)
      .order('assigned_at', { ascending: false });

    if (error) throw error;
    return data || [];
  },

  /**
   * Get assignment history for a specific tenant
   */
  async getTenantHistory(tenantId: string): Promise<TenantAsset[]> {
    const { data, error } = await supabase
      .from('re_tenant_asset_history')
      .select('*')
      .eq('tenant_id', tenantId)
      .order('assigned_at', { ascending: false });

    if (error) throw error;
    return data || [];
  },

  /**
   * Search available assets for assignment
   */
  async getAvailableAssets(companyId?: string): Promise<any[]> {
    let query = supabase
      .from('re_assets')
      .select('id, name, type, serial_number, condition, color, image_url');

    if (companyId) {
      query = query.eq('company_id', companyId);
    }

    const { data, error } = await query
      .eq('status', 'available')
      .order('name', { ascending: true });

    if (error) throw error;
    return data || [];
  },

  /**
   * Get tenants available for assignment
   */
  async getTenants(): Promise<any[]> {
    const { data, error } = await supabase
      .from('re_tenants')
      .select(
        `
        id,
        current_unit_id,
        is_active,
        profiles:id ( id, full_name, email ),
        re_units:current_unit_id ( 
          id, 
          unit_number, 
          floor_number,
          re_properties:property_id ( id, name, address )
        )
      `
      )
      .eq('is_active', true);

    if (error) throw error;
    return data || [];
  },

  /**
   * Get properties with units and tenants
   */
  async getPropertiesWithUnits(): Promise<any[]> {
    const { data, error } = await supabase
      .from('re_properties')
      .select(
        `
        id,
        name,
        address,
        re_units (
          id,
          unit_number,
          floor_number,
          type,
          re_tenants:id ( id, is_active, profiles:id ( id, full_name, email ) )
        )
      `
      )
      .order('name', { ascending: true });

    if (error) throw error;
    return data || [];
  },

  /**
   * Get all assets assigned to a unit grouped by tenant
   */
  async getUnitAssetsGroupedByTenant(unitId: string): Promise<Map<string, TenantAsset[]>> {
    const assets = await this.getUnitAssets(unitId);
    
    const grouped = new Map<string, TenantAsset[]>();
    assets.forEach(asset => {
      const tenantKey = `${asset.tenant_id}|${asset.tenant_name}`;
      if (!grouped.has(tenantKey)) {
        grouped.set(tenantKey, []);
      }
      grouped.get(tenantKey)!.push(asset);
    });

    return grouped;
  },

  /**
   * Get all assets assigned to a property grouped by unit
   */
  async getPropertyAssetsGroupedByUnit(propertyId: string): Promise<Map<string, TenantAsset[]>> {
    const assets = await this.getPropertyAssets(propertyId);
    
    const grouped = new Map<string, TenantAsset[]>();
    assets.forEach(asset => {
      const unitKey = `${asset.unit_id}|${asset.unit_number}|Floor ${asset.floor_number}`;
      if (!grouped.has(unitKey)) {
        grouped.set(unitKey, []);
      }
      grouped.get(unitKey)!.push(asset);
    });

    return grouped;
  },

  /**
   * Update assignment notes
   */
  async updateAssignmentNotes(
    assignmentId: string,
    notes: string
  ): Promise<TenantAssetAssignment> {
    const { data, error } = await supabase
      .from('re_tenant_asset_assignments')
      .update({ notes })
      .eq('id', assignmentId)
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  /**
   * Delete an assignment
   */
  async deleteAssignment(assignmentId: string): Promise<void> {
    const { error } = await supabase
      .from('re_tenant_asset_assignments')
      .delete()
      .eq('id', assignmentId);

    if (error) throw error;
  },
};
