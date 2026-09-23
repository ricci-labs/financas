CREATE FUNCTION app_current_workspace_id() RETURNS uuid
  LANGUAGE sql
  STABLE
  AS $$ SELECT nullif(current_setting('app.workspace_id', true), '')::uuid $$;
