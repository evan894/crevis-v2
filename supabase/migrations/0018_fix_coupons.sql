-- Fix the redeem_coupon function which was broken in 0010 due to wrong table and column names
CREATE OR REPLACE FUNCTION redeem_coupon(
  p_seller_id uuid,
  p_code text
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_coupon coupons%rowtype;
  v_new_balance integer;
BEGIN
  -- Find valid coupon
  SELECT * INTO v_coupon
  FROM coupons
  WHERE code = upper(p_code)
    AND active = true
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Invalid or expired coupon';
  END IF;

  -- Check if max redemptions reached
  IF v_coupon.max_uses IS NOT NULL AND v_coupon.uses_so_far >= v_coupon.max_uses THEN
    RAISE EXCEPTION 'Coupon redemption limit reached';
  END IF;

  -- Check if user already redeemed this specific coupon
  IF EXISTS (
    SELECT 1 FROM credit_ledger 
    WHERE seller_id = p_seller_id 
      AND action = 'coupon'
      AND note LIKE '%' || upper(p_code) || '%'
  ) THEN
    RAISE EXCEPTION 'Coupon already redeemed by this store';
  END IF;

  -- Add promotional credits
  v_new_balance := add_credits(
    p_seller_id,
    v_coupon.credits_value,
    'coupon',
    'promo',  -- Ensure it is promotional
    'Redeemed coupon: ' || upper(p_code)
  );

  -- Increment use count
  UPDATE coupons
  SET uses_so_far = uses_so_far + 1
  WHERE id = v_coupon.id;

  RETURN v_new_balance;
END;
$$;

-- Delete any existing coupon with this name if inserted differently to avoid duplicates
DELETE FROM coupons WHERE code = 'CREVIS10K';

-- Insert the 10000 CC promotional coupon for new joins and once per store
INSERT INTO coupons (code, credits_value, max_uses, uses_so_far, active)
VALUES ('CREVIS10K', 10000, NULL, 0, true);
