import { createBrowserClient as createClientComponentClient } from '@supabase/ssr';
import type { Database } from '../types/database.types';

// Browser client for use inside Client Components.
// It automatically picks up NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY
// from your environment parameters.
export const createBrowserClient = () => createClientComponentClient<Database>(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

// Server-only clients:
// - Admin (service role): import supabaseAdmin from '@/lib/supabase-admin'
// - Server Component / middleware: import createServerClient from '@/lib/supabase-server'
