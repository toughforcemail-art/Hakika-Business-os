# Data dependency mapping

Future repositories must receive trusted server context containing user, organization, company and application identity. Browser-provided scope identifiers must not select tenant data. Totals and rows must use the same scoped query.
# Vertical slice data dependencies

Properties depend on canonical organization/company context. Units depend on a property with matching organization/company composite keys. Unit assets depend on a unit and property with matching tenant context. Directory counts use active rows only and are not derived from planned counts. Audit events depend on the existing `audit.events` foundation.
