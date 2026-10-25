CREATE TABLE "probe_c" ("id" serial PRIMARY KEY NOT NULL, "a_id" integer REFERENCES "probe_a"("id"));
