import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";

let client: ReturnType<typeof postgres> | undefined;

export function getDb() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) throw new Error("DATABASE_URL is required to use the database");
  client ??= postgres(databaseUrl);
  return drizzle(client);
}
