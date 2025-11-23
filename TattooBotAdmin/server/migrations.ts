// server/migrations.ts
import { sql } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";

function quoteIdent(name: string): string {
  return `"${name.replace(/"/g, "\"\"")}"`;
}

function quoteLiteral(value: string): string {
  return `'${value.replace(/'/g, "''")}'`;
}

async function addColumnIfMissing(
  db: NodePgDatabase<any>,
  table: string,
  column: string,
  definition: string,
): Promise<void> {
  const statement = `
    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = ${quoteLiteral(table)}
          AND column_name = ${quoteLiteral(column)}
      ) THEN
        ALTER TABLE ${quoteIdent(table)} ADD COLUMN ${definition};
      END IF;
    END $$;
  `;

  await db.execute(sql.raw(statement));
}

async function addConstraintIfMissing(
  db: NodePgDatabase<any>,
  table: string,
  constraint: string,
  definition: string,
): Promise<void> {
  const statement = `
    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints
        WHERE table_schema = 'public'
          AND table_name = ${quoteLiteral(table)}
          AND constraint_name = ${quoteLiteral(constraint)}
      ) THEN
        ALTER TABLE ${quoteIdent(table)} ADD CONSTRAINT ${quoteIdent(constraint)} ${definition};
      END IF;
    END $$;
  `;

  await db.execute(sql.raw(statement));
}

export async function runMigrations(db: NodePgDatabase<any>): Promise<void> {
  try { await db.execute(sql`CREATE EXTENSION IF NOT EXISTS "uuid-ossp";`); } catch {}

  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS masters (
      id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
      name text NOT NULL,
      nickname text NOT NULL,
      telegram text,
      specialization text NOT NULL,
      avatar text,
      is_active boolean NOT NULL DEFAULT true
    );
  `);

  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS services (
      id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
      name text NOT NULL,
      duration integer NOT NULL,
      price integer NOT NULL,
      description text NOT NULL
    );
  `);

  await db.execute(sql`UPDATE services SET description = '' WHERE description IS NULL;`);
  await db.execute(sql`ALTER TABLE services ALTER COLUMN description SET DEFAULT '';`);
  await db.execute(sql`ALTER TABLE services ALTER COLUMN description SET NOT NULL;`);

  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS bot_messages (
      id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
      key text NOT NULL UNIQUE,
      label text NOT NULL,
      value text NOT NULL,
      type text NOT NULL CHECK (type IN ('text','textarea'))
    );
  `);

  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS portfolio_items (
      id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
      url text NOT NULL,
      title text NOT NULL,
      description text NOT NULL DEFAULT '',
      master_id uuid REFERENCES masters(id) ON DELETE SET NULL,
      style text,
      media_type text NOT NULL DEFAULT 'image' CHECK (media_type IN ('image','video')),
      thumbnail text,
      created_at timestamptz NOT NULL DEFAULT now()
    );
  `);

  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS settings (
      id text PRIMARY KEY,
      bot_token text NOT NULL DEFAULT '',
      studio_name text NOT NULL,
      address text NOT NULL,
      yandex_map_url text,
      latitude text,
      longitude text,
      payment_methods text NOT NULL DEFAULT '',
      working_hours text NOT NULL DEFAULT '',
      updated_at timestamptz NOT NULL DEFAULT now()
    );
  `);

  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS bookings (
      id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
      client_name text NOT NULL,
      client_phone text NOT NULL,
      client_telegram text,
      client_username text,
      telegram_id text,
      master_id uuid NOT NULL REFERENCES masters(id) ON DELETE CASCADE,
      service_id uuid NOT NULL REFERENCES services(id) ON DELETE CASCADE,
      date date NOT NULL,
      time time NOT NULL,
      duration integer NOT NULL,
      status text NOT NULL CHECK (status IN ('pending','confirmed','cancelled')),
      notes text,
      created_at timestamptz NOT NULL DEFAULT now()
    );
  `);

  await addColumnIfMissing(db, "masters", "telegram", '"telegram" text');
  await addColumnIfMissing(db, "masters", "avatar", '"avatar" text');
  await addColumnIfMissing(db, "masters", "teletype_url", '"teletype_url" text');
  await addColumnIfMissing(db, "masters", "is_active", '"is_active" boolean DEFAULT true');
  await addColumnIfMissing(db, "masters", "created_at", '"created_at" timestamptz DEFAULT now()');
  await db.execute(sql`UPDATE masters SET is_active = true WHERE is_active IS NULL;`);
  await db.execute(sql`ALTER TABLE masters ALTER COLUMN is_active SET DEFAULT true;`);
  await db.execute(sql`ALTER TABLE masters ALTER COLUMN is_active SET NOT NULL;`);
  await db.execute(sql`UPDATE masters SET created_at = now() WHERE created_at IS NULL;`);
  await db.execute(sql`ALTER TABLE masters ALTER COLUMN created_at SET DEFAULT now();`);
  await db.execute(sql`ALTER TABLE masters ALTER COLUMN created_at SET NOT NULL;`);
  await db.execute(sql`ALTER TABLE masters ALTER COLUMN id SET DEFAULT uuid_generate_v4();`);

  await addColumnIfMissing(db, "settings", "yandex_map_url", '"yandex_map_url" text');
  await addColumnIfMissing(db, "settings", "latitude", '"latitude" text');
  await addColumnIfMissing(db, "settings", "longitude", '"longitude" text');
  await addColumnIfMissing(db, "settings", "payment_methods", '"payment_methods" text');
  await addColumnIfMissing(db, "settings", "working_hours", '"working_hours" text');
  await addColumnIfMissing(db, "settings", "updated_at", '"updated_at" timestamptz');
  await db.execute(sql`UPDATE settings SET payment_methods = '' WHERE payment_methods IS NULL;`);
  await db.execute(sql`UPDATE settings SET working_hours = '' WHERE working_hours IS NULL;`);
  await db.execute(sql`UPDATE settings SET updated_at = now() WHERE updated_at IS NULL;`);
  await db.execute(sql`ALTER TABLE settings ALTER COLUMN payment_methods SET DEFAULT '';`);
  await db.execute(sql`ALTER TABLE settings ALTER COLUMN payment_methods SET NOT NULL;`);
  await db.execute(sql`ALTER TABLE settings ALTER COLUMN working_hours SET DEFAULT '';`);
  await db.execute(sql`ALTER TABLE settings ALTER COLUMN working_hours SET NOT NULL;`);
  await db.execute(sql`ALTER TABLE settings ALTER COLUMN updated_at SET DEFAULT now();`);
  await db.execute(sql`ALTER TABLE settings ALTER COLUMN updated_at SET NOT NULL;`);

  await db.execute(sql`ALTER TABLE services ALTER COLUMN id SET DEFAULT uuid_generate_v4();`);
  await db.execute(sql`ALTER TABLE bot_messages ALTER COLUMN id SET DEFAULT uuid_generate_v4();`);
  await db.execute(sql`ALTER TABLE bookings ALTER COLUMN id SET DEFAULT uuid_generate_v4();`);
  await db.execute(sql`ALTER TABLE portfolio_items ALTER COLUMN id SET DEFAULT uuid_generate_v4();`);
  await addColumnIfMissing(db, "bookings", "client_username", '"client_username" text');
  await addColumnIfMissing(db, "bookings", "telegram_id", '"telegram_id" text');
  await addColumnIfMissing(db, "portfolio_items", "master_id", '"master_id" uuid');
  await addColumnIfMissing(db, "portfolio_items", "style", '"style" text');
  await addColumnIfMissing(db, "portfolio_items", "media_type", '"media_type" text');
  await addColumnIfMissing(db, "portfolio_items", "thumbnail", '"thumbnail" text');
  await addColumnIfMissing(db, "portfolio_items", "created_at", '"created_at" timestamptz');
  await addColumnIfMissing(db, "portfolio_items", "description", `"description" text DEFAULT ''`);
  await addColumnIfMissing(
    db,
    "portfolio_items",
    "attachments",
    `"attachments" jsonb DEFAULT '[]'::jsonb`,
  );
  await db.execute(sql`UPDATE portfolio_items SET description = '' WHERE description IS NULL;`);
  await db.execute(sql`UPDATE portfolio_items SET attachments = '[]'::jsonb WHERE attachments IS NULL;`);
  await db.execute(sql`ALTER TABLE portfolio_items ALTER COLUMN description SET DEFAULT '';`);
  await db.execute(sql`ALTER TABLE portfolio_items ALTER COLUMN description SET NOT NULL;`);
  await addColumnIfMissing(db, "portfolio_items", "image_url", `"image_url" text DEFAULT ''`);
  await db.execute(sql`UPDATE portfolio_items SET image_url = '' WHERE image_url IS NULL;`);
  await db.execute(sql`ALTER TABLE portfolio_items ALTER COLUMN image_url SET DEFAULT '';`);
  await db.execute(sql`UPDATE portfolio_items SET media_type = 'image' WHERE media_type IS NULL;`);
  await db.execute(sql`UPDATE portfolio_items SET created_at = now() WHERE created_at IS NULL;`);
  await db.execute(sql`ALTER TABLE portfolio_items ALTER COLUMN media_type SET DEFAULT 'image';`);
  await db.execute(sql`ALTER TABLE portfolio_items ALTER COLUMN media_type SET NOT NULL;`);
  await db.execute(sql`ALTER TABLE portfolio_items ALTER COLUMN created_at SET DEFAULT now();`);
  await db.execute(sql`ALTER TABLE portfolio_items ALTER COLUMN created_at SET NOT NULL;`);
  await addColumnIfMissing(db, "bot_messages", "image_url", '"image_url" text DEFAULT \'\'');
  await db.execute(sql`UPDATE bot_messages SET image_url = '' WHERE image_url IS NULL;`);
  await db.execute(sql`ALTER TABLE bot_messages ALTER COLUMN image_url SET DEFAULT '';`);
  await addConstraintIfMissing(
    db,
    "portfolio_items",
    "portfolio_items_master_id_fkey",
    "FOREIGN KEY (master_id) REFERENCES masters(id) ON DELETE SET NULL",
  );
  await addConstraintIfMissing(
    db,
    "portfolio_items",
    "portfolio_items_media_type_check",
    "CHECK (media_type IN ('image','video'))",
  );
}
