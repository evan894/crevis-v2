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

create table buyers (
  id              uuid primary key default gen_random_uuid(),
  telegram_id     text unique not null,
  first_name      text default null,
  username        text default null,
  created_at      timestamptz not null default now()
);

create table coupons (
  id             uuid primary key default gen_random_uuid(),
  code           text unique not null,
  credits_value  integer not null,
  max_uses       integer default null,
  uses_so_far    integer not null default 0,
  active         boolean not null default true,
  created_at     timestamptz not null default now()
);
