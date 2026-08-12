# Real Estate module boundary

This directory is the new Real Estate vertical slice. Routes remain thin adapters and existing authentication, launcher, application-access, RLS, Redis and `app-mfa` infrastructure remains authoritative.

The module currently contains contracts and empty-state UI foundations only. It does not import legacy data, fabricate totals, or expose mutation actions. Future services must receive `RealEstateTenantContext` from the server and must not accept organization/company/application identity from browser form data.
