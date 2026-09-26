CREATE TRIGGER budget_lines_set_updated_at
  BEFORE UPDATE ON budget_lines
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
--> statement-breakpoint
ALTER TABLE budget_lines
  ALTER CONSTRAINT budget_lines_category_fk DEFERRABLE INITIALLY DEFERRED;
