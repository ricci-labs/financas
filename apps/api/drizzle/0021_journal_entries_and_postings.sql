CREATE TYPE "public"."entry_source" AS ENUM('web', 'whatsapp', 'job', 'import');--> statement-breakpoint
CREATE TYPE "public"."entry_type" AS ENUM('expense', 'income', 'card_purchase', 'transfer', 'invoice_payment', 'refund', 'settlement', 'adjustment', 'opening_balance');--> statement-breakpoint
CREATE TYPE "public"."payment_method" AS ENUM('pix', 'debit', 'credit', 'cash', 'boleto', 'bank_transfer', 'auto_debit', 'other');--> statement-breakpoint
CREATE TABLE "journal_entries" (
	"workspace_id" uuid NOT NULL,
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"occurred_on" date NOT NULL,
	"description" text NOT NULL,
	"entry_type" "entry_type" NOT NULL,
	"payment_method" "payment_method",
	"installment_count" smallint DEFAULT 1 NOT NULL,
	"spent_by_user_id" uuid,
	"source" "entry_source" NOT NULL,
	"created_by_user_id" uuid NOT NULL,
	"replaces_entry_id" uuid,
	"external_ref" text,
	"notes" text,
	"deleted_at" timestamp with time zone,
	"deleted_by_user_id" uuid,
	"delete_reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "journal_entries_workspace_id_id_unique" UNIQUE("workspace_id","id"),
	CONSTRAINT "journal_entries_installment_count" CHECK ("journal_entries"."installment_count" >= 1),
	CONSTRAINT "journal_entries_description" CHECK (length(trim("journal_entries"."description")) > 0),
	CONSTRAINT "journal_entries_not_replacing_itself" CHECK ("journal_entries"."replaces_entry_id" is null or "journal_entries"."replaces_entry_id" <> "journal_entries"."id")
);
--> statement-breakpoint
ALTER TABLE "journal_entries" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "postings" (
	"workspace_id" uuid NOT NULL,
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"entry_id" uuid NOT NULL,
	"line_no" smallint NOT NULL,
	"account_id" uuid NOT NULL,
	"account_kind" "account_kind" NOT NULL,
	"amount_cents" bigint NOT NULL,
	"effective_on" date NOT NULL,
	"installment_no" smallint,
	"memo" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "postings_entry_line_unique" UNIQUE("entry_id","line_no"),
	CONSTRAINT "postings_amount_not_zero" CHECK ("postings"."amount_cents" <> 0),
	CONSTRAINT "postings_line_no" CHECK ("postings"."line_no" >= 1),
	CONSTRAINT "postings_installment_no" CHECK ("postings"."installment_no" is null or "postings"."installment_no" >= 1),
	CONSTRAINT "postings_kinds_waiting_for_their_columns" CHECK ("postings"."account_kind" not in ('credit_card', 'receivable', 'payable'))
);
--> statement-breakpoint
ALTER TABLE "postings" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "journal_entries" ADD CONSTRAINT "journal_entries_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "journal_entries" ADD CONSTRAINT "journal_entries_spent_by_user_id_users_id_fk" FOREIGN KEY ("spent_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "journal_entries" ADD CONSTRAINT "journal_entries_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "journal_entries" ADD CONSTRAINT "journal_entries_deleted_by_user_id_users_id_fk" FOREIGN KEY ("deleted_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "journal_entries" ADD CONSTRAINT "journal_entries_replaces_entry_fk" FOREIGN KEY ("workspace_id","replaces_entry_id") REFERENCES "public"."journal_entries"("workspace_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "postings" ADD CONSTRAINT "postings_entry_fk" FOREIGN KEY ("workspace_id","entry_id") REFERENCES "public"."journal_entries"("workspace_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ledger_accounts" ADD CONSTRAINT "ledger_accounts_workspace_id_id_kind_unique" UNIQUE("workspace_id","id","kind");--> statement-breakpoint
ALTER TABLE "postings" ADD CONSTRAINT "postings_account_fk" FOREIGN KEY ("workspace_id","account_id","account_kind") REFERENCES "public"."ledger_accounts"("workspace_id","id","kind") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "journal_entries_external_ref_unique" ON "journal_entries" USING btree ("workspace_id","external_ref") WHERE "journal_entries"."external_ref" is not null;--> statement-breakpoint
CREATE POLICY "journal_entries_tenant_isolation" ON "journal_entries" AS PERMISSIVE FOR ALL TO "financas_app" USING ("journal_entries"."workspace_id" = app_current_workspace_id()) WITH CHECK ("journal_entries"."workspace_id" = app_current_workspace_id());--> statement-breakpoint
CREATE POLICY "postings_tenant_isolation" ON "postings" AS PERMISSIVE FOR ALL TO "financas_app" USING ("postings"."workspace_id" = app_current_workspace_id()) WITH CHECK ("postings"."workspace_id" = app_current_workspace_id());