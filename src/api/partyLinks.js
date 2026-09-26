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
  create: async (token, filters, maxUses = 6) => {
    const data = await request("/api/matchparty/link-session", token, {
      method: "POST",
      body: { filters, maxUses },
    });
    // OTA uyumluluğu: mevcut native binary Android'de yalnız /u ve /blend app-link path'lerini
    // biliyor. Yeni /party intent filter'ı eklemek yeni build gerektirirdi. Party linkini mevcut
    // /u prefix'inin altında özel bir alt yol olarak veriyoruz; RootNavigator bunu önce yakalayıp
    // PartyJoin'e yönlendiriyor. Böylece yeni native config gerekmiyor.
    return { ...data, url: `https://open.pellix.app/u/party/${encodeURIComponent(data.token)}` };
  },
  preview: (token, inviteToken) => request(`/api/matchparty/link/${encodeURIComponent(inviteToken)}`, token),
  join: (token, inviteToken) => request(`/api/matchparty/link/${encodeURIComponent(inviteToken)}/join`, token, { method: "POST" }),
};
