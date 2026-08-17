// @ts-nocheck
export interface TenantDisplaySource {
  id: string;
  full_name?: string | null;
  name?: string | null;
  display_name?: string | null;
  profile?: { full_name?: string | null; email?: string | null } | null;
}

const isUuidLike = (value?: string | null) =>
  Boolean(value && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value.trim()));

export const getTenantDisplayName = (tenant: TenantDisplaySource) => {
  const candidates = [
    tenant.full_name,
    tenant.name,
    tenant.display_name,
    tenant.profile?.full_name,
    tenant.profile?.email?.split('@')[0],
  ].filter((value): value is string => Boolean(value && value.trim()));

  const preferred = candidates.find((value) => !isUuidLike(value))?.trim();
  return preferred || `Tenant ${tenant.id.slice(0, 8)}`;
};
