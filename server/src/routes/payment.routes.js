import express from "express";
import { query } from "../db.js";
import { requireAuth } from "../middleware/auth.js";

const router = express.Router();

const CASHFREE_API_VERSION = process.env.CASHFREE_API_VERSION || "2023-08-01";
const CASHFREE_BASE_URL = process.env.CASHFREE_BASE_URL || "https://sandbox.cashfree.com/pg";

function getPaymentProvider() {
  return (process.env.PAYMENT_PROVIDER || "cashfree").toLowerCase();
}

function planAmount(plan) {
  return plan === "yearly" ? 500 : 50;
}

function nextRenewalDate(plan) {
  const renewalDate = new Date();
  renewalDate.setMonth(renewalDate.getMonth() + (plan === "yearly" ? 12 : 1));
  return renewalDate;
}

function getCashfreeConfig() {
  if (!process.env.CASHFREE_APP_ID || !process.env.CASHFREE_SECRET_KEY) {
    return null;
  }

  return {
    appId: process.env.CASHFREE_APP_ID,
    secretKey: process.env.CASHFREE_SECRET_KEY
  };
}

function buildCashfreeHeaders(config) {
  return {
    "x-client-id": config.appId,
    "x-client-secret": config.secretKey,
    "x-api-version": CASHFREE_API_VERSION,
    "Content-Type": "application/json"
  };
}

async function callCashfree(path, { method = "GET", body } = {}) {
  const config = getCashfreeConfig();
  if (!config) {
    throw new Error("Cashfree is not configured");
  }

  const response = await fetch(`${CASHFREE_BASE_URL}${path}`, {
    method,
    headers: buildCashfreeHeaders(config),
    ...(body ? { body: JSON.stringify(body) } : {})
  });

  const json = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message = json?.message || json?.error_description || "Cashfree request failed";
    throw new Error(message);
  }

  return json;
}

async function activateSubscription({ userId, plan, charityPercentage, charityId = null }) {
  await query(
    `INSERT INTO subscriptions
      (user_id, plan, status, amount, renewal_date, charity_percentage)
     VALUES (?, ?, 'active', ?, ?, ?)`,
    [userId, plan, planAmount(plan), nextRenewalDate(plan), charityPercentage]
  );

  if (charityId) {
    await query(
      `INSERT INTO user_charity_preferences (user_id, charity_id)
       VALUES (?, ?)
       ON DUPLICATE KEY UPDATE charity_id = VALUES(charity_id)`,
      [userId, charityId]
    );
  }
}

router.post("/checkout-session", requireAuth, async (req, res, next) => {
  try {
    const provider = getPaymentProvider();
    const plan = req.body?.plan === "yearly" ? "yearly" : "monthly";
    const charityPercentage = Number(req.body?.charityPercentage || 10);
    const charityId = req.body?.charityId ? Number(req.body.charityId) : null;
    const amount = planAmount(plan);
    const successUrl =
      process.env.PAYMENT_SUCCESS_URL || `${process.env.CLIENT_URL || "http://localhost:5173"}/dashboard`;
    const cancelUrl =
      process.env.PAYMENT_CANCEL_URL || `${process.env.CLIENT_URL || "http://localhost:5173"}/register`;

    if (provider === "mock") {
      return res.json({
        provider: "mock",
        orderId: `mock_sub_${req.user.userId}_${Date.now()}`,
        amount,
        currency: "INR",
        successUrl,
        cancelUrl,
        message: "Mock payment order created. Call /api/payments/verify with this orderId to activate."
      });
    }

    const config = getCashfreeConfig();
    if (!config) {
      return res.status(503).json({ message: "Cashfree is not configured" });
    }

    const [userRow] = await query(
      `SELECT name, email
       FROM users
       WHERE id = ?
       LIMIT 1`,
      [req.user.userId]
    );

    const orderId = `sub_${req.user.userId}_${Date.now()}`;
    const order = await callCashfree("/orders", {
      method: "POST",
      body: {
        order_id: orderId,
        order_amount: amount,
        order_currency: "INR",
        customer_details: {
          customer_id: String(req.user.userId),
          customer_name: userRow?.name || "Subscriber",
          customer_email: userRow?.email || req.user.email || "",
          customer_phone: req.body?.customerPhone || "9999999999"
        },
        order_meta: {
          return_url: `${successUrl}?order_id={order_id}`,
          notify_url: `${process.env.SERVER_PUBLIC_URL || "http://localhost:4000"}/api/payments/webhook`
        },
        order_tags: {
          userId: String(req.user.userId),
          plan,
          charityPercentage: String(charityPercentage),
          charityId: charityId ? String(charityId) : ""
        }
      }
    });

    return res.json({
      provider: "cashfree",
      orderId: order.order_id,
      cfOrderId: order.cf_order_id,
      paymentSessionId: order.payment_session_id,
      amount: order.order_amount,
      currency: order.order_currency,
      successUrl,
      cancelUrl
    });
  } catch (error) {
    return next(error);
  }
});

router.post("/verify", requireAuth, async (req, res, next) => {
  try {
    const provider = getPaymentProvider();
    const orderId = req.body?.orderId;
    if (!orderId) {
      return res.status(400).json({ message: "orderId is required" });
    }

    if (provider === "mock") {
      const plan = req.body?.plan === "yearly" ? "yearly" : "monthly";
      const charityPercentage = Number(req.body?.charityPercentage || 10);
      const charityId = req.body?.charityId ? Number(req.body.charityId) : null;

      await activateSubscription({
        userId: req.user.userId,
        plan,
        charityPercentage,
        charityId
      });

      return res.json({ message: "Mock payment verified and subscription activated" });
    }

    const order = await callCashfree(`/orders/${orderId}`);
    if (order.order_status !== "PAID") {
      return res.status(400).json({ message: `Order is not paid yet (status: ${order.order_status})` });
    }

    const tags = order.order_tags || {};
    const tagUserId = Number(tags.userId || order.customer_details?.customer_id || 0);
    if (tagUserId !== req.user.userId) {
      return res.status(403).json({ message: "Order does not belong to this user" });
    }

    const plan = tags.plan === "yearly" ? "yearly" : "monthly";
    const charityPercentage = Number(tags.charityPercentage || 10);
    const charityId = tags.charityId ? Number(tags.charityId) : null;

    await activateSubscription({
      userId: req.user.userId,
      plan,
      charityPercentage,
      charityId
    });

    return res.json({ message: "Cashfree payment verified and subscription activated" });
  } catch (error) {
    return next(error);
  }
});

export async function handleCashfreeWebhook(req, res, next) {
  try {
    const provider = getPaymentProvider();
    if (provider === "mock") {
      return res.json({ received: true, skipped: "mock-provider" });
    }

    const body = Buffer.isBuffer(req.body)
      ? JSON.parse(req.body.toString("utf8"))
      : req.body || {};

    const event = body.type || body.event;
    const orderId = body.data?.order?.order_id || body.order?.order_id || body.order_id;

    if ((event === "PAYMENT_SUCCESS_WEBHOOK" || event === "payment_success" || event === "payment.captured") && orderId) {
      const order = await callCashfree(`/orders/${orderId}`);
      if (order.order_status === "PAID") {
        const tags = order.order_tags || {};
        const userId = Number(tags.userId || order.customer_details?.customer_id || 0);
        if (userId <= 0) {
          return res.json({ received: true });
        }

        await activateSubscription({
          userId,
          plan: tags.plan === "yearly" ? "yearly" : "monthly",
          charityPercentage: Number(tags.charityPercentage || 10),
          charityId: tags.charityId ? Number(tags.charityId) : null
        });
      }
    }

    return res.json({ received: true });
  } catch (error) {
    return next(error);
  }
}

export default router;
