begin;
grant select, update on platform.notifications to authenticated;
grant select, insert, update on platform.notification_preferences to authenticated;
commit;
