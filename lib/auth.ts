import { createServerClient } from '@/lib/supabase-server';
import type { SupabaseClient, User } from '@supabase/supabase-js';
import type { Database } from '@/types/database.types';

/**
 * Creates a server Supabase client and resolves the current user.
 * Returns { user: null } if not authenticated — callers handle the 401.
 */
export async function requireAuth(): Promise<{
  user: User | null;
  supabase: SupabaseClient<Database>;
}> {
  const supabase = createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  return { user, supabase };
}
