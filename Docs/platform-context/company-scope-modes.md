# Company scope modes

`organization_only` means queries and mutations scope by organization and `company_id` is null. `optional` permits organization-wide access or a validated company selection. `required` requires a validated company before a page or mutation can proceed. The default is `organization_only`.
