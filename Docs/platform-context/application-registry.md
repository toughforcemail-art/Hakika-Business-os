# Application registry

The canonical registry is `frontend/src/lib/platform/application-registry.ts`. Application keys are `PLATFORM_ADMIN`, `CUSTOMER_ADMIN`, `REAL_ESTATE`, `HR`, `FINANCE`, and `TOUGHFORCE`. Navigation, authorization, provisioning, and application routing should reference these keys rather than maintaining independent mappings.
