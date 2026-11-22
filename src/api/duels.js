import { API_BASE } from "./client";

// Dizi düellosu uçları (sunucu: quiz-duels.js). Canlı akış /ws üzerinden "duel_*" mesajlarıyla;
// bu dosya yalnızca davet, kabul ve bilgi isteklerini içeriyor.
async function request(path, token, { method = "GET", body } = {}) {
  const res = await fetch(`${API_BASE}${path}`, {
    method,
    headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(data.error || "Düello işlemi tamamlanamadı.");
    err.status = res.status;
    err.code = data.code;
    throw err;
  }
  return data;
}

export const duelApi = {
  meta: (token) => request("/api/duels/meta", token),
  titles: (token, friendId) => request(`/api/duels/titles?friendId=${encodeURIComponent(friendId)}`, token),
  invite: (token, friendId) => request("/api/duels", token, { method: "POST", body: { friendId } }),
  get: (token, id) => request(`/api/duels/${encodeURIComponent(id)}`, token),
  accept: (token, id) => request(`/api/duels/${encodeURIComponent(id)}/accept`, token, { method: "POST" }),
  decline: (token, id) => request(`/api/duels/${encodeURIComponent(id)}/decline`, token, { method: "POST" }),
  rematch: (token, id) => request(`/api/duels/${encodeURIComponent(id)}/rematch`, token, { method: "POST" }),
  // Bitmiş düellolar (yeniden eskiye) ve rakip başına karne. friendId: tek rakip; before: sonraki sayfa.
  history: (token, { friendId, limit, before } = {}) => {
    const q = new URLSearchParams();
    if (friendId != null) q.set("friendId", String(friendId));
    if (limit) q.set("limit", String(limit));
    if (before) q.set("before", String(before));
    const qs = q.toString();
    return request(`/api/duels/history${qs ? `?${qs}` : ""}`, token);
  },
};

// Bir düellonun sonuçlanmış olup olmadığı (ekrandan çıkarken "kaybedersin" uyarısı için).
export const DUEL_LIVE_PHASES = ["question", "reveal"];
export const DUEL_OPEN_PHASES = ["invited", "joining", "picking", "ready", "question", "reveal"];
