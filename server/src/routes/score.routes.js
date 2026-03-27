import express from "express";
import supabase from "../supabaseClient.js";
import { requireAuth, requireAdmin } from "../middleware/auth.js";
import { assertActiveSubscription } from "../utils/subscription.js";

const router = express.Router();

function validateScore(score) {
  const n = Number(score);
  return Number.isInteger(n) && n >= 1 && n <= 45;
}

async function trimToLatestFive(userId) {
  const { data: rows, error } = await supabase
    .from("scores")
    .select("id")
    .eq("user_id", userId)
    .order("date_played", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(100);

  if (error) throw error;

  if (!rows || rows.length <= 5) {
    return;
  }

  const idsToDelete = rows.slice(5).map((r) => r.id);
  if (!idsToDelete.length) {
    return;
  }

  const { error: delErr } = await supabase
    .from("scores")
    .delete()
    .in("id", idsToDelete);

  if (delErr) throw delErr;
}

router.get("/me", requireAuth, async (req, res, next) => {
  try {
    const { data: rows, error } = await supabase
      .from("scores")
      .select("id, score, date_played, created_at")
      .eq("user_id", req.user.userId)
      .order("date_played", { ascending: false })
      .order("created_at", { ascending: false });

    if (error) throw error;
    return res.json(rows || []);
  } catch (error) {
    return next(error);
  }
});

router.post("/me", requireAuth, async (req, res, next) => {
  try {
    const { score, datePlayed } = req.body;

    const canAddScore = await assertActiveSubscription(req.user.userId);
    if (!canAddScore) {
      return res.status(403).json({
        message: "Active subscription required to add scores. Please resubscribe."
      });
    }

    if (!validateScore(score) || !datePlayed) {
      return res.status(400).json({ message: "Score must be 1-45 and date is required" });
    }

    const { error } = await supabase
      .from("scores")
      .insert({ user_id: req.user.userId, score: Number(score), date_played: datePlayed });

    if (error) throw error;

    await trimToLatestFive(req.user.userId);
    return res.status(201).json({ message: "Score added" });
  } catch (error) {
    return next(error);
  }
});

router.put("/me/:scoreId", requireAuth, async (req, res, next) => {
  try {
    const { scoreId } = req.params;
    const { score, datePlayed } = req.body;

    const canEditScore = await assertActiveSubscription(req.user.userId);
    if (!canEditScore) {
      return res.status(403).json({
        message: "Active subscription required to edit scores. Please resubscribe."
      });
    }

    if (!validateScore(score) || !datePlayed) {
      return res.status(400).json({ message: "Score must be 1-45 and date is required" });
    }

    const { data, error } = await supabase
      .from("scores")
      .update({ score: Number(score), date_played: datePlayed })
      .eq("id", scoreId)
      .eq("user_id", req.user.userId)
      .select();

    if (error) throw error;

    if (!data || data.length === 0) {
      return res.status(404).json({ message: "Score not found" });
    }

    return res.json({ message: "Score updated" });
  } catch (error) {
    return next(error);
  }
});

router.get("/admin/:userId", requireAuth, requireAdmin, async (req, res, next) => {
  try {
    const { data: rows, error } = await supabase
      .from("scores")
      .select("id, score, date_played, created_at")
      .eq("user_id", req.params.userId)
      .order("date_played", { ascending: false })
      .order("created_at", { ascending: false });

    if (error) throw error;
    return res.json(rows || []);
  } catch (error) {
    return next(error);
  }
});

router.put(
  "/admin/:userId/:scoreId",
  requireAuth,
  requireAdmin,
  async (req, res, next) => {
    try {
      const { userId, scoreId } = req.params;
      const { score, datePlayed } = req.body;

      if (!validateScore(score) || !datePlayed) {
        return res.status(400).json({ message: "Score must be 1-45 and date is required" });
      }

      const { data, error } = await supabase
        .from("scores")
        .update({ score: Number(score), date_played: datePlayed })
        .eq("id", scoreId)
        .eq("user_id", userId)
        .select();

      if (error) throw error;

      if (!data || data.length === 0) {
        return res.status(404).json({ message: "Score not found" });
      }

      await trimToLatestFive(userId);
      return res.json({ message: "Score updated by admin" });
    } catch (error) {
      return next(error);
    }
  }
);

export default router;
