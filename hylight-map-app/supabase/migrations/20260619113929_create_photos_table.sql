CREATE TABLE photos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  storage_path TEXT NOT NULL,
  latitude DOUBLE PRECISION NOT NULL,
  longitude DOUBLE PRECISION NOT NULL,
  ai_description TEXT,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

CREATE INDEX photos_user_id_idx ON public.photos (user_id);

-- Enable Row Level Security (RLS) for the photos table
ALTER TABLE photos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Photos are viewable by authenticated users" ON photos FOR
SELECT TO authenticated USING (true);
CREATE POLICY "Users can insert their own photos" ON photos FOR
INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete their own photos" ON photos FOR DELETE TO authenticated USING (auth.uid() = user_id);
-- Grant base permissions to API roles (actual access is controlled by RLS)
GRANT ALL ON TABLE public.photos TO anon,
  authenticated,
  service_role;
