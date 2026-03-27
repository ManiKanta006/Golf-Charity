-- Active: 1773739796935@@localhost@3306@golf_charity
USE golf_charity;

INSERT INTO charities (name, description, image_url, featured, active) VALUES
('Nanhi Udaan Foundation', 'Supports school education and sports access for children in tier-2 and tier-3 cities.', 'https://images.unsplash.com/photo-1599058917765-a780eda07a3e', 1, 1),
('Swasth Bharat Trust', 'Funds preventive health camps and mobile diagnostics in rural communities.', 'https://images.unsplash.com/photo-1593113598332-cd59a93a5f21', 0, 1),
('Green India Collective', 'Drives urban tree plantation, water body revival, and climate education initiatives.', 'https://images.unsplash.com/photo-1472396961693-142e6e269027', 0, 1)
ON DUPLICATE KEY UPDATE name = VALUES(name);

-- Password for demo users: Password@123
INSERT INTO users (id, name, email, password_hash, role) VALUES
(1, 'Arjun Mehta', 'admin@golfcharity.test', '$2a$10$hqoK1u/MniqnkC5fX7/JeOW5CjChE7LxavoogGVy4opNuCrc10KJK', 'admin'),
(2, 'Aarav Sharma', 'aarav.sharma@example.com', '$2a$10$hqoK1u/MniqnkC5fX7/JeOW5CjChE7LxavoogGVy4opNuCrc10KJK', 'subscriber'),
(3, 'Priya Reddy', 'priya.reddy@example.com', '$2a$10$hqoK1u/MniqnkC5fX7/JeOW5CjChE7LxavoogGVy4opNuCrc10KJK', 'subscriber'),
(4, 'Rahul Verma', 'rahul.verma@example.com', '$2a$10$hqoK1u/MniqnkC5fX7/JeOW5CjChE7LxavoogGVy4opNuCrc10KJK', 'subscriber')
ON DUPLICATE KEY UPDATE email = VALUES(email);

INSERT INTO subscriptions (user_id, plan, status, amount, renewal_date, charity_percentage) VALUES
(2, 'monthly', 'active', 50.00, DATE_ADD(CURDATE(), INTERVAL 1 MONTH), 12.00),
(3, 'yearly', 'active', 500.00, DATE_ADD(CURDATE(), INTERVAL 12 MONTH), 15.00),
(4, 'monthly', 'active', 50.00, DATE_ADD(CURDATE(), INTERVAL 1 MONTH), 10.00)
ON DUPLICATE KEY UPDATE user_id = user_id;

INSERT INTO user_charity_preferences (user_id, charity_id)
VALUES (2, 1), (3, 2), (4, 3)
ON DUPLICATE KEY UPDATE charity_id = VALUES(charity_id);

INSERT INTO scores (user_id, score, date_played) VALUES
(2, 34, DATE_SUB(CURDATE(), INTERVAL 1 DAY)),
(2, 31, DATE_SUB(CURDATE(), INTERVAL 8 DAY)),
(2, 36, DATE_SUB(CURDATE(), INTERVAL 15 DAY)),
(2, 33, DATE_SUB(CURDATE(), INTERVAL 22 DAY)),
(2, 30, DATE_SUB(CURDATE(), INTERVAL 29 DAY)),
(3, 28, DATE_SUB(CURDATE(), INTERVAL 2 DAY)),
(3, 32, DATE_SUB(CURDATE(), INTERVAL 9 DAY)),
(3, 29, DATE_SUB(CURDATE(), INTERVAL 16 DAY)),
(3, 35, DATE_SUB(CURDATE(), INTERVAL 23 DAY)),
(3, 31, DATE_SUB(CURDATE(), INTERVAL 30 DAY)),
(4, 27, DATE_SUB(CURDATE(), INTERVAL 3 DAY)),
(4, 30, DATE_SUB(CURDATE(), INTERVAL 10 DAY)),
(4, 33, DATE_SUB(CURDATE(), INTERVAL 17 DAY)),
(4, 29, DATE_SUB(CURDATE(), INTERVAL 24 DAY)),
(4, 34, DATE_SUB(CURDATE(), INTERVAL 31 DAY));
