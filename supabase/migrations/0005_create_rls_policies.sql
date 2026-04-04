-- sellers policies
create policy "sellers_select_own" on sellers for select using (auth.uid() = user_id);
create policy "sellers_update_own" on sellers for update using (auth.uid() = user_id);
create policy "sellers_insert_own" on sellers for insert with check (auth.uid() = user_id);

-- products policies
create policy "products_select_active" on products for select using (active = true);
create policy "products_select_own" on products for select using (seller_id in (select id from sellers where user_id = auth.uid()));
create policy "products_insert_own" on products for insert with check (seller_id in (select id from sellers where user_id = auth.uid()));
create policy "products_update_own" on products for update using (seller_id in (select id from sellers where user_id = auth.uid()));
create policy "products_delete_own" on products for delete using (seller_id in (select id from sellers where user_id = auth.uid()));

-- orders policies
create policy "orders_select_own" on orders for select using (seller_id in (select id from sellers where user_id = auth.uid()));

-- credit_ledger policies
create policy "ledger_select_own" on credit_ledger for select using (seller_id in (select id from sellers where user_id = auth.uid()));

-- credit_purchases policies
create policy "purchases_select_own" on credit_purchases for select using (seller_id in (select id from sellers where user_id = auth.uid()));

-- buyers policies
create policy "buyers_no_public_access" on buyers for all using (false);

-- coupons policies
create policy "coupons_select_authenticated" on coupons for select to authenticated using (active = true);
