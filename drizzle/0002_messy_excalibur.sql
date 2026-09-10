CREATE TABLE "calendar_events" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"owner_id" bigint NOT NULL,
	"title" text NOT NULL,
	"content" jsonb NOT NULL
);
--> statement-breakpoint
CREATE TABLE "calendar_sharing" (
	"user_id" bigint NOT NULL,
	"shared_with" bigint[] NOT NULL,
	CONSTRAINT "calendar_sharing_user_id_unique" UNIQUE("user_id")
);
--> statement-breakpoint
ALTER TABLE "calendar_events" ADD CONSTRAINT "calendar_events_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "calendar_sharing" ADD CONSTRAINT "calendar_sharing_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "calendar_events_owner_id_idx" ON "calendar_events" USING btree ("owner_id");