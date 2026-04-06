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

async function getOwnerSeller(userId: string) {
  const { data: seller } = await supabaseAdmin
    .from("sellers").select("id").eq("user_id", userId).single();
  if (!seller) return null;

  const { data: callerMember } = await supabaseAdmin
    .from("store_members").select("role")
    .eq("seller_id", seller.id).eq("user_id", userId).single();
  if (callerMember?.role !== "owner") return null;
  return seller;
}

// PATCH — change role
export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  try {
    const supabase = getSupabase();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const seller = await getOwnerSeller(user.id);
    if (!seller) return NextResponse.json({ error: "Owner access required" }, { status: 403 });

    const { role, custom_role_id } = await request.json();
    if (!role) return NextResponse.json({ error: "Role is required" }, { status: 400 });

    const { error } = await supabaseAdmin
      .from("store_members")
      .update({ role, custom_role_id: custom_role_id ?? null })
      .eq("id", params.id)
      .eq("seller_id", seller.id)
      .neq("role", "owner"); // Cannot change owner role

    if (error) throw error;
    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Error" }, { status: 500 });
  }
}

// DELETE — deactivate member (soft delete)
export async function DELETE(request: Request, { params }: { params: { id: string } }) {
  try {
    const supabase = getSupabase();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const seller = await getOwnerSeller(user.id);
    if (!seller) return NextResponse.json({ error: "Owner access required" }, { status: 403 });

    const { error } = await supabaseAdmin
      .from("store_members")
      .update({ is_active: false })
      .eq("id", params.id)
      .eq("seller_id", seller.id)
      .neq("role", "owner"); // Cannot remove owner

    if (error) throw error;
    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Error" }, { status: 500 });
  }
}
