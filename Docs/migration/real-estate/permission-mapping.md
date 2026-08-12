# Permission mapping

The typed catalogue lives at `frontend/src/modules/real-estate/permissions/catalog.ts`. Navigation declarations are UX metadata; server-side permission checks remain mandatory. Read-only access must not be implemented by merely hiding mutation controls.
# Vertical slice permission mapping

The additive migration registers dashboard, property, unit, and unit-asset read/create/update/archive permissions under the existing `REAL_ESTATE` application and pages. It does not assign new permissions automatically to customer roles. Existing role assignments remain authoritative; read-only roles continue to receive only permissions already assigned to them.
