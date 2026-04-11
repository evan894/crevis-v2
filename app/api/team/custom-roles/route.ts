import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase-admin";

// GET — list custom roles
export async function GET() {
  try {
    const { user, supabase } = await requireAuth();
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
    const { user, supabase } = await requireAuth();
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
