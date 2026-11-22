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
    err.data = data; // ör. NO_SHARED_TITLES: ortak beğeni özeti ve öneriler
    throw err;
  }
  return data;
}

export const duelApi = {
  meta: (token) => request("/api/duels/meta", token),
  titles: (token, friendId) => request(`/api/duels/titles?friendId=${encodeURIComponent(friendId)}`, token),
  // sharedOnly: seçim listesinde yalnızca ikisinin de beğendiği yapımlar (verilmezse bütün soru havuzu).
  invite: (token, friendId, { sharedOnly } = {}) => request("/api/duels", token, { method: "POST", body: { friendId, ...(sharedOnly != null ? { sharedOnly: !!sharedOnly } : {}) } }),
  get: (token, id) => request(`/api/duels/${encodeURIComponent(id)}`, token),
  accept: (token, id) => request(`/api/duels/${encodeURIComponent(id)}/accept`, token, { method: "POST" }),
  decline: (token, id) => request(`/api/duels/${encodeURIComponent(id)}/decline`, token, { method: "POST" }),
  rematch: (token, id) => request(`/api/duels/${encodeURIComponent(id)}/rematch`, token, { method: "POST" }),
  // Günün Düellosu: durum + bugün oynayan arkadaşlar; sıradaki soru (saat sunucuda başlar); cevap.
  daily: (token) => request("/api/daily-duel", token),
  dailyNext: (token) => request("/api/daily-duel/next", token, { method: "POST" }),
  dailyAnswer: (token, index, choice) => request("/api/daily-duel/answer", token, { method: "POST", body: { index, choice } }),
  // Haftalık arkadaş ligi (pazartesi sıfırlanır).
  league: (token) => request("/api/duels/league", token),
  // Yapım istekleri: soru havuzu, beğendiklerinden havuzda olmayanlar ve kendi isteklerin.
  requests: (token) => request("/api/duels/requests", token),
  // { movieId } ya da { title, note }. Yanıt: { requested, duplicate, requestCount } ya da { available: true }.
  requestTitle: (token, body) => request("/api/duels/requests", token, { method: "POST", body }),
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

// Grup düellosu (sunucu: quiz-groups.js). Canlı akış /ws üzerinden "group_*" mesajlarıyla.
export const groupApi = {
  create: (token, friendIds) => request("/api/duel-groups", token, { method: "POST", body: { friendIds } }),
  get: (token, id) => request(`/api/duel-groups/${encodeURIComponent(id)}`, token),
  accept: (token, id) => request(`/api/duel-groups/${encodeURIComponent(id)}/accept`, token, { method: "POST" }),
  decline: (token, id) => request(`/api/duel-groups/${encodeURIComponent(id)}/decline`, token, { method: "POST" }),
  invite: (token, id, friendIds) => request(`/api/duel-groups/${encodeURIComponent(id)}/invite`, token, { method: "POST", body: { friendIds } }),
  again: (token, id) => request(`/api/duel-groups/${encodeURIComponent(id)}/again`, token, { method: "POST" }),
  history: (token) => request("/api/duel-groups/history", token),
};
export const GROUP_LIVE_PHASES = ["picking", "curtain", "question", "reveal"];
export const GROUP_OPEN_PHASES = ["lobby", ...GROUP_LIVE_PHASES];

// Bir düellonun sonuçlanmış olup olmadığı (ekrandan çıkarken "kaybedersin" uyarısı için).
export const DUEL_LIVE_PHASES = ["question", "reveal"];
export const DUEL_OPEN_PHASES = ["invited", "joining", "picking", "ready", "question", "reveal"];
