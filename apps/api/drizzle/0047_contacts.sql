CREATE TABLE "contacts" (
	"workspace_id" uuid NOT NULL,
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"name" text NOT NULL,
	"phone_e164" text,
	"pix_key" text,
	"notes" text,
	"opted_out_at" timestamp with time zone,
	"archived_at" timestamp with time zone,
	"deleted_at" timestamp with time zone,
	"deleted_by_user_id" uuid,
	"delete_reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "contacts_workspace_id_id_unique" UNIQUE("workspace_id","id"),
	CONSTRAINT "contacts_name" CHECK (length(trim("contacts"."name")) between 1 and 80),
	CONSTRAINT "contacts_phone_e164" CHECK ("contacts"."phone_e164" is null or "contacts"."phone_e164" ~ '^[+][1-9][0-9]{7,14}$'),
	CONSTRAINT "contacts_pix_key" CHECK ("contacts"."pix_key" is null or length("contacts"."pix_key") between 1 and 77),
	CONSTRAINT "contacts_notes" CHECK ("contacts"."notes" is null or length("contacts"."notes") <= 500)
);
--> statement-breakpoint
ALTER TABLE "contacts" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "contacts" ADD CONSTRAINT "contacts_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contacts" ADD CONSTRAINT "contacts_deleted_by_user_id_users_id_fk" FOREIGN KEY ("deleted_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "contacts_one_per_phone" ON "contacts" USING btree ("workspace_id","phone_e164") WHERE "contacts"."phone_e164" is not null and "contacts"."deleted_at" is null;--> statement-breakpoint
CREATE POLICY "contacts_tenant_isolation" ON "contacts" AS PERMISSIVE FOR ALL TO "financas_app" USING ("contacts"."workspace_id" = app_current_workspace_id()) WITH CHECK ("contacts"."workspace_id" = app_current_workspace_id());