import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

import authRoutes from "./routes/auth.routes.js";
import charityRoutes from "./routes/charity.routes.js";
import scoreRoutes from "./routes/score.routes.js";
import drawRoutes from "./routes/draw.routes.js";
import dashboardRoutes from "./routes/dashboard.routes.js";
import subscriptionRoutes from "./routes/subscription.routes.js";
import donationRoutes from "./routes/donation.routes.js";
import paymentRoutes, { handleCashfreeWebhook } from "./routes/payment.routes.js";

dotenv.config();

const app = express();
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

app.use(cors({ origin: process.env.CLIENT_URL || "http://localhost:5173" }));
app.post("/api/payments/webhook", express.raw({ type: "application/json" }), handleCashfreeWebhook);
app.use(express.json());
app.use("/uploads", express.static(path.resolve(__dirname, "../uploads")));

app.get("/api/health", (_req, res) => {
  res.json({ status: "ok", service: "golf-charity-server" });
});

app.use("/api/auth", authRoutes);
app.use("/api/charities", charityRoutes);
app.use("/api/scores", scoreRoutes);
app.use("/api/draws", drawRoutes);
app.use("/api/dashboard", dashboardRoutes);
app.use("/api/subscriptions", subscriptionRoutes);
app.use("/api/donations", donationRoutes);
app.use("/api/payments", paymentRoutes);

app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(500).json({ message: "Internal server error" });
});

export default app;