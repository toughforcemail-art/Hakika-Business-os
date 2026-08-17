import { randomUUID } from "node:crypto";

export type ActionResult<T = undefined> =
  | { ok: true; code: string; message: string; data?: T; requestId: string }
  | { ok: false; code: string; message: string; fieldErrors?: Record<string, string[]>; retryable?: boolean; recoveryAction?: { label: string; href?: string; action?: string }; requestId: string };

export function requestId() { return randomUUID(); }

export function success<T>(code: string, message: string, data?: T, id = requestId()): ActionResult<T> {
  return { ok: true, code, message, ...(data === undefined ? {} : { data }), requestId: id };
}

export function failure(code: string, message: string, options: Omit<Extract<ActionResult, { ok: false }>, "ok" | "code" | "message" | "requestId"> = {}, id = requestId()): ActionResult<never> {
  return { ok: false, code, message, ...options, requestId: id };
}

export function sanitizeActionError(error: unknown, id = requestId()): ActionResult<never> {
  if (error instanceof Error && error.message === "Company selection required") return failure("COMPANY_SELECTION_REQUIRED", "Select a company before continuing.", { recoveryAction: { label: "Choose company", href: "/apps" } }, id);
  return failure("DATABASE_ERROR", "We could not complete that request. Reference: " + id.slice(0, 8), { retryable: true }, id);
}
