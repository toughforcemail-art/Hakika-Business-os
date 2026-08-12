# Migration rollback notes

Migrations are forward-only review units. Never run a blanket `DROP SCHEMA` against a shared or production project.

- `0001`: extensions and schemas are safe to retain; remove only in a disposable database after verifying no dependent objects.
- `0002`: archive test organizations first; only drop tenancy tables in a disposable database and in reverse dependency order.
- `0003`: remove seeded registry rows only if no memberships or subscriptions reference them; preserve application keys once deployed.
- `0004`: audit is append-only by contract. Do not delete production audit rows; disable a test schema only in a disposable project.
- `0005`: preserve callbacks and transaction history. Any correction must be compensating data, never deletion.
- `0006`: revoke policies only during a controlled maintenance window after confirming replacement policies exist.
- `0007`: seeds are idempotent and should generally remain. Correct labels with reviewed updates, not destructive rollback.
- `0008`: preserve invoices, payments, callbacks and portal sessions; correct financial data with compensating rows and revoke expired preview sessions rather than deleting history.
- `0009`: policy changes require a replacement-policy review and a denied cross-tenant test before any policy is removed.
