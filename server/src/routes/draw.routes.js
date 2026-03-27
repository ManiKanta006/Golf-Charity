import express from "express";
import fs from "fs";
import path from "path";
import multer from "multer";
import { fileURLToPath } from "url";
import { query } from "../db.js";
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
  // Keep SQL compatible with older MySQL variants by avoiding JSON aggregation
  // ordering and window functions.
  const activeUsers = await query(
    `SELECT u.id AS user_id, u.name,
            COALESCE((
              SELECT COUNT(*)
              FROM draw_entries de
              WHERE de.user_id = u.id AND de.match_count >= 3
            ), 0) AS historical_wins
     FROM users u
     JOIN subscriptions sub ON sub.user_id = u.id
     WHERE sub.id = (
       SELECT s2.id FROM subscriptions s2 WHERE s2.user_id = u.id ORDER BY s2.id DESC LIMIT 1
     )
       AND sub.status = 'active'`
  );

  const usersWithNumbers = [];

  for (const user of activeUsers) {
    const scores = await query(
      `SELECT score
       FROM scores
       WHERE user_id = ?
       ORDER BY date_played DESC, created_at DESC
       LIMIT 5`,
      [user.user_id]
    );

    if (scores.length === 5) {
      usersWithNumbers.push({
        user_id: user.user_id,
        name: user.name,
        historical_wins: Number(user.historical_wins || 0),
        numbers_json: JSON.stringify(scores.map((row) => Number(row.score)))
      });
    }
  }

  return usersWithNumbers;
}

async function getPrizePool() {
  const [row] = await query(
    `SELECT COALESCE(SUM(amount * 0.3), 0) AS totalPrizePool
     FROM subscriptions
     WHERE status = 'active'`
  );
  return Number(row.totalPrizePool || 0);
}

async function getCurrentCarryover() {
  const [row] = await query(
    `SELECT jackpot_carryover
     FROM draws
     ORDER BY id DESC
     LIMIT 1`
  );
  return Number(row?.jackpot_carryover || 0);
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
  const rows = await query(
    `SELECT DISTINCT u.email
     FROM users u
     JOIN subscriptions sub ON sub.user_id = u.id
     WHERE sub.id = (
       SELECT s2.id FROM subscriptions s2 WHERE s2.user_id = u.id ORDER BY s2.id DESC LIMIT 1
     )
       AND sub.status = 'active'`
  );

  const winningNumbers = preview.winningNumbers.join(", ");
  await sendBulkNotification(
    rows.map((r) => r.email),
    () => ({
      subject: `Monthly Draw Published (Draw #${drawId})`,
      text: `The monthly draw is now live. Winning numbers: ${winningNumbers}. Log in to view results and winner status.`
    })
  );
}

router.get("/latest", async (_req, res, next) => {
  try {
    const rows = await query(
      `SELECT id, draw_month, draw_mode, winning_numbers, published, jackpot_carryover, created_at, published_at
       FROM draws
       WHERE published = 1
       ORDER BY id DESC
       LIMIT 1`
    );

    if (!rows.length) {
      return res.json(null);
    }

    const draw = rows[0];
    draw.winning_numbers = toNumberArray(draw.winning_numbers);
    return res.json(draw);
  } catch (error) {
    return next(error);
  }
});

router.get("/entries/admin", requireAuth, requireAdmin, async (_req, res, next) => {
  try {
    const rows = await query(
      `SELECT de.id, de.draw_id, de.user_id, de.match_count, de.prize_amount,
              de.proof_url, de.verification_status, de.payment_status, de.created_at,
              u.name AS user_name, u.email AS user_email,
              d.draw_month, d.draw_mode
       FROM draw_entries de
       JOIN users u ON u.id = de.user_id
       JOIN draws d ON d.id = de.draw_id
       WHERE de.match_count >= 3
       ORDER BY de.created_at DESC`
    );

    return res.json(rows);
  } catch (error) {
    return next(error);
  }
});

router.get("/entries/me", requireAuth, async (req, res, next) => {
  try {
    const rows = await query(
      `SELECT de.id, de.draw_id, de.match_count, de.prize_amount,
              de.proof_url, de.verification_status, de.payment_status, de.created_at,
              d.draw_month, d.draw_mode
       FROM draw_entries de
       JOIN draws d ON d.id = de.draw_id
       WHERE de.user_id = ? AND de.match_count >= 3
       ORDER BY de.created_at DESC`,
      [req.user.userId]
    );

    return res.json(rows);
  } catch (error) {
    return next(error);
  }
});

router.post("/simulate", requireAuth, requireAdmin, async (req, res, next) => {
  try {
    const mode = req.body.mode === "algorithmic" ? "algorithmic" : "random";
    const allScores = await query("SELECT score FROM scores");
    const users = await getActiveUsersWithNumbers();
    const totalPrizePool = await getPrizePool();
    const carryover = await getCurrentCarryover();
    let winningNumbers = chooseWinningNumbers(mode, allScores);
    if (mode === "algorithmic") {
      winningNumbers = boostedAlgorithmicNumbers(winningNumbers, users, allScores);
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
    const allScores = await query("SELECT score FROM scores");
    const users = await getActiveUsersWithNumbers();
    const totalPrizePool = await getPrizePool();
    const carryover = await getCurrentCarryover();
    let winningNumbers = chooseWinningNumbers(mode, allScores);
    if (mode === "algorithmic") {
      winningNumbers = boostedAlgorithmicNumbers(winningNumbers, users, allScores);
    }

    const preview = buildDrawPreview({ users, winningNumbers, totalPrizePool, carryover });

    const now = new Date();
    const drawMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;

    const [existingMonthDraw] = await query(
      `SELECT id
       FROM draws
       WHERE draw_month = ? AND published = 1
       ORDER BY id DESC
       LIMIT 1`,
      [drawMonth]
    );

    if (existingMonthDraw) {
      return res.status(409).json({
        message: "A draw has already been published for this month"
      });
    }

    const drawInsert = await query(
      `INSERT INTO draws (draw_month, draw_mode, winning_numbers, published, jackpot_carryover, published_at)
       VALUES (?, ?, ?, 1, ?, NOW())`,
      [drawMonth, mode, JSON.stringify(winningNumbers), preview.nextCarryover]
    );

    const drawId = drawInsert.insertId;

    for (const user of users) {
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

      await query(
        `INSERT INTO draw_entries
          (draw_id, user_id, numbers, match_count, prize_amount, verification_status, payment_status)
         VALUES (?, ?, ?, ?, ?, 'pending', 'pending')`,
        [drawId, user.user_id, JSON.stringify(numbers), matches, prize]
      );
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

    const currentRows = await query(
      `SELECT verification_status, payment_status
       FROM draw_entries
       WHERE id = ? AND user_id = ?
       LIMIT 1`,
      [req.params.entryId, req.user.userId]
    );

    if (!currentRows.length) {
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

    const result = await query(
      `UPDATE draw_entries
       SET proof_url = ?, verification_status = 'pending'
       WHERE id = ? AND user_id = ?`,
      [finalProofUrl, req.params.entryId, req.user.userId]
    );

    if (result.affectedRows === 0) {
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
    const result = await query(
      `UPDATE draw_entries
       SET verification_status = ?
       WHERE id = ?`,
      [status, req.params.entryId]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ message: "Entry not found" });
    }

    const [entryRow] = await query(
      `SELECT u.email, u.name, de.match_count, de.prize_amount
       FROM draw_entries de
       JOIN users u ON u.id = de.user_id
       WHERE de.id = ?
       LIMIT 1`,
      [req.params.entryId]
    );

    if (entryRow?.email) {
      await sendNotificationEmail({
        to: entryRow.email,
        subject: `Winner Submission ${status === "approved" ? "Approved" : "Rejected"}`,
        text: `Hello ${entryRow.name}, your ${entryRow.match_count}-match submission was ${status}. Current prize amount: $${Number(entryRow.prize_amount || 0).toFixed(2)}.`
      });
    }

    return res.json({ message: `Entry ${status}` });
  } catch (error) {
    return next(error);
  }
});

router.patch("/entries/:entryId/pay", requireAuth, requireAdmin, async (req, res, next) => {
  try {
    const result = await query(
      `UPDATE draw_entries
       SET payment_status = 'paid'
       WHERE id = ? AND verification_status = 'approved'`,
      [req.params.entryId]
    );

    if (result.affectedRows === 0) {
      return res.status(400).json({ message: "Entry must be approved before payout" });
    }

    const [entryRow] = await query(
      `SELECT u.email, u.name, de.match_count, de.prize_amount
       FROM draw_entries de
       JOIN users u ON u.id = de.user_id
       WHERE de.id = ?
       LIMIT 1`,
      [req.params.entryId]
    );

    if (entryRow?.email) {
      await sendNotificationEmail({
        to: entryRow.email,
        subject: "Payout Completed",
        text: `Hello ${entryRow.name}, your payout for ${entryRow.match_count}-match has been marked as paid. Amount: $${Number(entryRow.prize_amount || 0).toFixed(2)}.`
      });
    }

    return res.json({ message: "Payout marked as paid" });
  } catch (error) {
    return next(error);
  }
});

export default router;
