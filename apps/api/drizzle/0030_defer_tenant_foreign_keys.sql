ALTER TABLE memberships
  ALTER CONSTRAINT memberships_role_fk DEFERRABLE INITIALLY DEFERRED;
--> statement-breakpoint
ALTER TABLE invitations
  ALTER CONSTRAINT invitations_role_fk DEFERRABLE INITIALLY DEFERRED;
--> statement-breakpoint
ALTER TABLE ledger_accounts
  ALTER CONSTRAINT ledger_accounts_parent_same_class_fk DEFERRABLE INITIALLY DEFERRED;
--> statement-breakpoint
ALTER TABLE journal_entries
  ALTER CONSTRAINT journal_entries_replaces_entry_fk DEFERRABLE INITIALLY DEFERRED;
