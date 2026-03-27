import supabase from "../supabaseClient.js";

export async function getLatestSubscription(userId) {
  const { data, error } = await supabase
    .from("subscriptions")
    .select("id, plan, status, amount, renewal_date, charity_percentage, created_at")
    .eq("user_id", userId)
    .order("id", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  return data || null;
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
    const { error } = await supabase
      .from("subscriptions")
      .update({ status: normalized.status })
      .eq("id", current.id);
    if (error) throw error;
  }

  return normalized;
}

export async function assertActiveSubscription(userId) {
  const sub = await getLatestSubscriptionWithLifecycle(userId);
  return Boolean(sub && sub.status === "active");
}
