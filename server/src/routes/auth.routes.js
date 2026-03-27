import express from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import supabase from "../supabaseClient.js";
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

    const { data: existing, error: lookupErr } = await supabase
      .from("users")
      .select("id")
      .eq("email", email)
      .limit(1);

    if (lookupErr) throw lookupErr;

    if (existing && existing.length > 0) {
      return res.status(409).json({ message: "Email already in use" });
    }

    const hash = await bcrypt.hash(password, 10);
    const { data: newUser, error: insertErr } = await supabase
      .from("users")
      .insert({ name, email, password_hash: hash, role: "subscriber" })
      .select("id")
      .single();

    if (insertErr) throw insertErr;

    const userId = newUser.id;

    if (charityId) {
      const { error: prefErr } = await supabase
        .from("user_charity_preferences")
        .insert({ user_id: userId, charity_id: charityId });
      if (prefErr) throw prefErr;
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

    const { data: rows, error } = await supabase
      .from("users")
      .select("id, name, email, role, password_hash")
      .eq("email", email)
      .limit(1);

    if (error) throw error;

    if (!rows || rows.length === 0) {
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
    const { data, error } = await supabase
      .from("users")
      .select("id, name, email, role")
      .eq("id", req.user.userId)
      .maybeSingle();

    if (error) throw error;

    if (!data) {
      return res.status(404).json({ message: "User not found" });
    }
    return res.json(data);
  } catch (error) {
    return next(error);
  }
});

export default router;
