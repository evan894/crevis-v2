ALTER TABLE orders
ADD COLUMN IF NOT EXISTS return_window_closes_at timestamptz default null,
ADD COLUMN IF NOT EXISTS credits_released boolean not null default false,
ADD COLUMN IF NOT EXISTS credits_released_at timestamptz default null,
ADD COLUMN IF NOT EXISTS return_requested boolean not null default false,
ADD COLUMN IF NOT EXISTS return_requested_at timestamptz default null,
ADD COLUMN IF NOT EXISTS return_reason text default null;
