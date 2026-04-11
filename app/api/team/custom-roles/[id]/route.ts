import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase-admin";

// PATCH — edit custom role
export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  try {
    const { user, supabase } = await requireAuth();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { data: seller } = await supabase
      .from("sellers").select("id").eq("user_id", user.id).single();
    if (!seller) return NextResponse.json({ error: "Seller not found" }, { status: 404 });

    const { name, permissions } = await request.json();
    const { data: updated, error } = await supabaseAdmin
      .from("custom_roles")
      .update({ name: name?.trim(), permissions })
      .eq("id", params.id)
      .eq("seller_id", seller.id)
      .select().single();

    if (error) throw error;
    return NextResponse.json({ role: updated });
  } catch (err: unknown) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Error" }, { status: 500 });
  }
}

// DELETE — delete custom role (reject if in use)
export async function DELETE(request: Request, { params }: { params: { id: string } }) {
  try {
    const { user, supabase } = await requireAuth();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { data: seller } = await supabase
      .from("sellers").select("id").eq("user_id", user.id).single();
    if (!seller) return NextResponse.json({ error: "Seller not found" }, { status: 404 });

    // Check if role is assigned to any active member
    const { count } = await supabaseAdmin
      .from("store_members")
      .select("id", { count: "exact", head: true })
      .eq("custom_role_id", params.id)
      .eq("is_active", true);

    if (count && count > 0) {
      return NextResponse.json({
        error: `Cannot delete — this role is assigned to ${count} active member${count > 1 ? "s" : ""}. Change their role first.`
      }, { status: 409 });
    }

    const { error } = await supabaseAdmin
      .from("custom_roles")
      .delete()
      .eq("id", params.id)
      .eq("seller_id", seller.id);

    if (error) throw error;
    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Error" }, { status: 500 });
  }
}
