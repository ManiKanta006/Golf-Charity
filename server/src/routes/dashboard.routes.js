import express from "express";
import supabase from "../supabaseClient.js";
import { requireAuth, requireAdmin } from "../middleware/auth.js";
import { getLatestSubscriptionWithLifecycle } from "../utils/subscription.js";

const router = express.Router();

router.get("/me", requireAuth, async (req, res, next) => {
  try {
    const userId = req.user.userId;

    const subscription = await getLatestSubscriptionWithLifecycle(userId);

    const { data: scores, error: scErr } = await supabase
      .from("scores")
      .select("id, score, date_played")
      .eq("user_id", userId)
      .order("date_played", { ascending: false })
      .order("created_at", { ascending: false });

    if (scErr) throw scErr;

    // Selected charity via foreign-key relation
    const { data: charityPref, error: cpErr } = await supabase
      .from("user_charity_preferences")
      .select("charities!inner(id, name, description, image_url)")
      .eq("user_id", userId)
      .eq("charities.active", true)
      .limit(1)
      .maybeSingle();

    if (cpErr) throw cpErr;
    const selectedCharity = charityPref?.charities || null;

    // Draw participation count
    const { count: drawsEntered, error: partErr } = await supabase
      .from("draw_entries")
      .select("*", { count: "exact", head: true })
      .eq("user_id", userId);

    if (partErr) throw partErr;

    const now = new Date();
    const nextYear = now.getMonth() === 11 ? now.getFullYear() + 1 : now.getFullYear();
    const nextMonthIndex = (now.getMonth() + 1) % 12;
    const upcomingDrawMonth = `${nextYear}-${String(nextMonthIndex + 1).padStart(2, "0")}-01`;

    // Winnings – fetch entries and compute in JS (avoids aggregate SQL)
    const { data: winEntries, error: wErr } = await supabase
      .from("draw_entries")
      .select("prize_amount, payment_status")
      .eq("user_id", userId);

    if (wErr) throw wErr;

    const winnings = {
      totalWon: (winEntries || []).reduce((s, e) => s + Number(e.prize_amount || 0), 0),
      pendingPayouts: (winEntries || []).filter((e) => e.payment_status === "pending").length,
      paidPayouts: (winEntries || []).filter((e) => e.payment_status === "paid").length
    };

    // Independent donations
    const { data: donationRows, error: dErr } = await supabase
      .from("donations")
      .select("amount")
      .eq("user_id", userId);

    if (dErr) throw dErr;

    const independentDonations = {
      totalIndependentDonated: (donationRows || []).reduce(
        (s, d) => s + Number(d.amount || 0),
        0
      ),
      donationsCount: (donationRows || []).length
    };

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
      scores: scores || [],
      selectedCharity,
      participation: {
        drawsEntered: drawsEntered || 0,
        upcomingDrawMonth
      },
      winnings,
      independentDonations
    });
  } catch (error) {
    return next(error);
  }
});

router.get("/admin/summary", requireAuth, requireAdmin, async (_req, res, next) => {
  try {
    // Total users
    const { count: totalUsers, error: uErr } = await supabase
      .from("users")
      .select("*", { count: "exact", head: true });
    if (uErr) throw uErr;

    // Active subscriptions (for prize pool + charity totals)
    const { data: activeSubs, error: sErr } = await supabase
      .from("subscriptions")
      .select("amount, charity_percentage")
      .eq("status", "active");
    if (sErr) throw sErr;

    const totalPrizePool = (activeSubs || []).reduce(
      (s, sub) => s + Number(sub.amount) * 0.3,
      0
    );
    const totalCharityContributions = (activeSubs || []).reduce(
      (s, sub) => s + Number(sub.amount) * (Number(sub.charity_percentage) / 100),
      0
    );

    // Draw stats
    const { data: draws, error: drErr } = await supabase
      .from("draws")
      .select("published");
    if (drErr) throw drErr;

    const totalDraws = (draws || []).length;
    const publishedDraws = (draws || []).filter((d) => d.published === true).length;

    // Independent donations
    const { data: donationRows, error: dnErr } = await supabase
      .from("donations")
      .select("amount");
    if (dnErr) throw dnErr;

    const totalIndependentDonations = (donationRows || []).reduce(
      (s, d) => s + Number(d.amount),
      0
    );
    const donationsCount = (donationRows || []).length;

    return res.json({
      users: { totalUsers: totalUsers || 0 },
      prizePool: { totalPrizePool: Number(totalPrizePool.toFixed(2)) },
      charityTotals: {
        totalCharityContributions: Number(totalCharityContributions.toFixed(2))
      },
      drawStats: { totalDraws, publishedDraws },
      independentDonationStats: {
        totalIndependentDonations: Number(totalIndependentDonations.toFixed(2)),
        donationsCount
      }
    });
  } catch (error) {
    return next(error);
  }
});

router.get("/admin/users", requireAuth, requireAdmin, async (_req, res, next) => {
  try {
    const { data: users, error: uErr } = await supabase
      .from("users")
      .select("id, name, email, role, created_at")
      .order("created_at", { ascending: false });
    if (uErr) throw uErr;

    // Use the view that gives us the latest subscription per user
    const { data: latestSubs, error: sErr } = await supabase
      .from("latest_user_subscriptions")
      .select("user_id, plan, status, renewal_date");
    if (sErr) throw sErr;

    const subMap = new Map((latestSubs || []).map((s) => [s.user_id, s]));

    const rows = (users || []).map((u) => {
      const sub = subMap.get(u.id);
      return {
        ...u,
        latest_plan: sub?.plan || null,
        latest_subscription_status: sub?.status || null,
        latest_renewal_date: sub?.renewal_date || null
      };
    });

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

    const { data, error } = await supabase
      .from("users")
      .update({ name, email, role })
      .eq("id", userId)
      .select();

    if (error) throw error;

    if (!data || data.length === 0) {
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

      const { error } = await supabase
        .from("subscriptions")
        .insert({
          user_id: userId,
          plan,
          status,
          amount,
          renewal_date: renewalDate,
          charity_percentage: Number(charityPercentage || 10)
        });

      if (error) throw error;
      return res.json({ message: "Subscription override applied" });
    } catch (error) {
      return next(error);
    }
  }
);

export default router;
