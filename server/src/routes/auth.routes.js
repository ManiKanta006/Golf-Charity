import express from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { query } from "../db.js";
import { requireAuth } from "../middleware/auth.js";

const router = express.Router();

function signToken(user) {
  return jwt.sign(
    { userId: user.id, email: user.email, role: user.role },
    process.env.JWT_SECRET || "dev-secret",
    { expiresIn: "7d" }
  );
}

router.post("/register", async (req, res, next) => {
  try {
    const {
      name,
      email,
      password,
      charityId = null
    } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({ message: "Name, email and password are required" });
    }

    const existing = await query("SELECT id FROM users WHERE email = ?", [email]);
    if (existing.length > 0) {
      return res.status(409).json({ message: "Email already in use" });
    }

    const hash = await bcrypt.hash(password, 10);
    const result = await query(
      "INSERT INTO users (name, email, password_hash, role) VALUES (?, ?, ?, 'subscriber')",
      [name, email, hash]
    );

    const userId = result.insertId;

    if (charityId) {
      await query(
        "INSERT INTO user_charity_preferences (user_id, charity_id) VALUES (?, ?)",
        [userId, charityId]
      );
    }

    const token = signToken({ id: userId, email, role: "subscriber" });
    return res.status(201).json({ token, user: { id: userId, name, email, role: "subscriber" } });
  } catch (error) {
    return next(error);
  }
});

router.post("/login", async (req, res, next) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ message: "Email and password are required" });
    }

    const rows = await query(
      "SELECT id, name, email, role, password_hash FROM users WHERE email = ? LIMIT 1",
      [email]
    );

    if (rows.length === 0) {
      return res.status(401).json({ message: "Invalid credentials" });
    }

    const user = rows[0];
    const match = await bcrypt.compare(password, user.password_hash);
    if (!match) {
      return res.status(401).json({ message: "Invalid credentials" });
    }

    const token = signToken(user);
    return res.json({
      token,
      user: { id: user.id, name: user.name, email: user.email, role: user.role }
    });
  } catch (error) {
    return next(error);
  }
});

router.get("/me", requireAuth, async (req, res, next) => {
  try {
    const rows = await query("SELECT id, name, email, role FROM users WHERE id = ?", [req.user.userId]);
    if (!rows.length) {
      return res.status(404).json({ message: "User not found" });
    }
    return res.json(rows[0]);
  } catch (error) {
    return next(error);
  }
});

export default router;
