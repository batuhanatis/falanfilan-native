import { API_BASE } from "./client";

async function request(path, token, options = {}) {
  const res = await fetch(`${API_BASE}${path}`, {
    method: options.method || "GET",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: options.body ? JSON.stringify(options.body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(data.error || "Party link işlemi tamamlanamadı.");
    err.status = res.status;
    err.unavailable = res.status === 404;
    throw err;
  }
  return data;
}

export const partyLinkApi = {
  create: (token, filters, maxUses = 6) => request("/api/matchparty/link-session", token, {
    method: "POST",
    body: { filters, maxUses },
  }),
  preview: (token, inviteToken) => request(`/api/matchparty/link/${encodeURIComponent(inviteToken)}`, token),
  join: (token, inviteToken) => request(`/api/matchparty/link/${encodeURIComponent(inviteToken)}/join`, token, { method: "POST" }),
};
