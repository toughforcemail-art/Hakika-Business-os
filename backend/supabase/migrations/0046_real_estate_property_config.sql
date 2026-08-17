begin;

alter table real_estate.properties
  add column if not exists property_config jsonb not null default '{}'::jsonb;

commit;
