const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:4000/api";

async function request(path, { method = "GET", body, token } = {}) {
  const isFormData = typeof FormData !== "undefined" && body instanceof FormData;
  const res = await fetch(`${API_BASE}${path}`, {
    method,
    headers: {
      ...(isFormData ? {} : { "Content-Type": "application/json" }),
      ...(token ? { Authorization: `Bearer ${token}` } : {})
    },
    ...(body ? { body: isFormData ? body : JSON.stringify(body) } : {})
  });

  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.message || "Request failed");
  }

  return res.json();
}

export const api = {
  health: () => request("/health"),
  register: (payload) => request("/auth/register", { method: "POST", body: payload }),
  login: (payload) => request("/auth/login", { method: "POST", body: payload }),
  me: (token) => request("/auth/me", { token }),
  getCharities: (search = "") => request(`/charities${search ? `?search=${encodeURIComponent(search)}` : ""}`),
  updateMyCharitySelection: (token, charityId) =>
    request("/charities/selection/me", { method: "PATCH", token, body: { charityId } }),
  getCharityById: (charityId) => request(`/charities/${charityId}`),
  createCharity: (token, payload) => request("/charities", { method: "POST", token, body: payload }),
  updateCharity: (token, charityId, payload) =>
    request(`/charities/${charityId}`, { method: "PUT", token, body: payload }),
  archiveCharity: (token, charityId) => request(`/charities/${charityId}`, { method: "DELETE", token }),
  getFeaturedCharity: () => request("/charities/featured"),
  getDashboard: (token) => request("/dashboard/me", { token }),
  getAdminSummary: (token) => request("/dashboard/admin/summary", { token }),
  getAdminUsers: (token) => request("/dashboard/admin/users", { token }),
  updateAdminUser: (token, userId, payload) =>
    request(`/dashboard/admin/users/${userId}`, { method: "PATCH", token, body: payload }),
  overrideAdminUserSubscription: (token, userId, payload) =>
    request(`/dashboard/admin/users/${userId}/subscription`, {
      method: "PATCH",
      token,
      body: payload
    }),
  getAdminUserScores: (token, userId) => request(`/scores/admin/${userId}`, { token }),
  updateAdminUserScore: (token, userId, scoreId, payload) =>
    request(`/scores/admin/${userId}/${scoreId}`, { method: "PUT", token, body: payload }),
  getScores: (token) => request("/scores/me", { token }),
  addScore: (token, payload) => request("/scores/me", { method: "POST", token, body: payload }),
  updateScore: (token, scoreId, payload) => request(`/scores/me/${scoreId}`, { method: "PUT", token, body: payload }),
  simulateDraw: (token, mode) => request("/draws/simulate", { method: "POST", token, body: { mode } }),
  publishDraw: (token, mode) => request("/draws/publish", { method: "POST", token, body: { mode } }),
  getWinnerEntries: (token) => request("/draws/entries/admin", { token }),
  getMyWinnerEntries: (token) => request("/draws/entries/me", { token }),
  submitWinnerProof: (token, entryId, proofUrl) =>
    request(`/draws/entries/${entryId}/proof`, { method: "PATCH", token, body: { proofUrl } }),
  submitWinnerProofFile: (token, entryId, file) => {
    const formData = new FormData();
    formData.append("proofFile", file);
    return request(`/draws/entries/${entryId}/proof`, { method: "PATCH", token, body: formData });
  },
  verifyWinnerEntry: (token, entryId, status) =>
    request(`/draws/entries/${entryId}/verify`, { method: "PATCH", token, body: { status } }),
  payWinnerEntry: (token, entryId) =>
    request(`/draws/entries/${entryId}/pay`, { method: "PATCH", token }),
  latestDraw: () => request("/draws/latest"),
  subscriptionMe: (token) => request("/subscriptions/me", { token }),
  updateSubscription: (token, payload) => request("/subscriptions/me", { method: "POST", token, body: payload }),
  updateMyCharityPercentage: (token, charityPercentage) =>
    request("/subscriptions/me/charity-percentage", {
      method: "PATCH",
      token,
      body: { charityPercentage }
    }),
  cancelSubscription: (token) => request("/subscriptions/me/cancel", { method: "PATCH", token }),
  resubscribe: (token) => request("/subscriptions/me/resubscribe", { method: "PATCH", token }),
  createDonation: (token, payload) => request("/donations/me", { method: "POST", token, body: payload }),
  getMyDonations: (token) => request("/donations/me", { token }),
  getAdminDonations: (token) => request("/donations/admin", { token }),
  createPaymentOrder: (token, payload) =>
    request("/payments/checkout-session", { method: "POST", token, body: payload }),
  verifyPayment: (token, payload) =>
    request("/payments/verify", { method: "POST", token, body: payload })
};
