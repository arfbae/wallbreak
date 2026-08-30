CREATE TABLE public.generation_usage (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  images integer NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX generation_usage_user_created_idx ON public.generation_usage (user_id, created_at DESC);

GRANT SELECT ON public.generation_usage TO authenticated;
GRANT ALL ON public.generation_usage TO service_role;

ALTER TABLE public.generation_usage ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own generation usage"
ON public.generation_usage
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);
