CREATE TYPE "public"."account_class" AS ENUM('asset', 'liability', 'income', 'expense', 'equity');--> statement-breakpoint
CREATE TYPE "public"."account_kind" AS ENUM('checking', 'savings', 'cash_wallet', 'investment', 'receivable', 'credit_card', 'loan', 'payable', 'income_category', 'expense_category', 'opening_balance');--> statement-breakpoint
CREATE TYPE "public"."income_nature" AS ENUM('fixed', 'variable');--> statement-breakpoint
CREATE TABLE "ledger_accounts" (
	"workspace_id" uuid NOT NULL,
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"parent_id" uuid,
	"kind" "account_kind" NOT NULL,
	"class" "account_class" GENERATED ALWAYS AS (case kind when 'checking' then 'asset'::account_class when 'savings' then 'asset'::account_class when 'cash_wallet' then 'asset'::account_class when 'investment' then 'asset'::account_class when 'receivable' then 'asset'::account_class when 'credit_card' then 'liability'::account_class when 'loan' then 'liability'::account_class when 'payable' then 'liability'::account_class when 'income_category' then 'income'::account_class when 'expense_category' then 'expense'::account_class when 'opening_balance' then 'equity'::account_class end) STORED NOT NULL,
	"name" text NOT NULL,
	"currency" char(3) NOT NULL,
	"income_nature" "income_nature",
	"owner_user_id" uuid,
	"is_system" boolean GENERATED ALWAYS AS (kind in ('receivable', 'payable', 'opening_balance')) STORED NOT NULL,
	"sort_order" smallint DEFAULT 0 NOT NULL,
	"color" text,
	"icon" text,
	"archived_at" timestamp with time zone,
	"deleted_at" timestamp with time zone,
	"deleted_by_user_id" uuid,
	"delete_reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ledger_accounts_workspace_id_id_unique" UNIQUE("workspace_id","id"),
	CONSTRAINT "ledger_accounts_workspace_id_id_class_unique" UNIQUE("workspace_id","id","class"),
	CONSTRAINT "ledger_accounts_not_own_parent" CHECK ("ledger_accounts"."parent_id" <> "ledger_accounts"."id"),
	CONSTRAINT "ledger_accounts_currency_iso" CHECK ("ledger_accounts"."currency" ~ '^[A-Z]{3}$'),
	CONSTRAINT "ledger_accounts_income_nature" CHECK (("ledger_accounts"."kind" = 'income_category') = ("ledger_accounts"."income_nature" is not null)),
	CONSTRAINT "ledger_accounts_system_at_root" CHECK (not "ledger_accounts"."is_system" or "ledger_accounts"."parent_id" is null)
);
--> statement-breakpoint
ALTER TABLE "ledger_accounts" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "ledger_accounts" ADD CONSTRAINT "ledger_accounts_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ledger_accounts" ADD CONSTRAINT "ledger_accounts_owner_user_id_users_id_fk" FOREIGN KEY ("owner_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ledger_accounts" ADD CONSTRAINT "ledger_accounts_deleted_by_user_id_users_id_fk" FOREIGN KEY ("deleted_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ledger_accounts" ADD CONSTRAINT "ledger_accounts_parent_same_class_fk" FOREIGN KEY ("workspace_id","parent_id","class") REFERENCES "public"."ledger_accounts"("workspace_id","id","class") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "ledger_accounts_sibling_name_unique" ON "ledger_accounts" USING btree ("workspace_id","class",coalesce("parent_id", '00000000-0000-0000-0000-000000000000'::uuid),lower("name")) WHERE "ledger_accounts"."deleted_at" is null;--> statement-breakpoint
CREATE UNIQUE INDEX "ledger_accounts_one_system_account_per_kind" ON "ledger_accounts" USING btree ("workspace_id","kind") WHERE "ledger_accounts"."is_system" and "ledger_accounts"."deleted_at" is null;--> statement-breakpoint
CREATE POLICY "ledger_accounts_tenant_isolation" ON "ledger_accounts" AS PERMISSIVE FOR ALL TO "financas_app" USING ("ledger_accounts"."workspace_id" = app_current_workspace_id()) WITH CHECK ("ledger_accounts"."workspace_id" = app_current_workspace_id());