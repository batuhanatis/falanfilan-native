// #rgb / #rrggbb hex rengi rgba() string'ine çeviriyor — tema renklerini (c.bg gibi) opaklık
// vererek bir görselin üzerine karartma/vinyet katmanı olarak bindirebilmek için.
export function hexToRgba(hex, alpha) {
  const h = hex.replace("#", "");
  const full = h.length === 3 ? h.split("").map((ch) => ch + ch).join("") : h;
  const r = parseInt(full.slice(0, 2), 16);
  const g = parseInt(full.slice(2, 4), 16);
  const b = parseInt(full.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}
