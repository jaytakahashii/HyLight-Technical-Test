CREATE TABLE comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  photo_id UUID NOT NULL REFERENCES photos(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);
-- Enable Row Level Security (RLS) for the comments table
ALTER TABLE comments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Comments are viewable by authenticated users" ON comments FOR
SELECT TO authenticated USING (true);
CREATE POLICY "Users can insert their own comments" ON comments FOR
INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete their own comments" ON comments FOR DELETE TO authenticated USING (auth.uid() = user_id);
-- Grant base permissions to API roles (actual access is controlled by RLS)
GRANT ALL ON TABLE public.comments TO anon,
  authenticated,
  service_role;
