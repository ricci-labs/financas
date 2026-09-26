CREATE TRIGGER charges_set_updated_at
  BEFORE UPDATE ON charges
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
--> statement-breakpoint
ALTER TABLE charges
  ALTER CONSTRAINT charges_contact_fk DEFERRABLE INITIALLY DEFERRED;
--> statement-breakpoint
ALTER TABLE charge_items
  ADD CONSTRAINT charge_items_posting_fk FOREIGN KEY (workspace_id, posting_id)
  REFERENCES postings (workspace_id, id) DEFERRABLE INITIALLY DEFERRED;
