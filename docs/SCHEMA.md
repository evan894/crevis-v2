# Crevis v2 — SCHEMA.md
# Database Schema, RPC Functions, RLS Policies, and Seed Data

---

## Overview

Database: Supabase (PostgreSQL)
All tables use UUID primary keys.
All timestamps are `timestamptz` defaulting to `now()`.
All credit operations MUST go through RPC functions — never direct updates.
Storage bucket: `product-images` (public read, authenticated write)

---

## Tables

### sellers
Represents a registered seller on the Crevis network.

```sql
create table sellers (
  id                  uuid primary key default gen_random_uuid(),
  user_id             uuid references auth.users(id) on delete cascade not null,
  shop_name           text not null,
  category            text not null,
  slack_user_id       text default null,
  slack_access_token  text default null,
  credit_balance      integer not null default 0,
  created_at          timestamptz not null default now()
);
```

---

### products
A product listed by a seller on the Crevis network.

```sql
create table products (
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
```

---

### orders
A completed or pending purchase made via the Telegram bot.

```sql
create table orders (
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
```

---

### credit_ledger
Immutable log of every credit movement for every seller.
Never delete rows from this table.

```sql
create table credit_ledger (
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
```

---

### credit_purchases
Tracks every Razorpay credit top-up attempt by a seller.

```sql
create table credit_purchases (
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
```

---

### buyers
Telegram users who have interacted with the Crevis bot.

```sql
create table buyers (
  id              uuid primary key default gen_random_uuid(),
  telegram_id     text unique not null,
  first_name      text default null,
  username        text default null,
  created_at      timestamptz not null default now()
);
```

---

### coupons
Promotional codes that add credits to a seller wallet.

```sql
create table coupons (
  id             uuid primary key default gen_random_uuid(),
  code           text unique not null,
  credits_value  integer not null,
  max_uses       integer default null,
  uses_so_far    integer not null default 0,
  active         boolean not null default true,
  created_at     timestamptz not null default now()
);
```

---

## Indexes

```sql
-- Products: seller lookup + active boosted-first ordering
create index idx_products_seller_id
  on products(seller_id);

create index idx_products_active_boosted
  on products(active, boosted desc, created_at desc);

create index idx_products_category_active
  on products(category, active, boosted desc);

-- Orders: seller and buyer lookups
create index idx_orders_seller_id
  on orders(seller_id);

create index idx_orders_buyer_telegram_id
  on orders(buyer_telegram_id);

-- Credit ledger: seller history lookup
create index idx_credit_ledger_seller_id
  on credit_ledger(seller_id, created_at desc);

-- Buyers: telegram_id lookup
create index idx_buyers_telegram_id
  on buyers(telegram_id);
```

---

## RPC Functions

### deduct_credits
Atomically deducts credits from a seller balance.
Returns error if balance would go below 0.
Logs to credit_ledger in the same transaction.

```sql
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
  -- Lock the seller row for this transaction
  select credit_balance into v_new_balance
  from sellers
  where id = p_seller_id
  for update;

  -- Check sufficient balance
  if v_new_balance < p_amount then
    raise exception 'Insufficient credits. Balance: %, Required: %',
      v_new_balance, p_amount;
  end if;

  -- Deduct balance
  update sellers
  set credit_balance = credit_balance - p_amount
  where id = p_seller_id
  returning credit_balance into v_new_balance;

  -- Log to ledger
  insert into credit_ledger (
    seller_id, action, credits_delta, order_value, order_id, note
  ) values (
    p_seller_id, p_action, -p_amount, p_order_value, p_order_id, p_note
  );

  return v_new_balance;
end;
$$;
```

---

### add_credits
Atomically adds credits to a seller balance.
Logs to credit_ledger in the same transaction.

```sql
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
  update sellers
  set credit_balance = credit_balance + p_amount
  where id = p_seller_id
  returning credit_balance into v_new_balance;

  insert into credit_ledger (
    seller_id, action, credits_delta, note
  ) values (
    p_seller_id, p_action, p_amount, p_note
  );

  return v_new_balance;
end;
$$;
```

---

### deactivate_seller_listings
Sets all active products for a seller to inactive.
Called automatically when balance hits 0 after a deduction.

```sql
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
  update products
  set active = false
  where seller_id = p_seller_id
    and active = true;

  get diagnostics v_count = row_count;
  return v_count;
end;
$$;
```

---

### redeem_coupon
Validates and redeems a coupon code for a seller.
Atomic — increments uses_so_far and adds credits in one transaction.

```sql
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
  -- Fetch and lock the coupon row
  select * into v_coupon
  from coupons
  where code = upper(p_code)
    and active = true
  for update;

  -- Coupon not found or inactive
  if not found then
    raise exception 'Invalid or inactive coupon code.';
  end if;

  -- Check usage limit
  if v_coupon.max_uses is not null
     and v_coupon.uses_so_far >= v_coupon.max_uses then
    raise exception 'Coupon usage limit reached.';
  end if;

  -- Increment uses
  update coupons
  set uses_so_far = uses_so_far + 1
  where id = v_coupon.id;

  -- Add credits via add_credits RPC
  select add_credits(
    p_seller_id,
    v_coupon.credits_value,
    'coupon',
    'Redeemed coupon: ' || p_code
  ) into v_new_balance;

  return v_new_balance;
end;
$$;
```

---

## Row Level Security (RLS)

Enable RLS on all tables:

```sql
alter table sellers          enable row level security;
alter table products         enable row level security;
alter table orders           enable row level security;
alter table credit_ledger    enable row level security;
alter table credit_purchases enable row level security;
alter table buyers           enable row level security;
alter table coupons          enable row level security;
```

### sellers policies
```sql
-- Sellers can only read and update their own record
create policy "sellers_select_own"
  on sellers for select
  using (auth.uid() = user_id);

create policy "sellers_update_own"
  on sellers for update
  using (auth.uid() = user_id);

create policy "sellers_insert_own"
  on sellers for insert
  with check (auth.uid() = user_id);
```

### products policies
```sql
-- Anyone can read active products (Telegram bot uses service role)
create policy "products_select_active"
  on products for select
  using (active = true);

-- Sellers can read all their own products including inactive
create policy "products_select_own"
  on products for select
  using (
    seller_id in (
      select id from sellers where user_id = auth.uid()
    )
  );

-- Sellers can insert/update/delete only their own products
create policy "products_insert_own"
  on products for insert
  with check (
    seller_id in (
      select id from sellers where user_id = auth.uid()
    )
  );

create policy "products_update_own"
  on products for update
  using (
    seller_id in (
      select id from sellers where user_id = auth.uid()
    )
  );

create policy "products_delete_own"
  on products for delete
  using (
    seller_id in (
      select id from sellers where user_id = auth.uid()
    )
  );
```

### orders policies
```sql
-- Sellers can read their own orders
create policy "orders_select_own"
  on orders for select
  using (
    seller_id in (
      select id from sellers where user_id = auth.uid()
    )
  );
```

### credit_ledger policies
```sql
-- Sellers can only read their own ledger
create policy "ledger_select_own"
  on credit_ledger for select
  using (
    seller_id in (
      select id from sellers where user_id = auth.uid()
    )
  );
```

### credit_purchases policies
```sql
-- Sellers can only read their own purchases
create policy "purchases_select_own"
  on credit_purchases for select
  using (
    seller_id in (
      select id from sellers where user_id = auth.uid()
    )
  );
```

### buyers policies
```sql
-- Buyers table is managed entirely by service role (Telegram bot)
-- No public access
create policy "buyers_no_public_access"
  on buyers for all
  using (false);
```

### coupons policies
```sql
-- Coupons are read-only for authenticated users (for validation display)
-- All writes via service role only
create policy "coupons_select_authenticated"
  on coupons for select
  to authenticated
  using (active = true);
```

---

## Storage

```sql
-- Create product-images bucket
insert into storage.buckets (id, name, public)
values ('product-images', 'product-images', true);

-- Allow authenticated users to upload
create policy "product_images_upload"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'product-images');

-- Allow public read
create policy "product_images_public_read"
  on storage.objects for select
  using (bucket_id = 'product-images');

-- Allow sellers to delete their own images
create policy "product_images_delete_own"
  on storage.objects for delete
  to authenticated
  using (bucket_id = 'product-images' and auth.uid()::text = owner);
```

---

## Seed Data

```sql
-- Coupon: CREVIS100
insert into coupons (code, credits_value, max_uses, active)
values ('CREVIS100', 100, null, true);

-- Sample categories reference (not a table — used in app constants)
-- 'Clothing', 'Footwear', 'Accessories', 'Home Textiles', 'Other'

-- Sample products for demo day (insert after creating a demo seller)
-- Run this after onboarding the demo seller account and noting their seller id

-- insert into products (seller_id, name, description, photo_url,
--   price, category, boosted, active)
-- values
--   ('<seller_id>', 'Floral Kurta', 'Light cotton kurta, perfect for summer',
--    '<photo_url>', 499.00, 'Clothing', true, true),
--   ('<seller_id>', 'Block Print Dupatta', 'Handblock printed dupatta from Jaipur',
--    '<photo_url>', 299.00, 'Accessories', false, true),
--   ('<seller_id>', 'Casual Linen Shirt', 'Breathable linen, sizes S to XL',
--    '<photo_url>', 649.00, 'Clothing', false, true),
--   ('<seller_id>', 'Kolhapuri Chappals', 'Genuine leather, handcrafted',
--    '<photo_url>', 899.00, 'Footwear', false, true),
--   ('<seller_id>', 'Cotton Bed Sheet Set', 'Double bed, 300 thread count',
--    '<photo_url>', 1199.00, 'Home Textiles', false, true);
```

---

## Migration File Naming

```
supabase/migrations/
  0001_create_tables.sql
  0002_create_indexes.sql
  0003_create_rpc_functions.sql
  0004_enable_rls.sql
  0005_create_rls_policies.sql
  0006_create_storage.sql
  0007_seed_data.sql
```

Run in order. Never modify a migration file after it has been run.
Create a new migration file for any schema change instead.

---

## TypeScript Types (Generated Reference)

Keep `/types/index.ts` in sync with this schema at all times.
After any schema change, regenerate types with:

```bash
npx supabase gen types typescript --project-id <project-id> > types/database.ts
