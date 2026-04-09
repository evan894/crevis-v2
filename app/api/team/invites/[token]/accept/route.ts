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

export async function POST(
  request: Request,
  { params }: { params: { token: string } }
) {
  try {
    const { token } = params;
    const supabase = getSupabase();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    }

    // 1. Fetch and verify invite
    const { data: invite, error: inviteError } = await supabaseAdmin
      .from("store_invites")
      .select("*")
      .eq("token", token)
      .eq("status", "pending")
      .maybeSingle();

    if (inviteError || !invite) {
      return NextResponse.json({ error: "Invitation not found or expired" }, { status: 404 });
    }

    // Optional: Check if expires_at < now()
    if (new Date(invite.expires_at) < new Date()) {
      await supabaseAdmin.from("store_invites").update({ status: 'expired' }).eq("id", invite.id);
      return NextResponse.json({ error: "Invitation has expired" }, { status: 400 });
    }

    // 2. Add as member
    const { error: memberError } = await supabaseAdmin
      .from("store_members")
      .upsert({
        seller_id: invite.seller_id,
        user_id: user.id,
        role: invite.role,
        custom_role_id: invite.custom_role_id,
        is_active: true,
        added_by: invite.invited_by
      });

    if (memberError) {
        console.error("Member add error:", memberError);
        throw new Error("Could not join team");
    }

    // 3. Mark invite as accepted
    await supabaseAdmin
      .from("store_invites")
      .update({ status: 'accepted' })
      .eq("id", invite.id);

    return NextResponse.json({
      success: true,
      message: "Successfully joined the team"
    });

  } catch (err: unknown) {
    console.error("Invite accept error:", err);
    return NextResponse.json({ error: err instanceof Error ? err.message : "Error" }, { status: 500 });
  }
}
