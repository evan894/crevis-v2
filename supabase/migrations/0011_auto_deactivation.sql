-- STEP 1: Add columns
ALTER TABLE sellers
ADD COLUMN IF NOT EXISTS grace_period_started_at timestamptz default null,
ADD COLUMN IF NOT EXISTS deactivated boolean not null default false,
ADD COLUMN IF NOT EXISTS deactivated_at timestamptz default null,
ADD COLUMN IF NOT EXISTS deactivated_snapshot jsonb default null;

-- STEP 2: Update deduct_credits RPC to start grace period
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

  -- Allow going negative by removing the strict check depending on how negative balances work
  -- Assuming the task means negative balance is suddenly allowed or maybe it's only allowed for certain fees
  -- But Wait! The original deduct_credits says IF (v_earned + v_promo) < p_amount THEN RAISE EXCEPTION 'Insufficient credits';
  -- But "grace period for negative balances". We probably shouldn't raise exception anymore?
  -- Wait, the task says: "grace period for negative balances... In deduct_credits RPC, after deduction: If new credit_balance < 0 ... start clock"
  -- This implies the exception `IF (v_earned + v_promo) < p_amount THEN RAISE EXCEPTION` needs to be removed for standard deductions, or maybe for system deductions only.
  -- As the task did not specify only for system deductions, I will remove the RAISE EXCEPTION.
  
  -- Spend promo first, then earned
  v_promo_deduct := LEAST(v_promo, p_amount);
  v_earned_deduct := p_amount - v_promo_deduct;

  UPDATE sellers SET
    promo_credits = promo_credits - v_promo_deduct,
    earned_credits = earned_credits - v_earned_deduct,
    credit_balance = credit_balance - p_amount
  WHERE id = p_seller_id
  RETURNING credit_balance INTO v_new_balance;

  -- Step 2 trigger
  IF v_new_balance < 0 THEN
    -- Check if it wasn't already started
    UPDATE sellers SET grace_period_started_at = now()
    WHERE id = p_seller_id AND grace_period_started_at IS NULL;
  END IF;

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


-- STEP 5: Grace period clears on payment in add_credits RPC
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

  -- Clear grace period if balance became non-negative
  IF v_new_balance >= 0 THEN
    UPDATE sellers SET grace_period_started_at = null
    WHERE id = p_seller_id AND grace_period_started_at IS NOT NULL;
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
