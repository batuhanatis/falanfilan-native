import AsyncStorage from "@react-native-async-storage/async-storage";

export const API_BASE = (process.env.EXPO_PUBLIC_API_BASE || "https://api.pellix.app").replace(/\/+$/, "");
const AUTH_KEY = "pellix_tv_auth";

async function request(path, { method = "GET", token, body } = {}) {
  const res = await fetch(API_BASE + path, {
    method,
    headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(data.error || "Bir şeyler ters gitti.");
    err.status = res.status;
    throw err;
  }
  return data;
}

export const api = {
  startPairing: (deviceName) => request("/api/tv/pair", { method: "POST", body: { deviceName } }),
  pairingStatus: (pairId) => request(`/api/tv/pair/${pairId}`),
  me: (token) => request("/api/me", { token }),
  // Telefondaki ana ekranla aynı öneri uçları (bkz. falanfilan-native HomeScreenV2).
  movies: (token, type, page) => request(`/api/movies?type=${type}&page=${page}`, { token }),
  trending: (token, type) => request(`/api/trending?type=${type}`, { token }),
  // Telefondaki "Bu akşam senin için" panosunun günlük seçkisi (telefon yazıyor).
  homeHero: (token) => request("/api/me/home-hero", { token }),
};

export async function loadAuth() {
  try {
    const raw = await AsyncStorage.getItem(AUTH_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export async function saveAuth(auth) {
  try {
    if (auth) await AsyncStorage.setItem(AUTH_KEY, JSON.stringify(auth));
    else await AsyncStorage.removeItem(AUTH_KEY);
  } catch { /* bir sonraki açılışta yeniden eşleştirilir */ }
}
