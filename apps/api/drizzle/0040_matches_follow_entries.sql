CREATE FUNCTION planned_occurrences_follow_deleted_entry() RETURNS trigger
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

  IF replacement_id IS NOT NULL THEN
    UPDATE planned_occurrences SET matched_entry_id = replacement_id
    WHERE workspace_id = entry.workspace_id AND matched_entry_id = entry.id;
  ELSE
    UPDATE planned_occurrences SET status = 'pending', matched_entry_id = NULL
    WHERE workspace_id = entry.workspace_id AND matched_entry_id = entry.id;
  END IF;

  RETURN NULL;
END
$$;
--> statement-breakpoint
CREATE CONSTRAINT TRIGGER planned_occurrences_follow_deleted_entry
  AFTER UPDATE OF deleted_at ON journal_entries
  DEFERRABLE INITIALLY DEFERRED
  FOR EACH ROW
  WHEN (OLD.deleted_at IS NULL AND NEW.deleted_at IS NOT NULL)
  EXECUTE FUNCTION planned_occurrences_follow_deleted_entry();
