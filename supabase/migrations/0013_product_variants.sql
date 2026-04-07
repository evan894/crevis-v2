ALTER TABLE products
ADD COLUMN IF NOT EXISTS has_variants boolean not null default false,
ADD COLUMN IF NOT EXISTS variants jsonb default null;

ALTER TABLE orders
ADD COLUMN IF NOT EXISTS selected_variant text default null;
