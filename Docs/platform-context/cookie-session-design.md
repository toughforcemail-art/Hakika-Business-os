# Cookie and session design

Context cookies are secure, same-origin, HttpOnly, SameSite=Lax cookies containing only opaque IDs. They are revalidated against current memberships on every server resolution. No permissions, role lists, organization names, Supabase keys, or ImageKit private keys are stored in browser storage.
