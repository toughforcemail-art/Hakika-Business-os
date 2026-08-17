alter table real_estate.units
  add column if not exists electricity_bill_amount numeric(14,2),
  add column if not exists water_bill_amount numeric(14,2),
  add column if not exists keys_deposit_amount numeric(14,2),
  add column if not exists rent_deposit_amount numeric(14,2);
