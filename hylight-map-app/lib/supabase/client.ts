import { env } from '@/lib/env';
import { createBrowserClient } from '@supabase/ssr';

// Create a Supabase client for use in Client Components
export function createClient() {
  return createBrowserClient(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
  );
}
