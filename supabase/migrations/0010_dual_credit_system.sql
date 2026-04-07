-- STEP 1: Add columns to sellers and credit_ledger
ALTER TABLE sellers
ADD COLUMN IF NOT EXISTS earned_credits integer not null default 0,
ADD COLUMN IF NOT EXISTS promo_credits integer not null default 0;

-- Backfill promo_credits with current credit_balance assuming all are promo
UPDATE sellers SET promo_credits = credit_balance WHERE credit_balance > 0;

ALTER TABLE credit_ledger
ADD COLUMN IF NOT EXISTS credit_type text not null default 'promo'
CHECK (credit_type in ('earned', 'promo'));

-- STEP 2: Update add_credits RPC
CREATE OR REPLACE FUNCTION add_credits(
  p_seller_id uuid,
  p_amount integer,
  p_action text,
  p_credit_type text default 'promo',
  p_note text default null
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_new_balance integer;
BEGIN
  IF p_credit_type = 'earned' THEN
    UPDATE sellers SET
      earned_credits = earned_credits + p_amount,
      credit_balance = credit_balance + p_amount
    WHERE id = p_seller_id
    RETURNING credit_balance INTO v_new_balance;
  ELSE
    UPDATE sellers SET
      promo_credits = promo_credits + p_amount,
      credit_balance = credit_balance + p_amount
    WHERE id = p_seller_id
    RETURNING credit_balance INTO v_new_balance;
  END IF;

  INSERT INTO credit_ledger (
    seller_id, action, credits_delta,
    credit_type, note
  ) VALUES (
    p_seller_id, p_action, p_amount,
    p_credit_type, p_note
  );

  RETURN v_new_balance;
END;
$$;

-- STEP 3: Update deduct_credits RPC
-- Deductions spend promo credits first, then earned
CREATE OR REPLACE FUNCTION deduct_credits(
  p_seller_id uuid,
  p_amount integer,
  p_action text,
  p_order_value numeric default null,
  p_order_id uuid default null,
  p_note text default null
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_earned integer;
  v_promo integer;
  v_promo_deduct integer;
  v_earned_deduct integer;
  v_new_balance integer;
BEGIN
  SELECT earned_credits, promo_credits
  INTO v_earned, v_promo
  FROM sellers WHERE id = p_seller_id FOR UPDATE;

  IF (v_earned + v_promo) < p_amount THEN
    RAISE EXCEPTION 'Insufficient credits';
  END IF;

  -- Spend promo first, then earned
  v_promo_deduct := LEAST(v_promo, p_amount);
  v_earned_deduct := p_amount - v_promo_deduct;

  UPDATE sellers SET
    promo_credits = promo_credits - v_promo_deduct,
    earned_credits = earned_credits - v_earned_deduct,
    credit_balance = credit_balance - p_amount
  WHERE id = p_seller_id
  RETURNING credit_balance INTO v_new_balance;

  INSERT INTO credit_ledger (
    seller_id, action, credits_delta,
    credit_type, order_value, order_id, note
  ) VALUES (
    p_seller_id, p_action, -p_amount,
    CASE WHEN v_earned_deduct > 0 THEN 'earned' ELSE 'promo' END,
    p_order_value, p_order_id, p_note
  );

  RETURN v_new_balance;
END;
$$;

-- STEP 4: Update redeem_coupon RPC
CREATE OR REPLACE FUNCTION redeem_coupon(
  p_seller_id uuid,
  p_code text
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_coupon record;
  v_new_balance integer;
BEGIN
  -- Find valid coupon
  SELECT * INTO v_coupon
  FROM credit_coupons
  WHERE code = p_code
    AND active = true
    AND (expires_at IS NULL OR expires_at > now())
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Invalid or expired coupon';
  END IF;

  -- Check if max redemptions reached
  IF v_coupon.max_redemptions IS NOT NULL AND v_coupon.times_redeemed >= v_coupon.max_redemptions THEN
    RAISE EXCEPTION 'Coupon redemption limit reached';
  END IF;

  -- Check if user already redeemed
  IF EXISTS (
    SELECT 1 FROM credit_ledger 
    WHERE seller_id = p_seller_id 
      AND action = 'coupon_redemption' 
      AND note = p_code
  ) THEN
    RAISE EXCEPTION 'Coupon already redeemed by this store';
  END IF;

  -- Add promotional credits
  v_new_balance := add_credits(
    p_seller_id,
    v_coupon.credit_amount,
    'coupon_redemption',
    'promo',  -- Ensure it is promotional
    p_code
  );

  -- Increment use count
  UPDATE credit_coupons
  SET times_redeemed = times_redeemed + 1
  WHERE id = v_coupon.id;

  RETURN v_new_balance;
END;
$$;
