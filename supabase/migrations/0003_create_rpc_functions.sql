create or replace function deduct_credits(
  p_seller_id    uuid,
  p_amount       integer,
  p_action       text,
  p_order_value  numeric default null,
  p_order_id     uuid default null,
  p_note         text default null
)
returns integer
language plpgsql
security definer
as $$
declare
  v_new_balance integer;
begin
  -- Lock the seller row for this transaction
  select credit_balance into v_new_balance
  from sellers
  where id = p_seller_id
  for update;

  -- Check sufficient balance
  if v_new_balance < p_amount then
    raise exception 'Insufficient credits. Balance: %, Required: %',
      v_new_balance, p_amount;
  end if;

  -- Deduct balance
  update sellers
  set credit_balance = credit_balance - p_amount
  where id = p_seller_id
  returning credit_balance into v_new_balance;

  -- Log to ledger
  insert into credit_ledger (
    seller_id, action, credits_delta, order_value, order_id, note
  ) values (
    p_seller_id, p_action, -p_amount, p_order_value, p_order_id, p_note
  );

  return v_new_balance;
end;
$$;

create or replace function add_credits(
  p_seller_id  uuid,
  p_amount     integer,
  p_action     text,
  p_note       text default null
)
returns integer
language plpgsql
security definer
as $$
declare
  v_new_balance integer;
begin
  update sellers
  set credit_balance = credit_balance + p_amount
  where id = p_seller_id
  returning credit_balance into v_new_balance;

  insert into credit_ledger (
    seller_id, action, credits_delta, note
  ) values (
    p_seller_id, p_action, p_amount, p_note
  );

  return v_new_balance;
end;
$$;

create or replace function deactivate_seller_listings(
  p_seller_id uuid
)
returns integer
language plpgsql
security definer
as $$
declare
  v_count integer;
begin
  update products
  set active = false
  where seller_id = p_seller_id
    and active = true;

  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

create or replace function redeem_coupon(
  p_seller_id  uuid,
  p_code       text
)
returns integer
language plpgsql
security definer
as $$
declare
  v_coupon       coupons%rowtype;
  v_new_balance  integer;
begin
  -- Fetch and lock the coupon row
  select * into v_coupon
  from coupons
  where code = upper(p_code)
    and active = true
  for update;

  -- Coupon not found or inactive
  if not found then
    raise exception 'Invalid or inactive coupon code.';
  end if;

  -- Check usage limit
  if v_coupon.max_uses is not null
     and v_coupon.uses_so_far >= v_coupon.max_uses then
    raise exception 'Coupon usage limit reached.';
  end if;

  -- Increment uses
  update coupons
  set uses_so_far = uses_so_far + 1
  where id = v_coupon.id;

  -- Add credits via add_credits RPC
  select add_credits(
    p_seller_id,
    v_coupon.credits_value,
    'coupon',
    'Redeemed coupon: ' || p_code
  ) into v_new_balance;

  return v_new_balance;
end;
$$;
