# RLS matrix

All HR tables have RLS. Employee reads require active organization access plus `hr.employees.read`; employee writes require the corresponding action permission. Sensitive tables use separate permission keys. Company IDs are accepted only when validated by the centralized context and shared access function.
