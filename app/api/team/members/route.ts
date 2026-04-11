import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { sendSlackDM } from "@/lib/slack";

// GET — list all members for current seller
export async function GET() {
  try {
    const { user, supabase } = await requireAuth();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { data: seller } = await supabase
      .from("sellers").select("id").eq("user_id", user.id).single();
    if (!seller) return NextResponse.json({ error: "Seller not found" }, { status: 404 });

    // Fetch all members — use admin to also get auth user info (email)
    const { data: members, error } = await supabaseAdmin
      .from("store_members")
      .select("id, role, custom_role_id, is_active, created_at, user_id, added_by")
      .eq("seller_id", seller.id)
      .order("created_at", { ascending: true });

    if (error) throw error;

    // Enrich with user emails from auth.users
    const { data: authData } = await supabaseAdmin.auth.admin.listUsers({ perPage: 1000 });
    const usersMap = new Map(authData?.users?.map(u => [u.id, u]) ?? []);

    const enriched = (members ?? []).map(m => {
      const authUser = usersMap.get(m.user_id);
      return {
        ...m,
        email: authUser?.email ?? "Unknown",
        display_name: authUser?.user_metadata?.full_name ?? authUser?.email?.split("@")[0] ?? "Unknown",
      };
    });

    return NextResponse.json({ members: enriched });
  } catch (err: unknown) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Error" }, { status: 500 });
  }
}

// POST — add a member by email
export async function POST(request: Request) {
  try {
    const { user, supabase } = await requireAuth();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { data: seller } = await supabase
      .from("sellers")
      .select("id, shop_name, slack_access_token, slack_user_id")
      .eq("user_id", user.id)
      .single();
    if (!seller) return NextResponse.json({ error: "Seller not found" }, { status: 404 });

    // Verify caller is owner
    const { data: callerMember } = await supabaseAdmin
      .from("store_members")
      .select("role")
      .eq("seller_id", seller.id)
      .eq("user_id", user.id)
      .single();
    if (callerMember?.role !== "owner") {
      return NextResponse.json({ error: "Only store owners can add members" }, { status: 403 });
    }

    const { email, role, custom_role_id } = await request.json();
    if (!email || !role) return NextResponse.json({ error: "Email and role are required" }, { status: 400 });

    // Look up user in auth
    const { data: authData } = await supabaseAdmin.auth.admin.listUsers({ perPage: 1000 });
    const targetUser = authData?.users?.find(u => u.email?.toLowerCase() === email.toLowerCase());

    if (!targetUser) {
      return NextResponse.json({
        error: `No Crevis account found for ${email}. Ask them to sign up first at ${process.env.NEXT_PUBLIC_APP_URL}/auth`
      }, { status: 404 });
    }

    // Insert member
    const { data: newMember, error: insertError } = await supabaseAdmin
      .from("store_members")
      .insert({
        seller_id: seller.id,
        user_id: targetUser.id,
        role,
        custom_role_id: custom_role_id ?? null,
        is_active: true,
        added_by: user.id,
      })
      .select()
      .single();

    if (insertError) {
      if (insertError.code === "23505") {
        return NextResponse.json({ error: "This user is already a team member" }, { status: 409 });
      }
      throw insertError;
    }

    // Send Slack DM to seller if connected
    if (seller.slack_access_token && seller.slack_user_id) {
      try {
        await sendSlackDM(
          seller.slack_access_token,
          seller.slack_user_id,
          `👋 You've been added to ${seller.shop_name} on Crevis as ${role.replace("_", " ")}.\nVisit ${process.env.NEXT_PUBLIC_APP_URL} to get started.`
        );
      } catch { /* non-critical */ }
    }

    const displayName = targetUser.user_metadata?.full_name ?? email.split("@")[0];
    return NextResponse.json({
      success: true,
      member: { ...newMember, email, display_name: displayName },
      message: `${displayName} added as ${role.replace("_", " ")}`
    });
  } catch (err: unknown) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Error" }, { status: 500 });
  }
}
