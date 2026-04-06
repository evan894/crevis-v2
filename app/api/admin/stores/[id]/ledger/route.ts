import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";

export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  if (request.headers.get("x-admin-token") !== process.env.ADMIN_SECRET_TOKEN) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const { data: ledger } = await supabaseAdmin
    .from("credit_ledger")
    .select("id, action, credits_delta, note, created_at")
    .eq("seller_id", params.id)
    .order("created_at", { ascending: false })
    .limit(50);
  return NextResponse.json({ ledger: ledger ?? [] });
}
