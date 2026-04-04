import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);

async function seed() {
  console.log("Creating dummy seller user...");
  const { data: user, error: userError } = await supabase.auth.admin.createUser({
    email: 'demo@crevis.in',
    password: 'password123',
    email_confirm: true
  });

  if (userError) {
      console.log("Could not create user:", userError.message);
  }

  // Get or select the user 
  const { data: existingUsers } = await supabase.auth.admin.listUsers();
  const demoUser = existingUsers.users.find(u => u.email === 'demo@crevis.in');

  if (!demoUser) {
    console.error("Failed to find demo user.");
    process.exit(1);
  }

  // Check if seller exists
  let { data: seller } = await supabase.from('sellers').select('id').eq('user_id', demoUser.id).single();
  
  if (!seller) {
      console.log("Creating seller record...");
      const { data: newSeller, error: sellerError } = await supabase.from('sellers').insert({
          user_id: demoUser.id,
          shop_name: 'Bombay Curations',
          category: 'Clothing'
      }).select('id').single();

      if (sellerError || !newSeller) {
          console.error("Failed to create seller:", sellerError);
          process.exit(1);
      }
      seller = newSeller;
  }

  const sellerId = seller.id;
  console.log(`Using seller ${sellerId} for seeding...`);

  const seedProducts = [
    {
      seller_id: sellerId,
      name: "Vintage OMEGA Seamaster Watch",
      description: "Authentic 1970s Omega Seamaster. Automatic movement, recently serviced. Shows minor signs of wear consistent with age, but keeps perfect time. Includes original leather strap.",
      price: 45000,
      category: "Accessories",
      photo_url: "https://images.unsplash.com/photo-1542496658-e33a6d0d50f6?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80",
      active: true,
      boosted: true
    },
    {
      seller_id: sellerId,
      name: "Oversized Denim Jacket",
      description: "Vintage washed denim jacket. Boxy, oversized fit. Perfect for layering. 100% heavy cotton denim.",
      price: 2499,
      category: "Clothing",
      photo_url: "https://images.unsplash.com/photo-1548624149-f9b1859aa7d0?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80",
      active: true,
      boosted: false
    },
    {
      seller_id: sellerId,
      name: "Minimalist Leather Backpack",
      description: "Handcrafted full-grain leather backpack. Features a padded laptop sleeve and hidden passport pocket. Vegetable tanned leather will develop a beautiful patina over time.",
      price: 8500,
      category: "Accessories",
      photo_url: "https://images.unsplash.com/photo-1553062407-98eeb64c6a62?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80",
      active: true,
      boosted: false
    },
    {
      seller_id: sellerId,
      name: "Chunky Knit Sweater",
      description: "Hand-knitted chunky wool sweater. Extremely warm and cozy. Relaxed fit. Cream color that goes with everything.",
      price: 3200,
      category: "Clothing",
      photo_url: "https://images.unsplash.com/photo-1620799140408-edc6dcb6d633?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80",
      active: true,
      boosted: false
    },
    {
      seller_id: sellerId,
      name: "Classic Canvas Sneakers",
      description: "Everyday canvas sneakers in natural off-white. Rubber toe cap, durable vulcanized sole. True to size.",
      price: 1800,
      category: "Footwear",
      photo_url: "https://images.unsplash.com/photo-1628253747716-0c4f5c90fdda?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80",
      active: true,
      boosted: false
    }
  ];

  for (const p of seedProducts) {
    const { error } = await supabase.from('products').insert(p);
    if (error) {
      console.error(`Failed to insert ${p.name}:`, error);
    } else {
      console.log(`✅ Seeded: ${p.name}`);
    }
  }

  console.log("Seeding complete!");
  process.exit(0);
}

seed();
