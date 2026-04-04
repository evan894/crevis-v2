-- Coupon: CREVIS100
insert into coupons (code, credits_value, max_uses, active)
values ('CREVIS100', 100, null, true)
on conflict do nothing;
