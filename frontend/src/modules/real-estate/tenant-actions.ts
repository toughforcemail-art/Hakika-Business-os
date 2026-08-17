"use server";

import { swapTenantUnit as performSwapTenantUnit } from "./tenant-billing";

export async function swapTenantUnit(form: FormData) {
  return performSwapTenantUnit(form);
}
