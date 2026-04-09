import { NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { supabaseAdmin } from "@/lib/supabase-admin";
import type { Database } from "@/types/database.types";
import { resend, EMAIL_TEMPLATES } from "@/lib/resend";

function getSupabase() {
  const cookieStore = cookies();
  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { get(name) { return cookieStore.get(name)?.value; } } }
  );
}

// GET — List pending invites
export async function GET() {
  try {
    const supabase = getSupabase();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { data: seller } = await supabase
      .from("sellers").select("id").eq("user_id", user.id).single();
    if (!seller) return NextResponse.json({ error: "Seller not found" }, { status: 404 });

    const { data: invites, error } = await supabaseAdmin
      .from("store_invites")
      .select("*")
      .eq("seller_id", seller.id)
      .eq("status", "pending")
      .order("created_at", { ascending: false });

    if (error) throw error;

    return NextResponse.json({ invites });
  } catch (err: unknown) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Error" }, { status: 500 });
  }
}

// POST — Create and send an invite
export async function POST(request: Request) {
  try {
    const supabase = getSupabase();
    const { data: { user: caller } } = await supabase.auth.getUser();
    if (!caller) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { email, role, custom_role_id } = await request.json();
    if (!email || !role) return NextResponse.json({ error: "Email and role are required" }, { status: 400 });

    // Find the store being managed
    // Get the seller ID from the caller's membership (must be owner/manager)
    const { data: member } = await supabase
      .from("store_members")
      .select("seller_id, role, sellers(shop_name)")
      .eq("user_id", caller.id)
      .single();

    if (!member || (member.role !== "owner" && member.role !== "manager")) {
      return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 });
    }

    const sellerId = member.seller_id;
    const shopName = (member.sellers as unknown as { shop_name: string })?.shop_name || "a Crevis shop";

    // 1. Check if already a member
    const { data: existingMember } = await supabaseAdmin
      .from("store_members")
      .select("id")
      .eq("seller_id", sellerId)
      .eq("user_id", (await supabaseAdmin.auth.admin.listUsers({ perPage: 1000 })).data.users.find(u => u.email === email)?.id || 'NONE')
      .maybeSingle();

    if (existingMember) {
      return NextResponse.json({ error: "User is already a member" }, { status: 409 });
    }

    // 2. Create invite in DB
    const { data: invite, error: inviteError } = await supabaseAdmin
      .from("store_invites")
      .upsert({
        seller_id: sellerId,
        email: email.toLowerCase(),
        role,
        custom_role_id: custom_role_id || null,
        invited_by: caller.id,
        status: 'pending'
      }, { onConflict: 'seller_id,email' })
      .select()
      .single();

    if (inviteError) throw inviteError;

    // 3. Send email via Resend
    const inviteUrl = `${process.env.NEXT_PUBLIC_APP_URL}/join/${invite.token}`;
    const { subject, html } = EMAIL_TEMPLATES.teamInvite(shopName, role, inviteUrl);

    const { error: emailError } = await resend.emails.send({
      from: 'Crevis <no-reply@updates.warmit.shop>', // User has warmit.shop domain usually on Resend for now, or just onboarding@resend.dev
      to: email,
      subject,
      html,
    });

    if (emailError) {
      console.error("Resend error:", emailError);
      // We don't throw here so the user at least sees the invite was created in DB
    }

    return NextResponse.json({
      success: true,
      invite,
      message: `Invite sent to ${email}`
    });
  } catch (err: unknown) {
    console.error("Invite error:", err);
    return NextResponse.json({ error: err instanceof Error ? err.message : "Error" }, { status: 500 });
  }
}
