CREATE TRIGGER files_set_updated_at
  BEFORE UPDATE ON files
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
--> statement-breakpoint
ALTER TABLE entry_attachments
  ALTER CONSTRAINT entry_attachments_entry_fk DEFERRABLE INITIALLY DEFERRED;
--> statement-breakpoint
ALTER TABLE entry_attachments
  ALTER CONSTRAINT entry_attachments_file_fk DEFERRABLE INITIALLY DEFERRED;
--> statement-breakpoint
CREATE FUNCTION entry_attachments_follow_replaced_entry() RETURNS trigger
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path = public, pg_temp
  AS $$
DECLARE
  entry journal_entries;
  replacement_id uuid;
BEGIN
  SELECT * INTO entry FROM journal_entries WHERE id = NEW.id;
  IF NOT FOUND OR entry.deleted_at IS NULL THEN
    RETURN NULL;
  END IF;

  SELECT id INTO replacement_id FROM journal_entries
  WHERE workspace_id = entry.workspace_id AND replaces_entry_id = entry.id AND deleted_at IS NULL;

  IF replacement_id IS NULL THEN
    RETURN NULL;
  END IF;

  INSERT INTO entry_attachments (workspace_id, entry_id, file_id, attached_by_user_id, created_at)
  SELECT workspace_id, replacement_id, file_id, attached_by_user_id, created_at
  FROM entry_attachments
  WHERE workspace_id = entry.workspace_id AND entry_id = entry.id
  ON CONFLICT DO NOTHING;

  DELETE FROM entry_attachments
  WHERE workspace_id = entry.workspace_id AND entry_id = entry.id;

  RETURN NULL;
END
$$;
--> statement-breakpoint
CREATE CONSTRAINT TRIGGER entry_attachments_follow_replaced_entry
  AFTER UPDATE OF deleted_at ON journal_entries
  DEFERRABLE INITIALLY DEFERRED
  FOR EACH ROW
  WHEN (OLD.deleted_at IS NULL AND NEW.deleted_at IS NOT NULL)
  EXECUTE FUNCTION entry_attachments_follow_replaced_entry();
