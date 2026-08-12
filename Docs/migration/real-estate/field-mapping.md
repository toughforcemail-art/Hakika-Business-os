# Field mapping

No fields are mapped before the legacy audit. Future mappings must identify source field, target field, type, requiredness, normalization, tenant ownership and evidence.
# Vertical slice field mapping

`properties` preserves the legacy `name`, `property_code`, `status`, `address`, and tenant columns while adding normalized location, planning, financial-default, management, utility, and inspection fields. `units` preserves `unit_number`, `unit_type`, `status`, and `monthly_rent_minor`, with normalized physical, utility, parking, notes, and archive fields. `planned_unit_count` is never used as an actual unit total.
