ALTER TABLE "postings" DROP CONSTRAINT "postings_kinds_waiting_for_their_columns";--> statement-breakpoint
ALTER TABLE "postings" ADD COLUMN "contact_id" uuid;--> statement-breakpoint
ALTER TABLE "postings" ADD CONSTRAINT "postings_contact_fk" FOREIGN KEY ("workspace_id","contact_id") REFERENCES "public"."contacts"("workspace_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "postings" ADD CONSTRAINT "postings_contact_exactly_on_what_contacts_owe" CHECK (("postings"."account_kind" in ('receivable', 'payable')) = ("postings"."contact_id" is not null));