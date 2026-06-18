import { z } from 'zod';

// Define the schema for environment variables
const envSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.string().startsWith('https://'),
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: z.string().min(1),
});

// Parse and validate the environment variables
const _env = envSchema.safeParse({
  NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
});

if (!_env.success) {
  console.error('❌ Invalid environment variables:', z.treeifyError(_env.error));
  throw new Error('Invalid environment variables');
}

// Export the validated environment variables
export const env = _env.data;
