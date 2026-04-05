import { createClient } from '@supabase/supabase-js';
import type { Database } from '../types/database.types';

// Service role client for bypassing RLS during secure API routes, server actions, or webhooks.
// NEVER import this file from client components — SUPABASE_SERVICE_ROLE_KEY is server-only.
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
