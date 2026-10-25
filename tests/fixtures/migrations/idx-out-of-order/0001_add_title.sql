ALTER TABLE "notes" ADD COLUMN "title" text;
--> statement-breakpoint
CREATE INDEX "notes_title_idx" ON "notes" ("title");
