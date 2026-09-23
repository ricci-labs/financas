CREATE FUNCTION invitation_workspace_id(lookup_token_hash text) RETURNS uuid
  LANGUAGE sql
  STABLE
  SECURITY DEFINER
  SET search_path = public, pg_temp
  AS $$ SELECT workspace_id FROM invitations WHERE token_hash = lookup_token_hash $$;
--> statement-breakpoint
REVOKE ALL ON FUNCTION invitation_workspace_id(text) FROM PUBLIC;
--> statement-breakpoint
GRANT EXECUTE ON FUNCTION invitation_workspace_id(text) TO financas_app;
