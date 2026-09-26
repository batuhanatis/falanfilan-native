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
    const err = new Error(data.error || "Friend Battle işlemi tamamlanamadı.");
    err.status = res.status;
    err.unavailable = res.status === 404;
    throw err;
  }
  return data;
}

export const friendBattleApi = {
  inbox: (token) => request("/api/play/friend-battle", token),
  create: (token, opponentId) => request("/api/play/friend-battle", token, {
    method: "POST",
    body: { opponentId },
  }),
  detail: (token, battleId) => request(`/api/play/friend-battle/${encodeURIComponent(battleId)}`, token),
  submit: (token, battleId, answers) => request(`/api/play/friend-battle/${encodeURIComponent(battleId)}/submit`, token, {
    method: "POST",
    body: { answers },
  }),
};
