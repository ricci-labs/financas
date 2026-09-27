ALTER TABLE charge_attachments
  ALTER CONSTRAINT charge_attachments_charge_fk DEFERRABLE INITIALLY DEFERRED;
--> statement-breakpoint
ALTER TABLE charge_attachments
  ALTER CONSTRAINT charge_attachments_file_fk DEFERRABLE INITIALLY DEFERRED;
