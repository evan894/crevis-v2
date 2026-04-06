import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";

export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  if (request.headers.get("x-admin-token") !== process.env.ADMIN_SECRET_TOKEN) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const { data: members } = await supabaseAdmin
    .from("store_members")
    .select("id, role, is_active, user_id, created_at")
    .eq("seller_id", params.id)
    .order("created_at", { ascending: true });

  // Enrich with user info
  const { data: authData } = await supabaseAdmin.auth.admin.listUsers({ perPage: 1000 });
  const usersMap = new Map(authData?.users?.map(u => [u.id, u]) ?? []);
  const enriched = (members ?? []).map(m => {
    const u = usersMap.get(m.user_id);
    return {
      ...m,
      email: u?.email ?? "Unknown",
      display_name: u?.user_metadata?.full_name ?? u?.email?.split("@")[0] ?? "Unknown",
    };
  });
  return NextResponse.json({ members: enriched });
}
