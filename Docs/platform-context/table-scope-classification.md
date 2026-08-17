# Table scope classification

Classify each table as organization-only, organization-plus-optional-company, or company-required. Existing Real Estate operational tables are nullable at the company column so the organization-only default is representable. A future company-required table must declare that policy explicitly and use `requireMutationContext` with required scope.
