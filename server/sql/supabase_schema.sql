-- ============================================================
-- Golf Charity – PostgreSQL schema for Supabase
-- Run this in the Supabase SQL Editor (Dashboard → SQL Editor)
-- ============================================================

-- Custom ENUM types
CREATE TYPE user_role AS ENUM ('subscriber', 'admin');
CREATE TYPE subscription_plan AS ENUM ('monthly', 'yearly');
CREATE TYPE subscription_status AS ENUM ('active', 'inactive', 'lapsed', 'cancelled');
CREATE TYPE verification_status AS ENUM ('pending', 'approved', 'rejected');
CREATE TYPE payment_status AS ENUM ('pending', 'paid');
CREATE TYPE draw_mode_type AS ENUM ('random', 'algorithmic');

-- USERS
CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  name VARCHAR(120) NOT NULL,
  email VARCHAR(190) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  role user_role NOT NULL DEFAULT 'subscriber',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- CHARITIES
CREATE TABLE IF NOT EXISTS charities (
  id SERIAL PRIMARY KEY,
  name VARCHAR(180) NOT NULL,
  description TEXT NOT NULL,
  image_url VARCHAR(300),
  featured BOOLEAN NOT NULL DEFAULT FALSE,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- USER ↔ CHARITY preference (one charity per user)
CREATE TABLE IF NOT EXISTS user_charity_preferences (
  id SERIAL PRIMARY KEY,
  user_id INT NOT NULL UNIQUE,
  charity_id INT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT fk_ucp_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT fk_ucp_charity FOREIGN KEY (charity_id) REFERENCES charities(id) ON DELETE CASCADE
);

-- SUBSCRIPTIONS
CREATE TABLE IF NOT EXISTS subscriptions (
  id SERIAL PRIMARY KEY,
  user_id INT NOT NULL,
  plan subscription_plan NOT NULL,
  status subscription_status NOT NULL DEFAULT 'active',
  amount NUMERIC(10,2) NOT NULL,
  renewal_date DATE NOT NULL,
  charity_percentage NUMERIC(5,2) NOT NULL DEFAULT 10.00,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT fk_sub_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- SCORES
CREATE TABLE IF NOT EXISTS scores (
  id SERIAL PRIMARY KEY,
  user_id INT NOT NULL,
  score INT NOT NULL,
  date_played DATE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT fk_score_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT chk_score_range CHECK (score >= 1 AND score <= 45)
);

-- DRAWS
CREATE TABLE IF NOT EXISTS draws (
  id SERIAL PRIMARY KEY,
  draw_month DATE NOT NULL,
  draw_mode draw_mode_type NOT NULL DEFAULT 'random',
  winning_numbers JSONB NOT NULL,
  published BOOLEAN NOT NULL DEFAULT FALSE,
  jackpot_carryover NUMERIC(12,2) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  published_at TIMESTAMPTZ
);

-- DRAW ENTRIES
CREATE TABLE IF NOT EXISTS draw_entries (
  id SERIAL PRIMARY KEY,
  draw_id INT NOT NULL,
  user_id INT NOT NULL,
  numbers JSONB NOT NULL,
  match_count INT NOT NULL DEFAULT 0,
  prize_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
  proof_url VARCHAR(400),
  verification_status verification_status NOT NULL DEFAULT 'pending',
  payment_status payment_status NOT NULL DEFAULT 'pending',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT fk_entry_draw FOREIGN KEY (draw_id) REFERENCES draws(id) ON DELETE CASCADE,
  CONSTRAINT fk_entry_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- DONATIONS
CREATE TABLE IF NOT EXISTS donations (
  id SERIAL PRIMARY KEY,
  user_id INT NOT NULL,
  charity_id INT,
  amount NUMERIC(10,2) NOT NULL,
  note VARCHAR(255),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT fk_donation_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT fk_donation_charity FOREIGN KEY (charity_id) REFERENCES charities(id) ON DELETE SET NULL
);

-- ============================================================
-- VIEW: latest subscription per user (replaces MySQL subquery pattern)
-- ============================================================
CREATE OR REPLACE VIEW latest_user_subscriptions AS
SELECT DISTINCT ON (user_id) *
FROM subscriptions
ORDER BY user_id, id DESC;
