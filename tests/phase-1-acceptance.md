# Phase 1 acceptance plan

- Public routes render independently: `/`, `/products`, `/pricing`, `/security`, `/about`, `/contact`, `/support`, legal routes.
- Authenticated landing route is `/apps`; each card displays entitlement state and only active/trial cards have an Open action.
- Platform Admin and Customer Admin remain distinct application keys and future route boundaries.
- Brand assets are loaded from `frontend/public/brands/<app>/`; Finance is explicitly marked as missing supplied artwork.
- Database dry run is run from `backend/`; no real push occurs before approval.
- pgTAP coverage must expand before push to cover two-tenant isolation, read-only mutation denial, invitation idempotency, billing idempotency, callback deduplication, allocations, split balancing and portal preview expiry.
