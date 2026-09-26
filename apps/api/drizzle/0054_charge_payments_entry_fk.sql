ALTER TABLE charge_payments
  ADD CONSTRAINT charge_payments_entry_fk FOREIGN KEY (workspace_id, entry_id)
  REFERENCES journal_entries (workspace_id, id) DEFERRABLE INITIALLY DEFERRED;
