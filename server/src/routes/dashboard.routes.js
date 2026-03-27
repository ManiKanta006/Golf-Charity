import express from "express";
import { query } from "../db.js";
import { requireAuth, requireAdmin } from "../middleware/auth.js";
import { getLatestSubscriptionWithLifecycle } from "../utils/subscription.js";

const router = express.Router();

router.get("/me", requireAuth, async (req, res, next) => {
  try {
    const userId = req.user.userId;

    const subscription = await getLatestSubscriptionWithLifecycle(userId);

    const scores = await query(
      `SELECT id, score, date_played
       FROM scores
       WHERE user_id = ?
       ORDER BY date_played DESC, created_at DESC`,
      [userId]
    );

    const [selectedCharity] = await query(
      `SELECT c.id, c.name, c.description, c.image_url
       FROM user_charity_preferences ucp
       JOIN charities c ON c.id = ucp.charity_id
       WHERE ucp.user_id = ? AND c.active = 1
       LIMIT 1`,
      [userId]
    );

    const [participation] = await query(
      `SELECT COUNT(*) AS drawsEntered
       FROM draw_entries
       WHERE user_id = ?`,
      [userId]
    );

    const now = new Date();
    const nextYear = now.getMonth() === 11 ? now.getFullYear() + 1 : now.getFullYear();
    const nextMonthIndex = (now.getMonth() + 1) % 12;
    const upcomingDrawMonth = `${nextYear}-${String(nextMonthIndex + 1).padStart(2, "0")}-01`;

    const [winnings] = await query(
      `SELECT COALESCE(SUM(prize_amount), 0) AS totalWon,
              SUM(CASE WHEN payment_status = 'pending' THEN 1 ELSE 0 END) AS pendingPayouts,
              SUM(CASE WHEN payment_status = 'paid' THEN 1 ELSE 0 END) AS paidPayouts
       FROM draw_entries
       WHERE user_id = ?`,
      [userId]
    );

    const [independentDonations] = await query(
      `SELECT COALESCE(SUM(amount), 0) AS totalIndependentDonated,
              COUNT(*) AS donationsCount
       FROM donations
       WHERE user_id = ?`,
      [userId]
    );

    return res.json({
      subscription: subscription
        ? {
            plan: subscription.plan,
            status: subscription.status,
            amount: subscription.amount,
            renewal_date: subscription.renewal_date,
            charity_percentage: subscription.charity_percentage
          }
        : null,
      scores,
      selectedCharity: selectedCharity || null,
      participation: {
        drawsEntered: participation?.drawsEntered || 0,
        upcomingDrawMonth
      },
      winnings: winnings || { totalWon: 0, pendingPayouts: 0, paidPayouts: 0 },
      independentDonations: independentDonations || {
        totalIndependentDonated: 0,
        donationsCount: 0
      }
    });
  } catch (error) {
    return next(error);
  }
});

router.get("/admin/summary", requireAuth, requireAdmin, async (_req, res, next) => {
  try {
    const [users] = await query("SELECT COUNT(*) AS totalUsers FROM users");
    const [prizePool] = await query(
      `SELECT COALESCE(SUM(amount * 0.3), 0) AS totalPrizePool
       FROM subscriptions
       WHERE status = 'active'`
    );
    const [charityTotals] = await query(
      `SELECT COALESCE(SUM(s.amount * (s.charity_percentage / 100)), 0) AS totalCharityContributions
       FROM subscriptions s
       WHERE s.status = 'active'`
    );
    const [drawStats] = await query(
      `SELECT COUNT(*) AS totalDraws,
              COALESCE(SUM(CASE WHEN published = 1 THEN 1 ELSE 0 END), 0) AS publishedDraws
       FROM draws`
    );
    const [independentDonationStats] = await query(
      `SELECT COALESCE(SUM(amount), 0) AS totalIndependentDonations,
              COUNT(*) AS donationsCount
       FROM donations`
    );

    return res.json({ users, prizePool, charityTotals, drawStats, independentDonationStats });
  } catch (error) {
    return next(error);
  }
});

router.get("/admin/users", requireAuth, requireAdmin, async (_req, res, next) => {
  try {
    const rows = await query(
      `SELECT u.id, u.name, u.email, u.role, u.created_at,
              sub.plan AS latest_plan,
              sub.status AS latest_subscription_status,
              sub.renewal_date AS latest_renewal_date
       FROM users u
       LEFT JOIN subscriptions sub ON sub.id = (
         SELECT s2.id
         FROM subscriptions s2
         WHERE s2.user_id = u.id
         ORDER BY s2.id DESC
         LIMIT 1
       )
       ORDER BY u.created_at DESC`
    );

    return res.json(rows);
  } catch (error) {
    return next(error);
  }
});

router.patch("/admin/users/:userId", requireAuth, requireAdmin, async (req, res, next) => {
  try {
    const { userId } = req.params;
    const { name, email, role } = req.body;

    if (!name || !email || !["subscriber", "admin"].includes(role)) {
      return res.status(400).json({ message: "Valid name, email, and role are required" });
    }

    const result = await query(
      `UPDATE users
       SET name = ?, email = ?, role = ?
       WHERE id = ?`,
      [name, email, role, userId]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ message: "User not found" });
    }

    return res.json({ message: "User updated" });
  } catch (error) {
    return next(error);
  }
});

router.patch(
  "/admin/users/:userId/subscription",
  requireAuth,
  requireAdmin,
  async (req, res, next) => {
    try {
      const { userId } = req.params;
      const { plan, status, charityPercentage, renewalDate } = req.body;

      if (!plan || !status || !renewalDate) {
        return res.status(400).json({ message: "Plan, status, and renewal date are required" });
      }

      const amount = plan === "yearly" ? 500 : 50;

      await query(
        `INSERT INTO subscriptions
          (user_id, plan, status, amount, renewal_date, charity_percentage)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [userId, plan, status, amount, renewalDate, Number(charityPercentage || 10)]
      );

      return res.json({ message: "Subscription override applied" });
    } catch (error) {
      return next(error);
    }
  }
);

export default router;
