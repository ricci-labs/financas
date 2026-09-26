CREATE TYPE "public"."charge_status" AS ENUM('draft', 'sent', 'partially_paid', 'paid', 'cancelled');--> statement-breakpoint
CREATE TABLE "charge_items" (
	"workspace_id" uuid NOT NULL,
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"charge_id" uuid NOT NULL,
	"posting_id" uuid NOT NULL,
	"amount_cents" bigint NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "charge_items_charge_posting_unique" UNIQUE("charge_id","posting_id"),
	CONSTRAINT "charge_items_amount" CHECK ("charge_items"."amount_cents" > 0)
);
--> statement-breakpoint
ALTER TABLE "charge_items" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "charges" (
	"workspace_id" uuid NOT NULL,
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"contact_id" uuid NOT NULL,
	"amount_cents" bigint NOT NULL,
	"due_on" date,
	"status" charge_status DEFAULT 'draft' NOT NULL,
	"message_text" text NOT NULL,
	"pix_payload" text,
	"sent_at" timestamp with time zone,
	"last_reminded_at" timestamp with time zone,
	"created_by_user_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "charges_workspace_id_id_unique" UNIQUE("workspace_id","id"),
	CONSTRAINT "charges_amount" CHECK ("charges"."amount_cents" > 0),
	CONSTRAINT "charges_sent_when_sent" CHECK ("charges"."status" = 'draft' or "charges"."status" = 'cancelled' or "charges"."sent_at" is not null)
);
--> statement-breakpoint
ALTER TABLE "charges" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "charge_items" ADD CONSTRAINT "charge_items_charge_fk" FOREIGN KEY ("workspace_id","charge_id") REFERENCES "public"."charges"("workspace_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "charges" ADD CONSTRAINT "charges_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "charges" ADD CONSTRAINT "charges_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "charges" ADD CONSTRAINT "charges_contact_fk" FOREIGN KEY ("workspace_id","contact_id") REFERENCES "public"."contacts"("workspace_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "postings" ADD CONSTRAINT "postings_workspace_id_id_unique" UNIQUE("workspace_id","id");--> statement-breakpoint
CREATE POLICY "charge_items_tenant_isolation" ON "charge_items" AS PERMISSIVE FOR ALL TO "financas_app" USING ("charge_items"."workspace_id" = app_current_workspace_id()) WITH CHECK ("charge_items"."workspace_id" = app_current_workspace_id());--> statement-breakpoint
CREATE POLICY "charges_tenant_isolation" ON "charges" AS PERMISSIVE FOR ALL TO "financas_app" USING ("charges"."workspace_id" = app_current_workspace_id()) WITH CHECK ("charges"."workspace_id" = app_current_workspace_id());