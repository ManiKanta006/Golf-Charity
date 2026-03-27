import express from "express";
import { query } from "../db.js";
import { requireAuth, requireAdmin } from "../middleware/auth.js";
import { assertActiveSubscription } from "../utils/subscription.js";

const router = express.Router();

function validateScore(score) {
  const n = Number(score);
  return Number.isInteger(n) && n >= 1 && n <= 45;
}

async function trimToLatestFive(userId) {
  const rows = await query(
    `SELECT id FROM scores
     WHERE user_id = ?
     ORDER BY date_played DESC, created_at DESC
     LIMIT 100`,
    [userId]
  );

  if (rows.length <= 5) {
    return;
  }

  const idsToDelete = rows.slice(5).map((r) => r.id);
  if (!idsToDelete.length) {
    return;
  }

  await query(
    `DELETE FROM scores WHERE id IN (${idsToDelete.map(() => "?").join(",")})`,
    idsToDelete
  );
}

router.get("/me", requireAuth, async (req, res, next) => {
  try {
    const rows = await query(
      `SELECT id, score, date_played, created_at
       FROM scores
       WHERE user_id = ?
       ORDER BY date_played DESC, created_at DESC`,
      [req.user.userId]
    );

    return res.json(rows);
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

    await query(
      "INSERT INTO scores (user_id, score, date_played) VALUES (?, ?, ?)",
      [req.user.userId, Number(score), datePlayed]
    );

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

    const result = await query(
      `UPDATE scores
       SET score = ?, date_played = ?
       WHERE id = ? AND user_id = ?`,
      [Number(score), datePlayed, scoreId, req.user.userId]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ message: "Score not found" });
    }

    return res.json({ message: "Score updated" });
  } catch (error) {
    return next(error);
  }
});

router.get("/admin/:userId", requireAuth, requireAdmin, async (req, res, next) => {
  try {
    const rows = await query(
      `SELECT id, score, date_played, created_at
       FROM scores
       WHERE user_id = ?
       ORDER BY date_played DESC, created_at DESC`,
      [req.params.userId]
    );

    return res.json(rows);
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

      const result = await query(
        `UPDATE scores
         SET score = ?, date_played = ?
         WHERE id = ? AND user_id = ?`,
        [Number(score), datePlayed, scoreId, userId]
      );

      if (result.affectedRows === 0) {
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
