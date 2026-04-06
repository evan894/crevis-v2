import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";

export async function DELETE(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const authHeader = request.headers.get("x-admin-token");
    if (authHeader !== process.env.ADMIN_SECRET_TOKEN) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { reason } = await request.json();

    // Verify product exists
    const { data: product } = await supabaseAdmin
      .from("products").select("id, name").eq("id", params.id).single();
    if (!product) return NextResponse.json({ error: "Product not found" }, { status: 404 });

    // Soft-delete: deactivate and mark as removed
    const { error } = await supabaseAdmin
      .from("products")
      .update({ active: false })
      .eq("id", params.id);

    if (error) throw error;

    console.log(`[Admin] Product ${params.id} (${product.name}) deactivated. Reason: ${reason}`);
    return NextResponse.json({ success: true, product_name: product.name });
  } catch (err: unknown) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Error" }, { status: 500 });
  }
}
