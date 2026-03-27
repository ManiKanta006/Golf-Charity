import express from "express";
import supabase from "../supabaseClient.js";
import { requireAuth, requireAdmin } from "../middleware/auth.js";

const router = express.Router();

router.post("/me", requireAuth, async (req, res, next) => {
  try {
    const { charityId = null, amount, note = null } = req.body;
    const parsedAmount = Number(amount);

    if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
      return res.status(400).json({ message: "Donation amount must be greater than 0" });
    }

    if (charityId) {
      const { data: charity, error: cErr } = await supabase
        .from("charities")
        .select("id")
        .eq("id", charityId)
        .eq("active", true)
        .limit(1);

      if (cErr) throw cErr;

      if (!charity || !charity.length) {
        return res.status(400).json({ message: "Selected charity not found" });
      }
    }

    const { error } = await supabase
      .from("donations")
      .insert({
        user_id: req.user.userId,
        charity_id: charityId || null,
        amount: parsedAmount,
        note
      });

    if (error) throw error;
    return res.status(201).json({ message: "Donation recorded" });
  } catch (error) {
    return next(error);
  }
});

router.get("/me", requireAuth, async (req, res, next) => {
  try {
    const { data: rows, error } = await supabase
      .from("donations")
      .select("id, amount, note, created_at, charity_id, charities(id, name)")
      .eq("user_id", req.user.userId)
      .order("created_at", { ascending: false });

    if (error) throw error;

    // Flatten the nested charities object to match original response format
    const flattened = (rows || []).map(({ charities, ...rest }) => ({
      ...rest,
      charity_id: rest.charity_id,
      charity_name: charities?.name || null
    }));

    return res.json(flattened);
  } catch (error) {
    return next(error);
  }
});

router.get("/admin", requireAuth, requireAdmin, async (_req, res, next) => {
  try {
    const { data: rows, error } = await supabase
      .from("donations")
      .select("id, amount, note, created_at, user_id, users(id, name, email), charity_id, charities(id, name)")
      .order("created_at", { ascending: false });

    if (error) throw error;

    // Flatten nested objects to match original response format
    const flattened = (rows || []).map(({ users, charities, ...rest }) => ({
      ...rest,
      user_id: rest.user_id,
      user_name: users?.name || null,
      user_email: users?.email || null,
      charity_id: rest.charity_id,
      charity_name: charities?.name || null
    }));

    return res.json(flattened);
  } catch (error) {
    return next(error);
  }
});

export default router;
