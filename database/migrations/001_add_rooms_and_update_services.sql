-- Migration: Add rooms table and update services with type field

-- Insert sample rooms data
INSERT INTO rooms (branch_id, name, type, is_active) VALUES
(1, 'SPA Room 1', 'SPA', true),
(1, 'SPA Room 2', 'SPA', true),
(1, 'SPA Room 3', 'SPA', true),
(1, 'LC Sofa 1', 'LC', true),
(1, 'LC Sofa 2', 'LC', true),
(1, 'LC Sofa 3', 'LC', true),
(1, 'Karaoke Room 1', 'KARAOKE', true),
(1, 'Karaoke Room 2', 'KARAOKE', true),
(2, 'SPA Room 1', 'SPA', true),
(2, 'SPA Room 2', 'SPA', true),
(2, 'LC Sofa 1', 'LC', true),
(2, 'LC Sofa 2', 'LC', true)
ON CONFLICT DO NOTHING;

-- Update existing services to have proper type field
UPDATE services SET type = 'SPA' WHERE (LOWER(category) = 'spa' OR LOWER(name) LIKE '%spa%') AND type IS NULL;
UPDATE services SET type = 'LC' WHERE (LOWER(category) = 'lounge' OR LOWER(name) LIKE '%lounge%' OR LOWER(name) LIKE '%lc%') AND type IS NULL;
UPDATE services SET type = 'KARAOKE' WHERE (LOWER(category) = 'karaoke' OR LOWER(name) LIKE '%karaoke%') AND type IS NULL;

-- Set base_price from price if not set
UPDATE services SET base_price = price WHERE base_price IS NULL;

-- Set is_active from active if not set  
UPDATE services SET is_active = COALESCE(active, true) WHERE is_active IS NULL;
