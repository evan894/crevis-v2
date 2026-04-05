-- B1/I1/I3 migrations
-- Run this in Supabase Dashboard → SQL Editor

-- Add stock quantity to products
ALTER TABLE products ADD COLUMN IF NOT EXISTS stock integer not null default 1;

-- Add photo_urls array for multiple photos
ALTER TABLE products ADD COLUMN IF NOT EXISTS photo_urls text[] not null default '{}';

-- Add INSERT RLS policy for credit_purchases (fixes B3 payment init failure)
CREATE POLICY IF NOT EXISTS "purchases_insert_own" ON credit_purchases
  FOR INSERT WITH CHECK (seller_id IN (SELECT id FROM sellers WHERE user_id = auth.uid()));
