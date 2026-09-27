CREATE TYPE "public"."audit_action" AS ENUM('create', 'update', 'archive', 'unarchive', 'delete', 'restore');--> statement-breakpoint
CREATE TYPE "public"."audit_source" AS ENUM('web', 'whatsapp', 'job', 'ops', 'system');--> statement-breakpoint
CREATE TABLE "audit_log" (
	"workspace_id" uuid NOT NULL,
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"at" timestamp with time zone DEFAULT now() NOT NULL,
	"actor_user_id" uuid,
	"source" "audit_source" NOT NULL,
	"trace_id" text,
	"action" "audit_action" NOT NULL,
	"table_name" text NOT NULL,
	"row_id" uuid NOT NULL,
	"before" jsonb,
	"after" jsonb
);
--> statement-breakpoint
ALTER TABLE "audit_log" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "audit_log" ADD CONSTRAINT "audit_log_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_log" ADD CONSTRAINT "audit_log_actor_user_id_users_id_fk" FOREIGN KEY ("actor_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "audit_log_timeline_idx" ON "audit_log" USING btree ("workspace_id","at","id");--> statement-breakpoint
CREATE INDEX "audit_log_row_idx" ON "audit_log" USING btree ("workspace_id","table_name","row_id");--> statement-breakpoint
CREATE POLICY "audit_log_read" ON "audit_log" AS PERMISSIVE FOR SELECT TO "financas_app" USING ("audit_log"."workspace_id" = app_current_workspace_id());--> statement-breakpoint
CREATE POLICY "audit_log_append" ON "audit_log" AS PERMISSIVE FOR INSERT TO "financas_app" WITH CHECK ("audit_log"."workspace_id" = app_current_workspace_id());