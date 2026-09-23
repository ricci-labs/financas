CREATE TABLE "invitations" (
	"workspace_id" uuid NOT NULL,
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"email" text,
	"phone_e164" text,
	"role_id" uuid NOT NULL,
	"token_hash" text NOT NULL,
	"invited_by_user_id" uuid NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"accepted_at" timestamp with time zone,
	"accepted_by_user_id" uuid,
	"deleted_at" timestamp with time zone,
	"deleted_by_user_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "invitations_token_hash_unique" UNIQUE("token_hash"),
	CONSTRAINT "invitations_one_contact" CHECK (num_nonnulls("invitations"."email", "invitations"."phone_e164") = 1),
	CONSTRAINT "invitations_email_format" CHECK ("invitations"."email" is null or "invitations"."email" ~ '^[^@[:space:]]+@[^@[:space:]]+$'),
	CONSTRAINT "invitations_phone_format" CHECK ("invitations"."phone_e164" is null or "invitations"."phone_e164" ~ '^[+][1-9][0-9]{7,14}$'),
	CONSTRAINT "invitations_acceptance_pair" CHECK (("invitations"."accepted_at" is null) = ("invitations"."accepted_by_user_id" is null)),
	CONSTRAINT "invitations_expiry_after_creation" CHECK ("invitations"."expires_at" > "invitations"."created_at")
);
--> statement-breakpoint
ALTER TABLE "invitations" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "invitations" ADD CONSTRAINT "invitations_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invitations" ADD CONSTRAINT "invitations_invited_by_user_id_users_id_fk" FOREIGN KEY ("invited_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invitations" ADD CONSTRAINT "invitations_accepted_by_user_id_users_id_fk" FOREIGN KEY ("accepted_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invitations" ADD CONSTRAINT "invitations_deleted_by_user_id_users_id_fk" FOREIGN KEY ("deleted_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invitations" ADD CONSTRAINT "invitations_role_fk" FOREIGN KEY ("workspace_id","role_id") REFERENCES "public"."roles"("workspace_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "invitations_pending_email_unique" ON "invitations" USING btree ("workspace_id",lower("email")) WHERE "invitations"."email" is not null and "invitations"."accepted_at" is null and "invitations"."deleted_at" is null;--> statement-breakpoint
CREATE UNIQUE INDEX "invitations_pending_phone_unique" ON "invitations" USING btree ("workspace_id","phone_e164") WHERE "invitations"."phone_e164" is not null and "invitations"."accepted_at" is null and "invitations"."deleted_at" is null;--> statement-breakpoint
CREATE POLICY "invitations_tenant_isolation" ON "invitations" AS PERMISSIVE FOR ALL TO "financas_app" USING ("invitations"."workspace_id" = app_current_workspace_id()) WITH CHECK ("invitations"."workspace_id" = app_current_workspace_id());