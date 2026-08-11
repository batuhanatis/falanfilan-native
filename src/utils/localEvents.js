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
