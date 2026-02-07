ALTER TABLE fnb_items
  ADD COLUMN IF NOT EXISTS package_qty integer,
  ADD COLUMN IF NOT EXISTS package_group text;

ALTER TABLE order_items
  ADD COLUMN IF NOT EXISTS price_label text,
  ADD COLUMN IF NOT EXISTS is_package_snapshot boolean DEFAULT false;
