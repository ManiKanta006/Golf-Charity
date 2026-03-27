import express from "express";
import supabase from "../supabaseClient.js";
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
    let qb = supabase
      .from("charities")
      .select("id, name, description, image_url, featured, active")
      .eq("active", true);

    if (search) {
      qb = qb.or(`name.ilike.%${search}%,description.ilike.%${search}%`);
    }

    const { data: rows, error } = await qb
      .order("featured", { ascending: false })
      .order("name", { ascending: true });

    if (error) throw error;
    return res.json(rows || []);
  } catch (error) {
    return next(error);
  }
});

router.get("/featured", async (_req, res, next) => {
  try {
    const { data, error } = await supabase
      .from("charities")
      .select("id, name, description, image_url")
      .eq("active", true)
      .eq("featured", true)
      .order("id", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) throw error;
    return res.json(data || null);
  } catch (error) {
    return next(error);
  }
});

router.get("/:id", async (req, res, next) => {
  try {
    const { data: charity, error } = await supabase
      .from("charities")
      .select("id, name, description, image_url, featured, active")
      .eq("id", req.params.id)
      .eq("active", true)
      .maybeSingle();

    if (error) throw error;

    if (!charity) {
      return res.status(404).json({ message: "Charity not found" });
    }

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

    const { data: charityRows, error: cErr } = await supabase
      .from("charities")
      .select("id")
      .eq("id", charityId)
      .eq("active", true)
      .limit(1);

    if (cErr) throw cErr;

    if (!charityRows || !charityRows.length) {
      return res.status(404).json({ message: "Charity not found" });
    }

    const { error: upsertErr } = await supabase
      .from("user_charity_preferences")
      .upsert(
        { user_id: req.user.userId, charity_id: charityId },
        { onConflict: "user_id" }
      );

    if (upsertErr) throw upsertErr;
    return res.json({ message: "Charity preference updated" });
  } catch (error) {
    return next(error);
  }
});

router.post("/", requireAuth, requireAdmin, async (req, res, next) => {
  try {
    const { name, description, imageUrl = null, featured = false } = req.body;
    if (!name || !description) {
      return res.status(400).json({ message: "Name and description are required" });
    }

    const { error } = await supabase
      .from("charities")
      .insert({
        name,
        description,
        image_url: imageUrl,
        featured: Boolean(Number(featured)),
        active: true
      });

    if (error) throw error;
    return res.status(201).json({ message: "Charity added" });
  } catch (error) {
    return next(error);
  }
});

router.put("/:id", requireAuth, requireAdmin, async (req, res, next) => {
  try {
    const { name, description, imageUrl = null, featured = false, active = true } = req.body;

    const { data, error } = await supabase
      .from("charities")
      .update({
        name,
        description,
        image_url: imageUrl,
        featured: Boolean(Number(featured)),
        active: Boolean(Number(active))
      })
      .eq("id", req.params.id)
      .select();

    if (error) throw error;

    if (!data || data.length === 0) {
      return res.status(404).json({ message: "Charity not found" });
    }

    return res.json({ message: "Charity updated" });
  } catch (error) {
    return next(error);
  }
});

router.delete("/:id", requireAuth, requireAdmin, async (req, res, next) => {
  try {
    const { data, error } = await supabase
      .from("charities")
      .update({ active: false })
      .eq("id", req.params.id)
      .select();

    if (error) throw error;

    if (!data || data.length === 0) {
      return res.status(404).json({ message: "Charity not found" });
    }
    return res.json({ message: "Charity archived" });
  } catch (error) {
    return next(error);
  }
});

export default router;
