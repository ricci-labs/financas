CREATE FUNCTION journal_entries_replacement_not_both_active() RETURNS trigger
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path = public, pg_temp
  AS $$
DECLARE
  entry journal_entries;
BEGIN
  SELECT * INTO entry FROM journal_entries WHERE id = NEW.id;
  IF NOT FOUND OR entry.deleted_at IS NOT NULL THEN
    RETURN NULL;
  END IF;

  IF EXISTS (
    SELECT 1 FROM journal_entries
    WHERE workspace_id = entry.workspace_id AND id = entry.replaces_entry_id AND deleted_at IS NULL
  ) THEN
    RAISE EXCEPTION 'Entry % and the entry it replaces can''t both be active', entry.id
      USING ERRCODE = 'check_violation';
  END IF;

  IF EXISTS (
    SELECT 1 FROM journal_entries
    WHERE workspace_id = entry.workspace_id AND replaces_entry_id = entry.id AND deleted_at IS NULL
  ) THEN
    RAISE EXCEPTION 'Entry % was replaced by an active entry', entry.id
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NULL;
END
$$;
--> statement-breakpoint
CREATE CONSTRAINT TRIGGER journal_entries_replacement_not_both_active
  AFTER INSERT OR UPDATE OF deleted_at ON journal_entries
  DEFERRABLE INITIALLY DEFERRED
  FOR EACH ROW EXECUTE FUNCTION journal_entries_replacement_not_both_active();
