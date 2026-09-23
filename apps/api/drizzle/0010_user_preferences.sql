CREATE TYPE "public"."notification_channel" AS ENUM('whatsapp', 'email');--> statement-breakpoint
CREATE TABLE "user_preferences" (
	"user_id" uuid PRIMARY KEY NOT NULL,
	"language" text DEFAULT 'pt-BR' NOT NULL,
	"quiet_hours_start" time,
	"quiet_hours_end" time,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "user_preferences_language" CHECK ("user_preferences"."language" ~ '^[a-z]{2}(-[A-Z]{2})?$'),
	CONSTRAINT "user_preferences_quiet_hours_pair" CHECK (("user_preferences"."quiet_hours_start" is null) = ("user_preferences"."quiet_hours_end" is null))
);
--> statement-breakpoint
ALTER TABLE "user_preferences" ADD CONSTRAINT "user_preferences_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;