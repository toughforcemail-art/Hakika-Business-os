import "server-only";

import { createSupabaseServerClient } from "@/lib/supabase/server";

export type ProvisionOrganizationInput = {
  organizationName: string;
  companyName: string;
  organizationSlug?: string;
  companyCode?: string;
  ownerUserId?: string;
  applicationKeys: string[];
  planKey?: string;
  trialDays?: number;
  requestKey: string;
};

export async function provisionOrganization(input: ProvisionOrganizationInput) {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.schema("platform").rpc("provision_organization", {
    p_organization_name: input.organizationName,
    p_company_name: input.companyName,
    p_organization_slug: input.organizationSlug ?? null,
    p_company_code: input.companyCode ?? null,
    p_owner_user_id: input.ownerUserId ?? null,
    p_application_keys: input.applicationKeys,
    p_plan_key: input.planKey ?? null,
    p_trial_days: input.trialDays ?? 14,
    p_request_key: input.requestKey,
  });
  if (error) throw new Error("Organization provisioning failed.");
  return data as { organization_id: string; company_id: string; owner_membership_id: string | null; status: "completed" };
}

export async function rentApplication(organizationId: string, applicationKey: string) {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.schema("platform").rpc("set_application_subscription_status", { p_organization_id: organizationId, p_application_key: applicationKey, p_status: "active", p_trial_days: null });
  if (error) throw new Error("Application subscription could not be activated.");
  return data;
}

export async function suspendApplicationSubscription(organizationId: string, applicationKey: string) { return setSubscriptionStatus(organizationId, applicationKey, "suspended"); }
export async function resumeApplicationSubscription(organizationId: string, applicationKey: string) { return setSubscriptionStatus(organizationId, applicationKey, "active"); }
export async function cancelApplicationSubscription(organizationId: string, applicationKey: string) { return setSubscriptionStatus(organizationId, applicationKey, "cancelled"); }
export async function extendTrial(organizationId: string, applicationKey: string, trialDays: number) { return setSubscriptionStatus(organizationId, applicationKey, "trial", trialDays); }

async function setSubscriptionStatus(organizationId: string, applicationKey: string, status: "trial" | "active" | "suspended" | "cancelled", trialDays?: number) {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.schema("platform").rpc("set_application_subscription_status", { p_organization_id: organizationId, p_application_key: applicationKey, p_status: status, p_trial_days: trialDays ?? null });
  if (error) throw new Error("Application subscription update failed.");
  return data;
}
