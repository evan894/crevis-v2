-- Migration: Multi-Role Team System
-- Phase 7 / Session R1
-- Run AFTER 0008_add_stock_and_photo_urls.sql

-- Store members table
CREATE TABLE store_members (
  id uuid primary key default gen_random_uuid(),
  seller_id uuid references sellers(id)
    on delete cascade not null,
  user_id uuid references auth.users(id)
    on delete cascade not null,
  role text not null
    check (role in (
      'owner',
      'manager',
      'sales_agent',
      'delivery_agent',
      'custom'
    )),
  custom_role_id uuid default null,
  is_active boolean not null default true,
  added_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  UNIQUE(seller_id, user_id)
);

-- Custom roles table
CREATE TABLE custom_roles (
  id uuid primary key default gen_random_uuid(),
  seller_id uuid references sellers(id)
    on delete cascade not null,
  name text not null,
  permissions jsonb not null default '{}',
  created_at timestamptz not null default now()
);

-- Add foreign key from store_members to custom_roles (after custom_roles is created)
ALTER TABLE store_members
  ADD CONSTRAINT store_members_custom_role_id_fkey
  FOREIGN KEY (custom_role_id) REFERENCES custom_roles(id) ON DELETE SET NULL;

-- Delivery orders table
CREATE TABLE delivery_orders (
  id uuid primary key default gen_random_uuid(),
  order_id uuid references orders(id)
    on delete cascade not null unique,
  agent_id uuid references auth.users(id)
    default null,
  status text not null default 'pending'
    check (status in (
      'pending',
      'confirmed',
      'packed',
      'out_for_delivery',
      'delivered',
      'failed_delivery'
    )),
  otp text default null,
  otp_attempts integer not null default 0,
  otp_generated_at timestamptz default null,
  packed_at timestamptz default null,
  picked_up_at timestamptz default null,
  delivered_at timestamptz default null,
  failure_reason text default null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Enable RLS on all new tables
ALTER TABLE store_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE custom_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE delivery_orders ENABLE ROW LEVEL SECURITY;

-- store_members policies
-- Store owners can manage their own store members
CREATE POLICY "owner_manage_members"
  ON store_members FOR ALL
  USING (
    seller_id IN (
      SELECT id FROM sellers WHERE user_id = auth.uid()
    )
  );

-- Members can read their own membership
CREATE POLICY "member_read_own"
  ON store_members FOR SELECT
  USING (user_id = auth.uid());

-- custom_roles policies
CREATE POLICY "owner_manage_custom_roles"
  ON custom_roles FOR ALL
  USING (
    seller_id IN (
      SELECT id FROM sellers WHERE user_id = auth.uid()
    )
  );

-- delivery_orders policies
CREATE POLICY "store_read_delivery"
  ON delivery_orders FOR SELECT
  USING (
    order_id IN (
      SELECT id FROM orders WHERE seller_id IN (
        SELECT seller_id FROM store_members
        WHERE user_id = auth.uid()
        UNION
        SELECT id FROM sellers
        WHERE user_id = auth.uid()
      )
    )
  );

CREATE POLICY "agent_update_delivery"
  ON delivery_orders FOR UPDATE
  USING (agent_id = auth.uid());

-- Migrate existing sellers to owner role
INSERT INTO store_members (seller_id, user_id, role)
SELECT id, user_id, 'owner'
FROM sellers
ON CONFLICT (seller_id, user_id) DO NOTHING;
