# Platform context architecture

Hakika resolves one server-side `PlatformContext` for every authenticated request. Organization is the mandatory tenant boundary. Application is the product boundary. Company is an optional subdivision selected only when the organization/application scope policy permits it.

The browser may remember only opaque organization and company identifiers in secure, same-origin, HttpOnly cookies. Permissions, role data, and service credentials are never trusted from the browser.

## Canonical helpers

Use `getPlatformContext`, `requireApplicationContext`, `requirePageAccess`, `requireActionPermission`, and `requireMutationContext` from `frontend/src/lib/platform/context.ts`. New app-specific tenant resolvers and company-required guards must not be introduced.

Migration `0020_platform_context_scope_mode.sql` adds the organization policy and makes Real Estate company scope nullable for organization-only operation.
