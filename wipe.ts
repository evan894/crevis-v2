import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(supabaseUrl, supabaseKey);

async function main() {
  console.log("Deleting orphaned orders first...");
  await supabase.from('orders').delete().eq('seller_id', 'ac8aa8ae-3700-4fbf-b43e-c742645472ce');
  
  console.log("Deleting constraint stores...");
  const { error } = await supabase.from('sellers').delete().eq('id', 'ac8aa8ae-3700-4fbf-b43e-c742645472ce');
  console.log("Error? ", error);
}

main();
