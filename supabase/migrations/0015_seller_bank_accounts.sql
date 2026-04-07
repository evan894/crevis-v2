CREATE TABLE seller_bank_accounts (
  id uuid primary key default gen_random_uuid(),
  seller_id uuid references sellers(id)
    on delete cascade not null unique,
  account_holder_name text not null,
  account_number text not null,
  ifsc_code text not null,
  account_type text not null
    check (account_type in ('savings', 'current')),
  bank_name text default null,
  verified boolean not null default false,
  razorpay_fund_account_id text default null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

ALTER TABLE seller_bank_accounts
ENABLE ROW LEVEL SECURITY;

-- Only owner can read/write their bank account
CREATE POLICY "owner_bank_account"
ON seller_bank_accounts FOR ALL
USING (
  seller_id IN (
    SELECT sm.seller_id FROM store_members sm
    WHERE sm.user_id = auth.uid()
    AND sm.role = 'owner'
  )
);
