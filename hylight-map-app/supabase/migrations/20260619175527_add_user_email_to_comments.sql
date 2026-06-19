-- Add user_email column to comments table
ALTER TABLE public.comments
ADD COLUMN user_email TEXT NOT NULL DEFAULT 'unknown';
