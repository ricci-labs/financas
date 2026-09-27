CREATE TYPE "public"."file_source" AS ENUM('web', 'whatsapp');--> statement-breakpoint
CREATE TABLE "entry_attachments" (
	"workspace_id" uuid NOT NULL,
	"entry_id" uuid NOT NULL,
	"file_id" uuid NOT NULL,
	"attached_by_user_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "entry_attachments_pk" PRIMARY KEY("workspace_id","entry_id","file_id")
);
--> statement-breakpoint
ALTER TABLE "entry_attachments" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "files" (
	"workspace_id" uuid NOT NULL,
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"storage_key" text NOT NULL,
	"mime_type" text NOT NULL,
	"size_bytes" integer NOT NULL,
	"sha256" text NOT NULL,
	"original_name" text NOT NULL,
	"uploaded_by_user_id" uuid NOT NULL,
	"source" "file_source" NOT NULL,
	"deleted_at" timestamp with time zone,
	"deleted_by_user_id" uuid,
	"delete_reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "files_workspace_id_id_unique" UNIQUE("workspace_id","id"),
	CONSTRAINT "files_workspace_id_sha256_unique" UNIQUE("workspace_id","sha256"),
	CONSTRAINT "files_sha256" CHECK ("files"."sha256" ~ '^[0-9a-f]{64}$'),
	CONSTRAINT "files_storage_key" CHECK ("files"."storage_key" = "files"."workspace_id"::text || '/' || "files"."sha256"),
	CONSTRAINT "files_mime_type" CHECK ("files"."mime_type" in ('image/jpeg', 'image/png', 'image/webp', 'image/heic', 'application/pdf')),
	CONSTRAINT "files_size" CHECK ("files"."size_bytes" > 0),
	CONSTRAINT "files_original_name" CHECK (length("files"."original_name") between 1 and 255)
);
--> statement-breakpoint
ALTER TABLE "files" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "entry_attachments" ADD CONSTRAINT "entry_attachments_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "entry_attachments" ADD CONSTRAINT "entry_attachments_attached_by_user_id_users_id_fk" FOREIGN KEY ("attached_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "entry_attachments" ADD CONSTRAINT "entry_attachments_entry_fk" FOREIGN KEY ("workspace_id","entry_id") REFERENCES "public"."journal_entries"("workspace_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "entry_attachments" ADD CONSTRAINT "entry_attachments_file_fk" FOREIGN KEY ("workspace_id","file_id") REFERENCES "public"."files"("workspace_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "files" ADD CONSTRAINT "files_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "files" ADD CONSTRAINT "files_uploaded_by_user_id_users_id_fk" FOREIGN KEY ("uploaded_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "files" ADD CONSTRAINT "files_deleted_by_user_id_users_id_fk" FOREIGN KEY ("deleted_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "entry_attachments_file_idx" ON "entry_attachments" USING btree ("workspace_id","file_id");--> statement-breakpoint
CREATE POLICY "entry_attachments_tenant_isolation" ON "entry_attachments" AS PERMISSIVE FOR ALL TO "financas_app" USING ("entry_attachments"."workspace_id" = app_current_workspace_id()) WITH CHECK ("entry_attachments"."workspace_id" = app_current_workspace_id());--> statement-breakpoint
CREATE POLICY "files_tenant_isolation" ON "files" AS PERMISSIVE FOR ALL TO "financas_app" USING ("files"."workspace_id" = app_current_workspace_id()) WITH CHECK ("files"."workspace_id" = app_current_workspace_id());