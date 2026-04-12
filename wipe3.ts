import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

async function main() {
  console.log("Checking sellers");
  const { data: sellers } = await supabase.from('sellers').select('*');
  console.log("Sellers:", sellers?.map(s => `${s.shop_name} (${s.id})`));

  if (sellers) {
    for (const seller of sellers) {
      if (seller.shop_name !== 'Bombay Curations') {
        console.log(`Deleting ${seller.shop_name}`);
        // Delete orphaned orders just in case
        await supabase.from('orders').delete().eq('seller_id', seller.id);
        const { error } = await supabase.from('sellers').delete().eq('id', seller.id);
        if (error) {
          console.error(`Failed to delete ${seller.shop_name}:`, error);
        } else {
          console.log(`Success: ${seller.shop_name}`);
        }
      }
    }
  }
}

main();
