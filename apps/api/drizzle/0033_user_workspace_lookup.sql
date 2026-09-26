CREATE FUNCTION user_workspace_ids(lookup_user_id uuid) RETURNS SETOF uuid
  LANGUAGE sql
  STABLE
  SECURITY DEFINER
  SET search_path = public, pg_temp
  AS $$
    SELECT memberships.workspace_id
    FROM memberships
    JOIN workspaces ON workspaces.id = memberships.workspace_id
    WHERE memberships.user_id = lookup_user_id
      AND memberships.deleted_at IS NULL
      AND workspaces.deleted_at IS NULL
  $$;
--> statement-breakpoint
REVOKE ALL ON FUNCTION user_workspace_ids(uuid) FROM PUBLIC;
--> statement-breakpoint
GRANT EXECUTE ON FUNCTION user_workspace_ids(uuid) TO financas_app;
