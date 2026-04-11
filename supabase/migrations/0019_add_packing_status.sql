-- Add 'packing' status to delivery_orders table

ALTER TABLE delivery_orders DROP CONSTRAINT IF EXISTS delivery_orders_status_check;
ALTER TABLE delivery_orders ADD CONSTRAINT delivery_orders_status_check CHECK (status in ('pending', 'confirmed', 'packing', 'packed', 'out_for_delivery', 'delivered', 'failed_delivery'));
