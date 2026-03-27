import { query } from "../db.js";

export async function getLatestSubscription(userId) {
  const rows = await query(
    `SELECT id, plan, status, amount, renewal_date, charity_percentage, created_at
     FROM subscriptions
     WHERE user_id = ?
     ORDER BY id DESC
     LIMIT 1`,
    [userId]
  );

  return rows[0] || null;
}

export function normalizeSubscriptionStatus(subscription) {
  if (!subscription) {
    return null;
  }

  const normalized = { ...subscription };
  if (
    normalized.status === "active" &&
    normalized.renewal_date &&
    new Date(normalized.renewal_date) < new Date()
  ) {
    normalized.status = "lapsed";
  }

  return normalized;
}

export async function getLatestSubscriptionWithLifecycle(userId) {
  const current = await getLatestSubscription(userId);
  if (!current) {
    return null;
  }

  const normalized = normalizeSubscriptionStatus(current);
  if (normalized.status !== current.status) {
    await query("UPDATE subscriptions SET status = ? WHERE id = ?", [normalized.status, current.id]);
  }

  return normalized;
}

export async function assertActiveSubscription(userId) {
  const sub = await getLatestSubscriptionWithLifecycle(userId);
  return Boolean(sub && sub.status === "active");
}
