CREATE UNIQUE INDEX IF NOT EXISTS shares_owner_member_uniek
  ON public.shares (owner_id, member_id)
  WHERE member_id IS NOT NULL;

ALTER TABLE public.shares REPLICA IDENTITY FULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'shares'
  ) THEN
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.shares';
  END IF;
END $$;