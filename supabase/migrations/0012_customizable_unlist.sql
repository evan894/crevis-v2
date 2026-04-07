ALTER TABLE sellers
ADD COLUMN IF NOT EXISTS unlist_duration_days integer not null default 7;

ALTER TABLE products
ADD COLUMN IF NOT EXISTS unlisted_at timestamptz default null,
ADD COLUMN IF NOT EXISTS scheduled_delete_at timestamptz default null;

CREATE OR REPLACE FUNCTION handle_product_active_status()
RETURNS TRIGGER AS $$
DECLARE
  v_duration integer;
BEGIN
  -- If product is being unlisted
  IF NEW.active = false AND (OLD.active = true OR OLD.active IS NULL) THEN
    -- Get owner's duration setting
    SELECT unlist_duration_days INTO v_duration FROM sellers WHERE id = NEW.seller_id;
    
    NEW.unlisted_at := now();
    
    IF NEW.stock <= 0 THEN
      IF v_duration = 0 THEN
        NEW.scheduled_delete_at := null;
      ELSE
        NEW.scheduled_delete_at := now() + (v_duration || ' days')::interval;
      END IF;
    ELSE
      NEW.scheduled_delete_at := null;
    END IF;
    
  -- If product is being relisted
  ELSIF NEW.active = true AND (OLD.active = false OR OLD.active IS NULL) THEN
    NEW.unlisted_at := null;
    NEW.scheduled_delete_at := null;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_product_active_status ON products;
CREATE TRIGGER trg_product_active_status
BEFORE UPDATE OF active
ON products
FOR EACH ROW
EXECUTE FUNCTION handle_product_active_status();
