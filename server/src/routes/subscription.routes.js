import express from "express";
import { query } from "../db.js";
import { requireAuth } from "../middleware/auth.js";
import { getLatestSubscriptionWithLifecycle } from "../utils/subscription.js";

const router = express.Router();

function planAmount(plan) {
  return plan === "yearly" ? 500 : 50;
}

router.get("/me", requireAuth, async (req, res, next) => {
  try {
    const subscription = await getLatestSubscriptionWithLifecycle(req.user.userId);
    return res.json(subscription);
  } catch (error) {
    return next(error);
  }
});

router.post("/me", requireAuth, async (req, res, next) => {
  try {
    return res.status(403).json({
      message: "Direct subscription activation is disabled. Use payment checkout to activate."
    });
  } catch (error) {
    return next(error);
  }
});

router.patch("/me/cancel", requireAuth, async (req, res, next) => {
  try {
    const rows = await query(
      `SELECT id FROM subscriptions WHERE user_id = ? ORDER BY id DESC LIMIT 1`,
      [req.user.userId]
    );

    if (!rows.length) {
      return res.status(404).json({ message: "Subscription not found" });
    }

    await query("UPDATE subscriptions SET status = 'cancelled' WHERE id = ?", [rows[0].id]);
    return res.json({ message: "Subscription cancelled" });
  } catch (error) {
    return next(error);
  }
});

router.patch("/me/resubscribe", requireAuth, async (req, res, next) => {
  try {
    return res.status(403).json({
      message: "Resubscribe via payment checkout to activate subscription."
    });
  } catch (error) {
    return next(error);
  }
});

router.patch("/me/charity-percentage", requireAuth, async (req, res, next) => {
  try {
    const percentage = Number(req.body?.charityPercentage);
    if (!Number.isFinite(percentage) || percentage < 10 || percentage > 90) {
      return res
        .status(400)
        .json({ message: "Charity percentage must be a number between 10 and 90" });
    }

    const rows = await query(
      `SELECT id, charity_percentage
       FROM subscriptions
       WHERE user_id = ?
       ORDER BY id DESC
       LIMIT 1`,
      [req.user.userId]
    );

    if (!rows.length) {
      return res.status(404).json({ message: "Subscription not found" });
    }

    const latest = rows[0];
    if (percentage < Number(latest.charity_percentage || 10)) {
      return res.status(400).json({
        message: "Charity percentage can only be increased from your current value"
      });
    }

    await query("UPDATE subscriptions SET charity_percentage = ? WHERE id = ?", [
      percentage,
      latest.id
    ]);

    return res.json({ message: "Charity percentage updated" });
  } catch (error) {
    return next(error);
  }
});

export default router;
