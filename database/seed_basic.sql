-- Basic seed data for testing

-- Branches
INSERT INTO branches (name, address) VALUES
('Numars Pondok Indah', 'Jakarta Selatan'),
('Numars Sentul', 'Bogor');

-- Roles
INSERT INTO roles (name) VALUES
('Owner'),
('Manager'),
('Supervisor'),
('Kasir'),
('Terapis'),
('Staff Bar');

-- Therapist grades
INSERT INTO therapist_grades (name, commission_percent) VALUES
('Pink', 30),
('Gold', 35),
('Platinum', 40);

-- Therapists
INSERT INTO therapists (branch_id, grade_id, name, active) VALUES
(1, 2, 'Ayu', true),
(1, 3, 'Nina', true),
(1, 1, 'Sari', true),
(2, 1, 'Dewi', true),
(2, 2, 'Rina', true);

-- Services
INSERT INTO services (branch_id, name, type, category, base_price, price, duration_minutes, is_active, active) VALUES
(1, 'Spa Relax 60 Menit', 'SPA', 'spa', 300000, 300000, 60, true, true),
(1, 'Spa Premium 90 Menit', 'SPA', 'spa', 450000, 450000, 90, true, true),
(1, 'Lounge Cozy 3 Jam', 'LC', 'lounge', 400000, 400000, 180, true, true),
(1, 'Lounge Premium 3 Jam', 'LC', 'lounge', 500000, 500000, 180, true, true),
(1, 'Karaoke 3 Jam', 'KARAOKE', 'karaoke', 500000, 500000, 180, true, true),
(2, 'Spa Relax 60 Menit', 'SPA', 'spa', 300000, 300000, 60, true, true),
(2, 'Lounge Cozy 3 Jam', 'LC', 'lounge', 400000, 400000, 180, true, true);

-- Rooms
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
(2, 'LC Sofa 2', 'LC', true);

-- Test user (password: test123 - hashed with bcrypt)
INSERT INTO users (branch_id, role_id, name, phone, password, active) VALUES
(1, 4, 'Test Kasir', '08123456789', '$2b$10$YourHashHere', true);
