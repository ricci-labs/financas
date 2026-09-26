CREATE TRIGGER recurrence_rules_set_updated_at
  BEFORE UPDATE ON recurrence_rules
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
--> statement-breakpoint
ALTER TABLE recurrence_rules
  ALTER CONSTRAINT recurrence_rules_source_account_fk DEFERRABLE INITIALLY DEFERRED;
--> statement-breakpoint
ALTER TABLE recurrence_rules
  ALTER CONSTRAINT recurrence_rules_category_account_fk DEFERRABLE INITIALLY DEFERRED;
