alter table real_estate.properties
  add column if not exists electricity_bill_amount numeric(14,2),
  add column if not exists water_bill_amount numeric(14,2),
  add column if not exists keys_deposit_amount numeric(14,2);
