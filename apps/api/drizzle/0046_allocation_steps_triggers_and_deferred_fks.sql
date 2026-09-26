CREATE TRIGGER allocation_steps_set_updated_at
  BEFORE UPDATE ON allocation_steps
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
--> statement-breakpoint
ALTER TABLE allocation_steps
  ALTER CONSTRAINT allocation_steps_goal_fk DEFERRABLE INITIALLY DEFERRED;
--> statement-breakpoint
ALTER TABLE allocation_steps
  ALTER CONSTRAINT allocation_steps_account_fk DEFERRABLE INITIALLY DEFERRED;
