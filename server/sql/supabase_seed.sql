-- ============================================================
-- Golf Charity – Seed data for Supabase (PostgreSQL)
-- Run this AFTER supabase_schema.sql in the SQL Editor
-- ============================================================

INSERT INTO charities (name, description, image_url, featured, active) VALUES
('Nanhi Udaan Foundation', 'Supports school education and sports access for children in tier-2 and tier-3 cities.', 'https://images.unsplash.com/photo-1599058917765-a780eda07a3e', TRUE, TRUE),
('Swasth Bharat Trust', 'Funds preventive health camps and mobile diagnostics in rural communities.', 'https://images.unsplash.com/photo-1593113598332-cd59a93a5f21', FALSE, TRUE),
('Green India Collective', 'Drives urban tree plantation, water body revival, and climate education initiatives.', 'https://images.unsplash.com/photo-1472396961693-142e6e269027', FALSE, TRUE)
ON CONFLICT DO NOTHING;

-- Password for demo users: Password@123
INSERT INTO users (id, name, email, password_hash, role) VALUES
(1, 'Arjun Mehta', 'admin@golfcharity.test', '$2a$10$hqoK1u/MniqnkC5fX7/JeOW5CjChE7LxavoogGVy4opNuCrc10KJK', 'admin'),
(2, 'Aarav Sharma', 'aarav.sharma@example.com', '$2a$10$hqoK1u/MniqnkC5fX7/JeOW5CjChE7LxavoogGVy4opNuCrc10KJK', 'subscriber'),
(3, 'Priya Reddy', 'priya.reddy@example.com', '$2a$10$hqoK1u/MniqnkC5fX7/JeOW5CjChE7LxavoogGVy4opNuCrc10KJK', 'subscriber'),
(4, 'Rahul Verma', 'rahul.verma@example.com', '$2a$10$hqoK1u/MniqnkC5fX7/JeOW5CjChE7LxavoogGVy4opNuCrc10KJK', 'subscriber')
ON CONFLICT (email) DO NOTHING;

-- Reset the users id sequence to avoid conflicts
SELECT setval('users_id_seq', (SELECT MAX(id) FROM users));

INSERT INTO subscriptions (user_id, plan, status, amount, renewal_date, charity_percentage) VALUES
(2, 'monthly', 'active', 50.00, CURRENT_DATE + INTERVAL '1 month', 12.00),
(3, 'yearly', 'active', 500.00, CURRENT_DATE + INTERVAL '12 months', 15.00),
(4, 'monthly', 'active', 50.00, CURRENT_DATE + INTERVAL '1 month', 10.00)
ON CONFLICT DO NOTHING;

INSERT INTO user_charity_preferences (user_id, charity_id)
VALUES (2, 1), (3, 2), (4, 3)
ON CONFLICT (user_id) DO UPDATE SET charity_id = EXCLUDED.charity_id;

INSERT INTO scores (user_id, score, date_played) VALUES
(2, 34, CURRENT_DATE - INTERVAL '1 day'),
(2, 31, CURRENT_DATE - INTERVAL '8 days'),
(2, 36, CURRENT_DATE - INTERVAL '15 days'),
(2, 33, CURRENT_DATE - INTERVAL '22 days'),
(2, 30, CURRENT_DATE - INTERVAL '29 days'),
(3, 28, CURRENT_DATE - INTERVAL '2 days'),
(3, 32, CURRENT_DATE - INTERVAL '9 days'),
(3, 29, CURRENT_DATE - INTERVAL '16 days'),
(3, 35, CURRENT_DATE - INTERVAL '23 days'),
(3, 31, CURRENT_DATE - INTERVAL '30 days'),
(4, 27, CURRENT_DATE - INTERVAL '3 days'),
(4, 30, CURRENT_DATE - INTERVAL '10 days'),
(4, 33, CURRENT_DATE - INTERVAL '17 days'),
(4, 29, CURRENT_DATE - INTERVAL '24 days'),
(4, 34, CURRENT_DATE - INTERVAL '31 days');
