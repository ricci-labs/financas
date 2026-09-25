CREATE TYPE "public"."invoice_status" AS ENUM('future', 'open', 'closed');--> statement-breakpoint
CREATE TABLE "card_details" (
	"workspace_id" uuid NOT NULL,
	"account_id" uuid PRIMARY KEY NOT NULL,
	"account_kind" "account_kind" DEFAULT 'credit_card' NOT NULL,
	"closing_day" smallint NOT NULL,
	"due_day" smallint NOT NULL,
	"purchase_on_closing_day_goes_next" boolean DEFAULT true NOT NULL,
	"limit_cents" bigint,
	"holder_user_id" uuid,
	"payment_account_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "card_details_workspace_id_account_id_unique" UNIQUE("workspace_id","account_id"),
	CONSTRAINT "card_details_is_a_card" CHECK ("card_details"."account_kind" = 'credit_card'),
	CONSTRAINT "card_details_closing_day" CHECK ("card_details"."closing_day" between 1 and 31),
	CONSTRAINT "card_details_due_day" CHECK ("card_details"."due_day" between 1 and 31),
	CONSTRAINT "card_details_limit" CHECK ("card_details"."limit_cents" is null or "card_details"."limit_cents" > 0)
);
--> statement-breakpoint
ALTER TABLE "card_details" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "card_invoices" (
	"workspace_id" uuid NOT NULL,
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"card_account_id" uuid NOT NULL,
	"reference_month" date NOT NULL,
	"closing_on" date NOT NULL,
	"due_on" date NOT NULL,
	"status" "invoice_status" NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "card_invoices_workspace_id_id_unique" UNIQUE("workspace_id","id"),
	CONSTRAINT "card_invoices_workspace_id_id_card_unique" UNIQUE("workspace_id","id","card_account_id"),
	CONSTRAINT "card_invoices_card_month_unique" UNIQUE("workspace_id","card_account_id","reference_month"),
	CONSTRAINT "card_invoices_reference_month_first_day" CHECK (extract(day from "card_invoices"."reference_month") = 1),
	CONSTRAINT "card_invoices_due_after_closing" CHECK ("card_invoices"."due_on" > "card_invoices"."closing_on")
);
--> statement-breakpoint
ALTER TABLE "card_invoices" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "postings" DROP CONSTRAINT "postings_kinds_waiting_for_their_columns";--> statement-breakpoint
ALTER TABLE "postings" ADD COLUMN "invoice_id" uuid;--> statement-breakpoint
ALTER TABLE "card_details" ADD CONSTRAINT "card_details_holder_user_id_users_id_fk" FOREIGN KEY ("holder_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "card_details" ADD CONSTRAINT "card_details_account_fk" FOREIGN KEY ("workspace_id","account_id","account_kind") REFERENCES "public"."ledger_accounts"("workspace_id","id","kind") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "card_details" ADD CONSTRAINT "card_details_payment_account_fk" FOREIGN KEY ("workspace_id","payment_account_id") REFERENCES "public"."ledger_accounts"("workspace_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "card_invoices" ADD CONSTRAINT "card_invoices_card_fk" FOREIGN KEY ("workspace_id","card_account_id") REFERENCES "public"."card_details"("workspace_id","account_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "postings" ADD CONSTRAINT "postings_invoice_of_the_card_fk" FOREIGN KEY ("workspace_id","invoice_id","account_id") REFERENCES "public"."card_invoices"("workspace_id","id","card_account_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "postings" ADD CONSTRAINT "postings_invoice_exactly_on_cards" CHECK (("postings"."account_kind" = 'credit_card') = ("postings"."invoice_id" is not null));--> statement-breakpoint
ALTER TABLE "postings" ADD CONSTRAINT "postings_kinds_waiting_for_their_columns" CHECK ("postings"."account_kind" not in ('receivable', 'payable'));--> statement-breakpoint
CREATE POLICY "card_details_tenant_isolation" ON "card_details" AS PERMISSIVE FOR ALL TO "financas_app" USING ("card_details"."workspace_id" = app_current_workspace_id()) WITH CHECK ("card_details"."workspace_id" = app_current_workspace_id());--> statement-breakpoint
CREATE POLICY "card_invoices_tenant_isolation" ON "card_invoices" AS PERMISSIVE FOR ALL TO "financas_app" USING ("card_invoices"."workspace_id" = app_current_workspace_id()) WITH CHECK ("card_invoices"."workspace_id" = app_current_workspace_id());