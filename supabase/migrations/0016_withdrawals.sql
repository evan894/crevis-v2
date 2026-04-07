CREATE TABLE withdrawals (
  id uuid primary key default gen_random_uuid(),
  seller_id uuid references sellers(id)
    on delete cascade not null,
  amount_credits integer not null,
  amount_inr numeric(10,2) not null,
  status text not null default 'pending'
    check (status in (
      'pending', 'processing', 'completed', 'failed'
    )),
  razorpay_payout_id text default null,
  failure_reason text default null,
  created_at timestamptz not null default now(),
  completed_at timestamptz default null
);

ALTER TABLE withdrawals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "owner_withdrawals"
ON withdrawals FOR ALL
USING (
  seller_id IN (
    SELECT sm.seller_id FROM store_members sm
    WHERE sm.user_id = auth.uid()
    AND sm.role = 'owner'
  )
);
