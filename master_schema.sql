-- =======================================================
-- MASTER SCHEMA SQL (COMBINED MIGRATIONS)
-- =======================================================
-- Copy and paste this entirely into your Supabase SQL Editor to rapidly deploy
-- the Crevis v2 Schema without needing CLI config.
-- =======================================================

-- 1. TABLES
create table if not exists sellers (
  id                  uuid primary key default gen_random_uuid(),
  user_id             uuid references auth.users(id) on delete cascade not null,
  shop_name           text not null,
  category            text not null,
  slack_user_id       text default null,
  slack_access_token  text default null,
  credit_balance      integer not null default 0,
  created_at          timestamptz not null default now()
);

create table if not exists products (
  id           uuid primary key default gen_random_uuid(),
  seller_id    uuid references sellers(id) on delete cascade not null,
  name         text not null,
  description  text default null,
  photo_url    text not null,
  price        numeric(10, 2) not null,
  category     text not null,
  boosted      boolean not null default false,
  active       boolean not null default true,
  created_at   timestamptz not null default now()
);

create table if not exists orders (
  id                   uuid primary key default gen_random_uuid(),
  product_id           uuid references products(id) on delete set null,
  seller_id            uuid references sellers(id) on delete set null not null,
  buyer_telegram_id    text not null,
  buyer_name           text not null,
  amount               numeric(10, 2) not null,
  platform_fee         numeric(10, 2) not null,
  credits_deducted     integer not null,
  status               text not null default 'pending'
                         check (status in ('pending', 'completed', 'failed')),
  razorpay_payment_id  text default null,
  created_at           timestamptz not null default now()
);

create table if not exists credit_ledger (
  id           uuid primary key default gen_random_uuid(),
  seller_id    uuid references sellers(id) on delete cascade not null,
  action       text not null
                 check (action in (
                   'listing',
                   'boost',
                   'order_fee',
                   'credit_purchase',
                   'coupon'
                 )),
  credits_delta  integer not null,
  order_value    numeric(10, 2) default null,
  order_id       uuid references orders(id) on delete set null default null,
  note           text default null,
  created_at     timestamptz not null default now()
);

create table if not exists credit_purchases (
  id                uuid primary key default gen_random_uuid(),
  seller_id         uuid references sellers(id) on delete cascade not null,
  amount_paid       numeric(10, 2) not null,
  credits_added     integer not null,
  razorpay_order_id text default null,
  razorpay_payment_id text default null,
  status            text not null default 'pending'
                      check (status in ('pending', 'completed', 'failed')),
  created_at        timestamptz not null default now()
);

create table if not exists buyers (
  id              uuid primary key default gen_random_uuid(),
  telegram_id     text unique not null,
  first_name      text default null,
  username        text default null,
  created_at      timestamptz not null default now()
);

create table if not exists coupons (
  id             uuid primary key default gen_random_uuid(),
  code           text unique not null,
  credits_value  integer not null,
  max_uses       integer default null,
  uses_so_far    integer not null default 0,
  active         boolean not null default true,
  created_at     timestamptz not null default now()
);


-- 2. INDEXES
create index if not exists idx_products_seller_id on products(seller_id);
create index if not exists idx_products_active_boosted on products(active, boosted desc, created_at desc);
create index if not exists idx_products_category_active on products(category, active, boosted desc);
create index if not exists idx_orders_seller_id on orders(seller_id);
create index if not exists idx_orders_buyer_telegram_id on orders(buyer_telegram_id);
create index if not exists idx_credit_ledger_seller_id on credit_ledger(seller_id, created_at desc);
create index if not exists idx_buyers_telegram_id on buyers(telegram_id);


-- 3. RPC FUNCTIONS
create or replace function deduct_credits(
  p_seller_id    uuid,
  p_amount       integer,
  p_action       text,
  p_order_value  numeric default null,
  p_order_id     uuid default null,
  p_note         text default null
)
returns integer
language plpgsql
security definer
as $$
declare
  v_new_balance integer;
begin
  select credit_balance into v_new_balance from sellers where id = p_seller_id for update;
  if v_new_balance < p_amount then
    raise exception 'Insufficient credits. Balance: %, Required: %', v_new_balance, p_amount;
  end if;
  update sellers set credit_balance = credit_balance - p_amount where id = p_seller_id returning credit_balance into v_new_balance;
  insert into credit_ledger (seller_id, action, credits_delta, order_value, order_id, note) values (p_seller_id, p_action, -p_amount, p_order_value, p_order_id, p_note);
  return v_new_balance;
end;
$$;

create or replace function add_credits(
  p_seller_id  uuid,
  p_amount     integer,
  p_action     text,
  p_note       text default null
)
returns integer
language plpgsql
security definer
as $$
declare
  v_new_balance integer;
begin
  update sellers set credit_balance = credit_balance + p_amount where id = p_seller_id returning credit_balance into v_new_balance;
  insert into credit_ledger (seller_id, action, credits_delta, note) values (p_seller_id, p_action, p_amount, p_note);
  return v_new_balance;
end;
$$;

create or replace function deactivate_seller_listings(
  p_seller_id uuid
)
returns integer
language plpgsql
security definer
as $$
declare
  v_count integer;
begin
  update products set active = false where seller_id = p_seller_id and active = true;
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

create or replace function redeem_coupon(
  p_seller_id  uuid,
  p_code       text
)
returns integer
language plpgsql
security definer
as $$
declare
  v_coupon       coupons%rowtype;
  v_new_balance  integer;
begin
  select * into v_coupon from coupons where code = upper(p_code) and active = true for update;
  if not found then raise exception 'Invalid or inactive coupon code.'; end if;
  if v_coupon.max_uses is not null and v_coupon.uses_so_far >= v_coupon.max_uses then raise exception 'Coupon usage limit reached.'; end if;
  update coupons set uses_so_far = uses_so_far + 1 where id = v_coupon.id;
  select add_credits(p_seller_id, v_coupon.credits_value, 'coupon', 'Redeemed coupon: ' || p_code) into v_new_balance;
  return v_new_balance;
end;
$$;


-- 4. RLS & POLICIES
alter table sellers          enable row level security;
alter table products         enable row level security;
alter table orders           enable row level security;
alter table credit_ledger    enable row level security;
alter table credit_purchases enable row level security;
alter table buyers           enable row level security;
alter table coupons          enable row level security;

create policy "sellers_select_own" on sellers for select using (auth.uid() = user_id);
create policy "sellers_update_own" on sellers for update using (auth.uid() = user_id);
create policy "sellers_insert_own" on sellers for insert with check (auth.uid() = user_id);

create policy "products_select_active" on products for select using (active = true);
create policy "products_select_own" on products for select using (seller_id in (select id from sellers where user_id = auth.uid()));
create policy "products_insert_own" on products for insert with check (seller_id in (select id from sellers where user_id = auth.uid()));
create policy "products_update_own" on products for update using (seller_id in (select id from sellers where user_id = auth.uid()));
create policy "products_delete_own" on products for delete using (seller_id in (select id from sellers where user_id = auth.uid()));

create policy "orders_select_own" on orders for select using (seller_id in (select id from sellers where user_id = auth.uid()));
create policy "ledger_select_own" on credit_ledger for select using (seller_id in (select id from sellers where user_id = auth.uid()));
create policy "purchases_select_own" on credit_purchases for select using (seller_id in (select id from sellers where user_id = auth.uid()));
create policy "buyers_no_public_access" on buyers for all using (false);
create policy "coupons_select_authenticated" on coupons for select to authenticated using (active = true);


-- 5. STORAGE & BUCKETS
insert into storage.buckets (id, name, public) values ('product-images', 'product-images', true) on conflict do nothing;
create policy "product_images_upload" on storage.objects for insert to authenticated with check (bucket_id = 'product-images');
create policy "product_images_public_read" on storage.objects for select using (bucket_id = 'product-images');
create policy "product_images_delete_own" on storage.objects for delete to authenticated using (bucket_id = 'product-images' and auth.uid()::text = owner);


-- 6. SEED DATA
insert into coupons (code, credits_value, max_uses, active) values ('CREVIS100', 100, null, true) on conflict do nothing;
