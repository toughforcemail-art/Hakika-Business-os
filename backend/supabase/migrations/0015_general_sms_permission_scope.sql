begin;
update iam.permissions set application_id = null where permission_key in ('communications.sms.read','communications.sms.send');
commit;
