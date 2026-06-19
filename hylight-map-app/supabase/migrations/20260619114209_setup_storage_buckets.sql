-- Create a storage bucket for photos
INSERT INTO storage.buckets (id, name, public)
VALUES ('photos', 'photos', true) ON CONFLICT DO NOTHING;
-- Enable Row Level Security (RLS) for the storage.objects table
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public Access for photos bucket" ON storage.objects FOR
SELECT USING (bucket_id = 'photos');
CREATE POLICY "Authenticated users can upload photos" ON storage.objects FOR
INSERT TO authenticated WITH CHECK (
    bucket_id = 'photos'
    AND auth.uid() = owner
  );
