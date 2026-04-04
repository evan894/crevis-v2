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
