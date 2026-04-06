import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";

export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  if (request.headers.get("x-admin-token") !== process.env.ADMIN_SECRET_TOKEN) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const { data: products } = await supabaseAdmin
    .from("products")
    .select("id, name, photo_url, price, category, boosted, active")
    .eq("seller_id", params.id)
    .order("created_at", { ascending: false });
  return NextResponse.json({ products: products ?? [] });
}
