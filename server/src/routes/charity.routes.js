import express from "express";
import { query } from "../db.js";
import { requireAuth, requireAdmin } from "../middleware/auth.js";

const router = express.Router();

const charityEventsByName = {
  "Nanhi Udaan Foundation": [
    {
      title: "Junior Golf Learning Day",
      date: "2026-04-20",
      city: "Hyderabad",
      description: "Weekend golf basics camp for school students supported by volunteer coaches."
    },
    {
      title: "Scholarship Screening Camp",
      date: "2026-05-12",
      city: "Pune",
      description: "Selection and mentoring workshop for the annual sports scholarship cohort."
    }
  ],
  "Swasth Bharat Trust": [
    {
      title: "Mobile Health Diagnostics Drive",
      date: "2026-04-15",
      city: "Vijayawada",
      description: "Preventive checkups and diagnostics support for rural families."
    },
    {
      title: "Women's Wellness Camp",
      date: "2026-05-03",
      city: "Warangal",
      description: "Community-focused health education and early screening initiative."
    }
  ],
  "Green India Collective": [
    {
      title: "Lake Revival Volunteer Day",
      date: "2026-04-28",
      city: "Bengaluru",
      description: "Field day for clean-up and biodiversity restoration around urban lakes."
    },
    {
      title: "Urban Tree Plantathon",
      date: "2026-05-18",
      city: "Chennai",
      description: "Corporate and community plan to plant 5,000 climate-resilient saplings."
    }
  ]
};

router.get("/", async (req, res, next) => {
  try {
    const search = req.query.search?.trim();
    let sql = `SELECT id, name, description, image_url, featured, active FROM charities WHERE active = 1`;
    const params = [];

    if (search) {
      sql += " AND (name LIKE ? OR description LIKE ?)";
      params.push(`%${search}%`, `%${search}%`);
    }

    sql += " ORDER BY featured DESC, name ASC";
    const rows = await query(sql, params);
    return res.json(rows);
  } catch (error) {
    return next(error);
  }
});

router.get("/featured", async (_req, res, next) => {
  try {
    const rows = await query(
      `SELECT id, name, description, image_url
       FROM charities
       WHERE active = 1 AND featured = 1
       ORDER BY id DESC
       LIMIT 1`
    );
    return res.json(rows[0] || null);
  } catch (error) {
    return next(error);
  }
});

router.get("/:id", async (req, res, next) => {
  try {
    const rows = await query(
      `SELECT id, name, description, image_url, featured, active
       FROM charities
       WHERE id = ? AND active = 1
       LIMIT 1`,
      [req.params.id]
    );

    if (!rows.length) {
      return res.status(404).json({ message: "Charity not found" });
    }

    const charity = rows[0];
    const events = charityEventsByName[charity.name] || [];
    const gallery = [
      charity.image_url,
      "https://images.unsplash.com/photo-1521737604893-d14cc237f11d",
      "https://images.unsplash.com/photo-1517486808906-6ca8b3f04846"
    ].filter(Boolean);

    return res.json({
      ...charity,
      impactHighlights: [
        "Transparent monthly reporting",
        "Volunteer-backed field execution",
        "Community partnerships across multiple cities"
      ],
      upcomingEvents: events,
      gallery
    });
  } catch (error) {
    return next(error);
  }
});

router.patch("/selection/me", requireAuth, async (req, res, next) => {
  try {
    const { charityId } = req.body;
    if (!charityId) {
      return res.status(400).json({ message: "Charity is required" });
    }

    const charityRows = await query("SELECT id FROM charities WHERE id = ? AND active = 1", [charityId]);
    if (!charityRows.length) {
      return res.status(404).json({ message: "Charity not found" });
    }

    await query(
      `INSERT INTO user_charity_preferences (user_id, charity_id)
       VALUES (?, ?)
       ON DUPLICATE KEY UPDATE charity_id = VALUES(charity_id)`,
      [req.user.userId, charityId]
    );

    return res.json({ message: "Charity preference updated" });
  } catch (error) {
    return next(error);
  }
});

router.post("/", requireAuth, requireAdmin, async (req, res, next) => {
  try {
    const { name, description, imageUrl = null, featured = 0 } = req.body;
    if (!name || !description) {
      return res.status(400).json({ message: "Name and description are required" });
    }

    await query(
      `INSERT INTO charities (name, description, image_url, featured, active)
       VALUES (?, ?, ?, ?, 1)`,
      [name, description, imageUrl, Number(featured) ? 1 : 0]
    );

    return res.status(201).json({ message: "Charity added" });
  } catch (error) {
    return next(error);
  }
});

router.put("/:id", requireAuth, requireAdmin, async (req, res, next) => {
  try {
    const { name, description, imageUrl = null, featured = 0, active = 1 } = req.body;
    const result = await query(
      `UPDATE charities
       SET name = ?, description = ?, image_url = ?, featured = ?, active = ?
       WHERE id = ?`,
      [name, description, imageUrl, Number(featured) ? 1 : 0, Number(active) ? 1 : 0, req.params.id]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ message: "Charity not found" });
    }

    return res.json({ message: "Charity updated" });
  } catch (error) {
    return next(error);
  }
});

router.delete("/:id", requireAuth, requireAdmin, async (req, res, next) => {
  try {
    const result = await query("UPDATE charities SET active = 0 WHERE id = ?", [req.params.id]);
    if (result.affectedRows === 0) {
      return res.status(404).json({ message: "Charity not found" });
    }
    return res.json({ message: "Charity archived" });
  } catch (error) {
    return next(error);
  }
});

export default router;
