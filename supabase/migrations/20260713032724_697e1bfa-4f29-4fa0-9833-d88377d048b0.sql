
CREATE TABLE public.library_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  kind TEXT NOT NULL CHECK (kind IN ('artwork','wall')),
  name TEXT NOT NULL,
  storage_path TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.library_items TO authenticated;
GRANT ALL ON public.library_items TO service_role;
ALTER TABLE public.library_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own items select" ON public.library_items FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "own items insert" ON public.library_items FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own items update" ON public.library_items FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own items delete" ON public.library_items FOR DELETE USING (auth.uid() = user_id);
CREATE INDEX library_items_user_created_idx ON public.library_items (user_id, created_at DESC);
