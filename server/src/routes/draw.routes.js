import express from "express";
import fs from "fs";
import path from "path";
import multer from "multer";
import { fileURLToPath } from "url";
import supabase from "../supabaseClient.js";
import { requireAuth, requireAdmin } from "../middleware/auth.js";
import {
  randomDrawNumbers,
  algorithmicDrawNumbers,
  buildDrawPreview
} from "../utils/draw.js";
import { sendBulkNotification, sendNotificationEmail } from "../utils/notifications.js";

const router = express.Router();
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const uploadsDir = path.resolve(__dirname, "../../uploads/proofs");

if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

const upload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, uploadsDir),
    filename: (_req, file, cb) => {
      const safeBase = file.originalname.replace(/[^a-zA-Z0-9._-]/g, "_");
      cb(null, `${Date.now()}-${safeBase}`);
    }
  }),
  limits: { fileSize: 6 * 1024 * 1024 }
});

async function getActiveUsersWithNumbers() {
  // 1. Get active subscribers via the latest_user_subscriptions view
  const { data: activeSubs, error: asErr } = await supabase
    .from("latest_user_subscriptions")
    .select("user_id")
    .eq("status", "active");

  if (asErr) throw asErr;
  if (!activeSubs || !activeSubs.length) return [];

  const activeUserIds = activeSubs.map((s) => s.user_id);

  // 2. Get user details
  const { data: users, error: uErr } = await supabase
    .from("users")
    .select("id, name")
    .in("id", activeUserIds);

  if (uErr) throw uErr;

  // 3. Get historical wins (match_count >= 3) for all active users
  const { data: winEntries, error: wErr } = await supabase
    .from("draw_entries")
    .select("user_id")
    .in("user_id", activeUserIds)
    .gte("match_count", 3);

  if (wErr) throw wErr;

  const winCounts = new Map();
  for (const entry of winEntries || []) {
    winCounts.set(entry.user_id, (winCounts.get(entry.user_id) || 0) + 1);
  }

  // 4. Get all scores for active users (batch, not N+1)
  const { data: allUserScores, error: sErr } = await supabase
    .from("scores")
    .select("user_id, score, date_played, created_at")
    .in("user_id", activeUserIds)
    .order("date_played", { ascending: false })
    .order("created_at", { ascending: false });

  if (sErr) throw sErr;

  // Group scores by user_id, keep latest 5 per user
  const scoresByUser = new Map();
  for (const sc of allUserScores || []) {
    if (!scoresByUser.has(sc.user_id)) {
      scoresByUser.set(sc.user_id, []);
    }
    const arr = scoresByUser.get(sc.user_id);
    if (arr.length < 5) {
      arr.push(sc);
    }
  }

  const usersWithNumbers = [];
  for (const user of users || []) {
    const scores = scoresByUser.get(user.id) || [];
    if (scores.length === 5) {
      usersWithNumbers.push({
        user_id: user.id,
        name: user.name,
        historical_wins: winCounts.get(user.id) || 0,
        numbers_json: JSON.stringify(scores.map((row) => Number(row.score)))
      });
    }
  }

  return usersWithNumbers;
}

async function getPrizePool() {
  const { data, error } = await supabase
    .from("subscriptions")
    .select("amount")
    .eq("status", "active");

  if (error) throw error;
  return (data || []).reduce((sum, s) => sum + Number(s.amount) * 0.3, 0);
}

async function getCurrentCarryover() {
  const { data, error } = await supabase
    .from("draws")
    .select("jackpot_carryover")
    .order("id", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  return Number(data?.jackpot_carryover || 0);
}

function chooseWinningNumbers(mode, allScores) {
  return mode === "algorithmic" ? algorithmicDrawNumbers(allScores) : randomDrawNumbers();
}

function boostedAlgorithmicNumbers(baseNumbers, users, allScores) {
  const parsedUsers = users
    .map((user) => ({ user, numbers: toNumberArray(user.numbers_json) }))
    .filter((entry) => entry.numbers.length === 5);

  if (!parsedUsers.length) {
    return baseNumbers;
  }

  const hasAtLeastThreeMatch = parsedUsers.some(
    ({ numbers }) => numbers.filter((n) => baseNumbers.includes(n)).length >= 3
  );

  if (hasAtLeastThreeMatch) {
    return baseNumbers;
  }

  const minWins = Math.min(...parsedUsers.map(({ user }) => Number(user.historical_wins || 0)));
  const leastWinnerUsers = parsedUsers.filter(
    ({ user }) => Number(user.historical_wins || 0) === minWins
  );
  const anchorCandidate =
    leastWinnerUsers[Math.floor(Math.random() * leastWinnerUsers.length)] || parsedUsers[0];
  const anchor = anchorCandidate.numbers.slice(0, 3);
  const freq = new Map();
  for (const row of allScores) {
    const n = Number.parseInt(row.score, 10);
    if (n >= 1 && n <= 45) {
      freq.set(n, (freq.get(n) || 0) + 1);
    }
  }

  const filler = Array.from({ length: 45 }, (_, i) => i + 1)
    .filter((n) => !anchor.includes(n))
    .sort((a, b) => (freq.get(a) || 0) - (freq.get(b) || 0) || a - b)
    .slice(0, 2);

  return [...new Set([...anchor, ...filler])].sort((a, b) => a - b).slice(0, 5);
}

function toNumberArray(value) {
  if (Array.isArray(value)) {
    return value.map((n) => Number(n)).filter((n) => Number.isFinite(n));
  }

  if (value == null) {
    return [];
  }

  const raw = String(value).trim();
  if (!raw) {
    return [];
  }

  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      return parsed.map((n) => Number(n)).filter((n) => Number.isFinite(n));
    }
  } catch (_error) {
    // Support legacy comma-separated numeric storage such as "6,7,8,9,10".
  }

  return raw
    .split(",")
    .map((part) => Number(part.trim()))
    .filter((n) => Number.isFinite(n));
}

async function notifyDrawPublished(drawId, preview) {
  // Get emails of active subscribers via the view
  const { data: activeSubs, error: asErr } = await supabase
    .from("latest_user_subscriptions")
    .select("user_id")
    .eq("status", "active");

  if (asErr) throw asErr;
  if (!activeSubs || !activeSubs.length) return;

  const userIds = activeSubs.map((s) => s.user_id);

  const { data: users, error: uErr } = await supabase
    .from("users")
    .select("email")
    .in("id", userIds);

  if (uErr) throw uErr;

  const winningNumbers = preview.winningNumbers.join(", ");
  await sendBulkNotification(
    (users || []).map((r) => r.email),
    () => ({
      subject: `Monthly Draw Published (Draw #${drawId})`,
      text: `The monthly draw is now live. Winning numbers: ${winningNumbers}. Log in to view results and winner status.`
    })
  );
}

router.get("/latest", async (_req, res, next) => {
  try {
    const { data: draw, error } = await supabase
      .from("draws")
      .select("id, draw_month, draw_mode, winning_numbers, published, jackpot_carryover, created_at, published_at")
      .eq("published", true)
      .order("id", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) throw error;

    if (!draw) {
      return res.json(null);
    }

    // JSONB is returned as native array by Supabase, but toNumberArray handles both
    draw.winning_numbers = toNumberArray(draw.winning_numbers);
    return res.json(draw);
  } catch (error) {
    return next(error);
  }
});

router.get("/entries/admin", requireAuth, requireAdmin, async (_req, res, next) => {
  try {
    const { data: rows, error } = await supabase
      .from("draw_entries")
      .select(
        "id, draw_id, user_id, match_count, prize_amount, proof_url, verification_status, payment_status, created_at, users(name, email), draws(draw_month, draw_mode)"
      )
      .gte("match_count", 3)
      .order("created_at", { ascending: false });

    if (error) throw error;

    // Flatten nested relation objects to match original response format
    const flattened = (rows || []).map(({ users, draws, ...rest }) => ({
      ...rest,
      user_name: users?.name || null,
      user_email: users?.email || null,
      draw_month: draws?.draw_month || null,
      draw_mode: draws?.draw_mode || null
    }));

    return res.json(flattened);
  } catch (error) {
    return next(error);
  }
});

router.get("/entries/me", requireAuth, async (req, res, next) => {
  try {
    const { data: rows, error } = await supabase
      .from("draw_entries")
      .select(
        "id, draw_id, match_count, prize_amount, proof_url, verification_status, payment_status, created_at, draws(draw_month, draw_mode)"
      )
      .eq("user_id", req.user.userId)
      .gte("match_count", 3)
      .order("created_at", { ascending: false });

    if (error) throw error;

    const flattened = (rows || []).map(({ draws, ...rest }) => ({
      ...rest,
      draw_month: draws?.draw_month || null,
      draw_mode: draws?.draw_mode || null
    }));

    return res.json(flattened);
  } catch (error) {
    return next(error);
  }
});

router.post("/simulate", requireAuth, requireAdmin, async (req, res, next) => {
  try {
    const mode = req.body.mode === "algorithmic" ? "algorithmic" : "random";

    const { data: allScores, error: sErr } = await supabase
      .from("scores")
      .select("score");
    if (sErr) throw sErr;

    const users = await getActiveUsersWithNumbers();
    const totalPrizePool = await getPrizePool();
    const carryover = await getCurrentCarryover();
    let winningNumbers = chooseWinningNumbers(mode, allScores || []);
    if (mode === "algorithmic") {
      winningNumbers = boostedAlgorithmicNumbers(winningNumbers, users, allScores || []);
    }

    const preview = buildDrawPreview({ users, winningNumbers, totalPrizePool, carryover });

    return res.json({
      mode,
      participants: users.length,
      totalPrizePool,
      carryover,
      preview
    });
  } catch (error) {
    return next(error);
  }
});

router.post("/publish", requireAuth, requireAdmin, async (req, res, next) => {
  try {
    const mode = req.body.mode === "algorithmic" ? "algorithmic" : "random";

    const { data: allScores, error: sErr } = await supabase
      .from("scores")
      .select("score");
    if (sErr) throw sErr;

    const users = await getActiveUsersWithNumbers();
    const totalPrizePool = await getPrizePool();
    const carryover = await getCurrentCarryover();
    let winningNumbers = chooseWinningNumbers(mode, allScores || []);
    if (mode === "algorithmic") {
      winningNumbers = boostedAlgorithmicNumbers(winningNumbers, users, allScores || []);
    }

    const preview = buildDrawPreview({ users, winningNumbers, totalPrizePool, carryover });

    const now = new Date();
    const drawMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;

    // Check if a draw was already published this month
    const { data: existingMonthDraw, error: emErr } = await supabase
      .from("draws")
      .select("id")
      .eq("draw_month", drawMonth)
      .eq("published", true)
      .order("id", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (emErr) throw emErr;

    if (existingMonthDraw) {
      return res.status(409).json({
        message: "A draw has already been published for this month"
      });
    }

    // Insert the draw — JSONB columns accept native arrays directly
    const { data: drawRow, error: diErr } = await supabase
      .from("draws")
      .insert({
        draw_month: drawMonth,
        draw_mode: mode,
        winning_numbers: winningNumbers,
        published: true,
        jackpot_carryover: preview.nextCarryover,
        published_at: new Date().toISOString()
      })
      .select("id")
      .single();

    if (diErr) throw diErr;

    const drawId = drawRow.id;

    // Insert draw entries for all participants
    const entries = users.map((user) => {
      const numbers = toNumberArray(user.numbers_json);
      const winnerByTier =
        preview.tierWinners[5].find((w) => w.userId === user.user_id) ||
        preview.tierWinners[4].find((w) => w.userId === user.user_id) ||
        preview.tierWinners[3].find((w) => w.userId === user.user_id);

      const matches = winnerByTier?.matches || 0;
      let prize = 0;
      if (matches >= 3) {
        const tier = preview.payouts.find((p) => p.tier === matches);
        prize = tier?.perWinner || 0;
      }

      return {
        draw_id: drawId,
        user_id: user.user_id,
        numbers,
        match_count: matches,
        prize_amount: prize,
        verification_status: "pending",
        payment_status: "pending"
      };
    });

    if (entries.length) {
      const { error: beErr } = await supabase.from("draw_entries").insert(entries);
      if (beErr) throw beErr;
    }

    await notifyDrawPublished(drawId, preview);

    return res.status(201).json({
      message: "Draw published",
      drawId,
      results: preview
    });
  } catch (error) {
    return next(error);
  }
});

router.patch("/entries/:entryId/proof", requireAuth, upload.single("proofFile"), async (req, res, next) => {
  try {
    const { proofUrl } = req.body;
    const uploadedUrl = req.file
      ? `${process.env.SERVER_PUBLIC_URL || `http://localhost:${process.env.PORT || 4000}`}/uploads/proofs/${req.file.filename}`
      : null;

    const finalProofUrl = uploadedUrl || proofUrl;
    if (!finalProofUrl?.trim()) {
      return res.status(400).json({ message: "Proof URL or file is required" });
    }

    const { data: currentRows, error: crErr } = await supabase
      .from("draw_entries")
      .select("verification_status, payment_status")
      .eq("id", req.params.entryId)
      .eq("user_id", req.user.userId)
      .limit(1);

    if (crErr) throw crErr;

    if (!currentRows || !currentRows.length) {
      return res.status(404).json({ message: "Entry not found" });
    }

    if (
      currentRows[0].verification_status === "approved" ||
      currentRows[0].payment_status === "paid"
    ) {
      return res.status(400).json({
        message: "Proof is locked for approved or paid entries"
      });
    }

    const { data, error } = await supabase
      .from("draw_entries")
      .update({ proof_url: finalProofUrl, verification_status: "pending" })
      .eq("id", req.params.entryId)
      .eq("user_id", req.user.userId)
      .select();

    if (error) throw error;

    if (!data || data.length === 0) {
      return res.status(404).json({ message: "Entry not found" });
    }

    return res.json({ message: "Proof submitted" });
  } catch (error) {
    return next(error);
  }
});

router.patch("/entries/:entryId/verify", requireAuth, requireAdmin, async (req, res, next) => {
  try {
    const status = req.body.status === "approved" ? "approved" : "rejected";

    const { data, error } = await supabase
      .from("draw_entries")
      .update({ verification_status: status })
      .eq("id", req.params.entryId)
      .select();

    if (error) throw error;

    if (!data || data.length === 0) {
      return res.status(404).json({ message: "Entry not found" });
    }

    // Get user info for notification via relation
    const { data: entryRow, error: eErr } = await supabase
      .from("draw_entries")
      .select("match_count, prize_amount, users(email, name)")
      .eq("id", req.params.entryId)
      .limit(1)
      .maybeSingle();

    if (eErr) throw eErr;

    if (entryRow?.users?.email) {
      await sendNotificationEmail({
        to: entryRow.users.email,
        subject: `Winner Submission ${status === "approved" ? "Approved" : "Rejected"}`,
        text: `Hello ${entryRow.users.name}, your ${entryRow.match_count}-match submission was ${status}. Current prize amount: $${Number(entryRow.prize_amount || 0).toFixed(2)}.`
      });
    }

    return res.json({ message: `Entry ${status}` });
  } catch (error) {
    return next(error);
  }
});

router.patch("/entries/:entryId/pay", requireAuth, requireAdmin, async (req, res, next) => {
  try {
    const { data, error } = await supabase
      .from("draw_entries")
      .update({ payment_status: "paid" })
      .eq("id", req.params.entryId)
      .eq("verification_status", "approved")
      .select();

    if (error) throw error;

    if (!data || data.length === 0) {
      return res.status(400).json({ message: "Entry must be approved before payout" });
    }

    // Get user info for notification via relation
    const { data: entryRow, error: eErr } = await supabase
      .from("draw_entries")
      .select("match_count, prize_amount, users(email, name)")
      .eq("id", req.params.entryId)
      .limit(1)
      .maybeSingle();

    if (eErr) throw eErr;

    if (entryRow?.users?.email) {
      await sendNotificationEmail({
        to: entryRow.users.email,
        subject: "Payout Completed",
        text: `Hello ${entryRow.users.name}, your payout for ${entryRow.match_count}-match has been marked as paid. Amount: $${Number(entryRow.prize_amount || 0).toFixed(2)}.`
      });
    }

    return res.json({ message: "Payout marked as paid" });
  } catch (error) {
    return next(error);
  }
});

export default router;
