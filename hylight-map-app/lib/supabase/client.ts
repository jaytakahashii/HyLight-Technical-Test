import { env } from '@/lib/env';
import { Database } from '@/lib/types/database.types';
import { createBrowserClient } from '@supabase/ssr';

// Create a Supabase client for use in Client Components
export function createClient() {
  return createBrowserClient<Database>(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
  );
}
