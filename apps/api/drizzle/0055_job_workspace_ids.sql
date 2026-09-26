CREATE FUNCTION job_workspace_ids() RETURNS SETOF uuid
  LANGUAGE sql
  STABLE
  SECURITY DEFINER
  SET search_path = public, pg_temp
  AS $$
    SELECT id FROM workspaces
    WHERE deleted_at IS NULL AND archived_at IS NULL
    ORDER BY id
  $$;
--> statement-breakpoint
REVOKE ALL ON FUNCTION job_workspace_ids() FROM PUBLIC;
--> statement-breakpoint
GRANT EXECUTE ON FUNCTION job_workspace_ids() TO financas_app;
