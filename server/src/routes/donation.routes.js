import express from "express";
import { query } from "../db.js";
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
      const charity = await query(
        "SELECT id FROM charities WHERE id = ? AND active = 1 LIMIT 1",
        [charityId]
      );
      if (!charity.length) {
        return res.status(400).json({ message: "Selected charity not found" });
      }
    }

    await query(
      `INSERT INTO donations (user_id, charity_id, amount, note)
       VALUES (?, ?, ?, ?)`,
      [req.user.userId, charityId || null, parsedAmount, note]
    );

    return res.status(201).json({ message: "Donation recorded" });
  } catch (error) {
    return next(error);
  }
});

router.get("/me", requireAuth, async (req, res, next) => {
  try {
    const rows = await query(
      `SELECT d.id, d.amount, d.note, d.created_at,
              c.id AS charity_id, c.name AS charity_name
       FROM donations d
       LEFT JOIN charities c ON c.id = d.charity_id
       WHERE d.user_id = ?
       ORDER BY d.created_at DESC`,
      [req.user.userId]
    );

    return res.json(rows);
  } catch (error) {
    return next(error);
  }
});

router.get("/admin", requireAuth, requireAdmin, async (_req, res, next) => {
  try {
    const rows = await query(
      `SELECT d.id, d.amount, d.note, d.created_at,
              u.id AS user_id, u.name AS user_name, u.email AS user_email,
              c.id AS charity_id, c.name AS charity_name
       FROM donations d
       JOIN users u ON u.id = d.user_id
       LEFT JOIN charities c ON c.id = d.charity_id
       ORDER BY d.created_at DESC`
    );

    return res.json(rows);
  } catch (error) {
    return next(error);
  }
});

export default router;
