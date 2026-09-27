CREATE TABLE "charge_attachments" (
	"workspace_id" uuid NOT NULL,
	"charge_id" uuid NOT NULL,
	"file_id" uuid NOT NULL,
	"attached_by_user_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "charge_attachments_pk" PRIMARY KEY("workspace_id","charge_id","file_id")
);
--> statement-breakpoint
ALTER TABLE "charge_attachments" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "charge_attachments" ADD CONSTRAINT "charge_attachments_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "charge_attachments" ADD CONSTRAINT "charge_attachments_attached_by_user_id_users_id_fk" FOREIGN KEY ("attached_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "charge_attachments" ADD CONSTRAINT "charge_attachments_charge_fk" FOREIGN KEY ("workspace_id","charge_id") REFERENCES "public"."charges"("workspace_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "charge_attachments" ADD CONSTRAINT "charge_attachments_file_fk" FOREIGN KEY ("workspace_id","file_id") REFERENCES "public"."files"("workspace_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "charge_attachments_file_idx" ON "charge_attachments" USING btree ("workspace_id","file_id");--> statement-breakpoint
CREATE POLICY "charge_attachments_tenant_isolation" ON "charge_attachments" AS PERMISSIVE FOR ALL TO "financas_app" USING ("charge_attachments"."workspace_id" = app_current_workspace_id()) WITH CHECK ("charge_attachments"."workspace_id" = app_current_workspace_id());