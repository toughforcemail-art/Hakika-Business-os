begin;

alter table real_estate.units
  add column if not exists unit_config jsonb not null default '{}'::jsonb;

commit;
