import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(supabaseUrl, supabaseKey);

async function main() {
  console.log("Checking for members not tied to a living store...");
  const { data: members } = await supabase.from('store_members').select('id, seller_id');
  if (members && members.length > 0) {
    const { data: sellers } = await supabase.from('sellers').select('id');
    const validSellerIds = new Set(sellers?.map(s => s.id));
    for (const member of members) {
      if (!validSellerIds.has(member.seller_id)) {
         console.log(`Deleting orphaned member ${member.id}`);
         await supabase.from('store_members').delete().eq('id', member.id);
      }
    }
  }
  
  // Clean up old agents
  console.log("Cleaning up users not tied to anything? Users in auth.users are harder to delete safely without breaking admin functionality unless we strictly filter. We will leave auth.users intact for logins, they just have no store.");
}

main();
