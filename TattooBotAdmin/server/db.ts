// server/db.ts
import pkg from "pg";
import { drizzle } from "drizzle-orm/node-postgres";

const { Pool } = pkg as unknown as { Pool: any };

const DATABASE_URL =
  process.env.DATABASE_URL ||
  "postgresql://postgres:postgres@db:5432/tattooadmin";

export const pool = new Pool({ connectionString: DATABASE_URL });
export const db = drizzle(pool);
export type DB = typeof db;
