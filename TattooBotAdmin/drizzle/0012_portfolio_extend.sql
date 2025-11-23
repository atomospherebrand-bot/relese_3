-- Extend portfolio_items with relations & media type safely

DO $$
BEGIN
  -- Проверяем, существует ли таблица portfolio_items
  IF EXISTS (SELECT 1 FROM information_schema.tables 
             WHERE table_name='portfolio_items') THEN

    -- Добавляем колонки только если они не существуют
    ALTER TABLE portfolio_items
      ADD COLUMN IF NOT EXISTS master_id uuid NULL,
      ADD COLUMN IF NOT EXISTS style text NULL,
      ADD COLUMN IF NOT EXISTS media_type text DEFAULT 'image' NOT NULL,
      ADD COLUMN IF NOT EXISTS created_at timestamptz DEFAULT now() NOT NULL,
      ADD COLUMN IF NOT EXISTS teletype_url text NULL;

    -- Добавляем FK на masters, если такая таблица существует
    IF EXISTS (SELECT 1 FROM information_schema.tables 
               WHERE table_name='masters') THEN
      BEGIN
        ALTER TABLE portfolio_items
          ADD CONSTRAINT portfolio_items_master_id_fkey
          FOREIGN KEY (master_id) REFERENCES masters(id) ON DELETE SET NULL;
      EXCEPTION
        WHEN duplicate_object THEN NULL;
      END;
    END IF;

  END IF;
END $$;
