CREATE TYPE "public"."notification_kind" AS ENUM('bill_reminder', 'invoice_reminder', 'charge', 'charge_reminder', 'budget_alert', 'variable_income_suggestion', 'digest');--> statement-breakpoint
CREATE TYPE "public"."notification_status" AS ENUM('pending', 'sending', 'sent', 'failed', 'cancelled');--> statement-breakpoint
CREATE TABLE "notification_outbox" (
	"workspace_id" uuid NOT NULL,
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"recipient_user_id" uuid,
	"recipient_contact_id" uuid,
	"channel" "notification_channel" NOT NULL,
	"kind" "notification_kind" NOT NULL,
	"payload" jsonb NOT NULL,
	"scheduled_for" timestamp with time zone NOT NULL,
	"status" "notification_status" DEFAULT 'pending' NOT NULL,
	"attempts" smallint DEFAULT 0 NOT NULL,
	"last_error" text,
	"sent_at" timestamp with time zone,
	"dedupe_key" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "notification_outbox_workspace_id_id_unique" UNIQUE("workspace_id","id"),
	CONSTRAINT "notification_outbox_dedupe_unique" UNIQUE("workspace_id","dedupe_key"),
	CONSTRAINT "notification_outbox_one_recipient" CHECK (num_nonnulls("notification_outbox"."recipient_user_id", "notification_outbox"."recipient_contact_id") = 1),
	CONSTRAINT "notification_outbox_attempts" CHECK ("notification_outbox"."attempts" >= 0),
	CONSTRAINT "notification_outbox_sent_at" CHECK (("notification_outbox"."status" = 'sent') = ("notification_outbox"."sent_at" is not null))
);
--> statement-breakpoint
ALTER TABLE "notification_outbox" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "notification_outbox" ADD CONSTRAINT "notification_outbox_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notification_outbox" ADD CONSTRAINT "notification_outbox_recipient_user_id_users_id_fk" FOREIGN KEY ("recipient_user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notification_outbox" ADD CONSTRAINT "notification_outbox_contact_fk" FOREIGN KEY ("workspace_id","recipient_contact_id") REFERENCES "public"."contacts"("workspace_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "notification_outbox_due_index" ON "notification_outbox" USING btree ("status","scheduled_for");--> statement-breakpoint
CREATE POLICY "notification_outbox_tenant_isolation" ON "notification_outbox" AS PERMISSIVE FOR ALL TO "financas_app" USING ("notification_outbox"."workspace_id" = app_current_workspace_id()) WITH CHECK ("notification_outbox"."workspace_id" = app_current_workspace_id());