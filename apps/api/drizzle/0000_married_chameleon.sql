CREATE TABLE "documents" (
	"id" uuid PRIMARY KEY NOT NULL,
	"original_name" text NOT NULL,
	"storage_key" text NOT NULL,
	"sha256" text NOT NULL,
	"mime_type" text DEFAULT 'application/pdf' NOT NULL,
	"size_bytes" bigint NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "documents_storage_key_unique" UNIQUE("storage_key"),
	CONSTRAINT "documents_sha256_unique" UNIQUE("sha256")
);
