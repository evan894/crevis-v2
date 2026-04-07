export const buildProductQuery = (
  supabase: any,
  storeContext: string | null
) => {
  let query = supabase
    .from('products')
    .select(`*, sellers(shop_name)`)
    .eq('active', true)
    // Assuming there were other filters, but I'll stick to the base ones
    .order('boosted', { ascending: false })
    .order('created_at', { ascending: false });

  if (storeContext) {
    query = query.eq('seller_id', storeContext);
  }

  return query;
};
