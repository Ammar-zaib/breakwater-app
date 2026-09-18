import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

// One connection, reused across requests (serverless-friendly: postgres-js
// pools internally). DATABASE_URL comes from whatever Postgres you connect —
// see README for Supabase/Neon setup.
const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  // Thrown lazily (not at import time in most bundling setups) so builds
  // without a DB configured yet don't hard-fail.
  console.warn(
    "[breakwater] DATABASE_URL is not set — database calls will fail until it is."
  );
}

const client = postgres(connectionString ?? "", { prepare: false });

export const db = drizzle(client, { schema });
