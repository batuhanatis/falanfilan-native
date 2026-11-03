// Satırlarda odaktaki içerik. Üstteki tanıtım şeridi buna abone; afiş değiştikçe yalnızca şerit
// yeniden çiziliyor, ana ekranın tamamı değil (TV'de akıcılık için).
const listeners = new Set();
let current = null;

export const focusStore = {
  get: () => current,
  set(movie) {
    if (movie === current) return;
    current = movie;
    listeners.forEach((l) => l(movie));
  },
  subscribe(listener) {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },
};
