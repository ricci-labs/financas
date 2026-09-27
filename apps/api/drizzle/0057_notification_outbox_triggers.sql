CREATE TRIGGER notification_outbox_set_updated_at
  BEFORE UPDATE ON notification_outbox
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
--> statement-breakpoint
ALTER TABLE notification_outbox
  ALTER CONSTRAINT notification_outbox_contact_fk DEFERRABLE INITIALLY DEFERRED;
