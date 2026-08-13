import { api } from "../api/client";

// Sunucudan gelen WebSocket olaylarından FARKLI olarak, bunlar tamamen cihaz içinde kalan,
// anlık olaylar için (ör. "X listesine eklendi" bildirimi) — bir ekrandan tetiklenip, ağacın
// en üstündeki GlobalPopups tarafından yakalanıp gösterilebilsin diye basit bir pub/sub.
const listeners = new Set();

export function emitLocalEvent(event) {
  listeners.forEach((fn) => fn(event));
}

export function subscribeLocalEvents(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

// Profil kaydı yalnız ProfileScreen'in local state'ini değil, AuthContext'teki kimliği de
// güncellesin. AuthContext bu event'i dinliyor; böylece sayfa düzenine dokunmadan auth.name ve
// auth.username kullanan paylaşım/sohbet akışları da anında tazeleniyor.
const originalUpdateMe = api.updateMe;
api.updateMe = async (token, payload) => {
  const result = await originalUpdateMe(token, payload);
  const patch = {};
  if (payload?.name != null) patch.name = payload.name;
  if (payload?.username != null) patch.username = result?.username ?? payload.username;
  if (Object.keys(patch).length) emitLocalEvent({ type: "profile_updated", patch });
  return result;
};
