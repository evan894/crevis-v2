import { createBrowserClient as createClientComponentClient } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';
import type { Database } from '../types/database.types';

// Browser client for use inside Client Components.
// It automatically picks up NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY 
// from your environment parameters.
export const createBrowserClient = () => createClientComponentClient<Database>(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

// Service role client for bypassing RLS during secure API routes, server actions, or webhooks.
// NEVER expose this to the client side.
export const supabaseAdmin = createClient<Database>(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  }
);

// Server-only Supabase client is in lib/supabase-server.ts
// Import createServerClient from '@/lib/supabase-server' in Server Components only.
