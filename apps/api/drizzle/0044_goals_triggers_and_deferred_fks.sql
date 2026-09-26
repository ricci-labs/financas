CREATE TRIGGER goals_set_updated_at
  BEFORE UPDATE ON goals
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
--> statement-breakpoint
ALTER TABLE goals
  ALTER CONSTRAINT goals_account_fk DEFERRABLE INITIALLY DEFERRED;
