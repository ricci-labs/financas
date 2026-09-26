CREATE TRIGGER planned_occurrences_set_updated_at
  BEFORE UPDATE ON planned_occurrences
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
--> statement-breakpoint
ALTER TABLE planned_occurrences
  ALTER CONSTRAINT planned_occurrences_rule_fk DEFERRABLE INITIALLY DEFERRED;
--> statement-breakpoint
ALTER TABLE planned_occurrences
  ALTER CONSTRAINT planned_occurrences_matched_entry_fk DEFERRABLE INITIALLY DEFERRED;
