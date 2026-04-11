import { createClient } from "@supabase/supabase-js";
import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

async function main() {
  const { data, error } = await supabase.from('credit_coupons').select('*').limit(1);
  if (error) {
    console.log("credit_coupons error:", error.message);
  } else {
    console.log("credit_coupons data:", data);
  }

  const { data: coupons, error: err2 } = await supabase.from('coupons').select('*').limit(1);
  if (err2) {
    console.log("coupons error:", err2.message);
  } else {
    console.log("coupons data:", coupons);
  }
}
main();
