-- Migration: Add teletype_url field to masters table safely

DO $$
BEGIN
  -- Проверяем, существует ли таблица masters
  IF EXISTS (SELECT 1 FROM information_schema.tables 
             WHERE table_name='masters') THEN

    -- Добавляем колонку только если её нет
    ALTER TABLE masters
      ADD COLUMN IF NOT EXISTS teletype_url TEXT;

  END IF;
END $$;