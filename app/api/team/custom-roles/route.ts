import { NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { supabaseAdmin } from "@/lib/supabase-admin";
import type { Database } from "@/types/database.types";

function getSupabase() {
  const cookieStore = cookies();
  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { get(name) { return cookieStore.get(name)?.value; } } }
  );
}

// GET — list custom roles
export async function GET() {
  try {
    const supabase = getSupabase();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { data: seller } = await supabase
      .from("sellers").select("id").eq("user_id", user.id).single();
    if (!seller) return NextResponse.json({ error: "Seller not found" }, { status: 404 });

    const { data: roles, error } = await supabaseAdmin
      .from("custom_roles")
      .select("*")
      .eq("seller_id", seller.id)
      .order("created_at", { ascending: true });

    if (error) throw error;
    return NextResponse.json({ roles: roles ?? [] });
  } catch (err: unknown) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Error" }, { status: 500 });
  }
}

// POST — create custom role
export async function POST(request: Request) {
  try {
    const supabase = getSupabase();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { data: seller } = await supabase
      .from("sellers").select("id").eq("user_id", user.id).single();
    if (!seller) return NextResponse.json({ error: "Seller not found" }, { status: 404 });

    const { name, permissions } = await request.json();
    if (!name) return NextResponse.json({ error: "Role name is required" }, { status: 400 });

    const { data: newRole, error } = await supabaseAdmin
      .from("custom_roles")
      .insert({ seller_id: seller.id, name: name.trim(), permissions: permissions ?? {} })
      .select().single();

    if (error) throw error;
    return NextResponse.json({ role: newRole });
  } catch (err: unknown) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Error" }, { status: 500 });
  }
}
