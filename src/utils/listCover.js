// WL1 — bir liste kapak rengi seçmediyse bile, id'sinden DETERMİNİSTİK bir renk türetiyoruz
// (aynı liste her zaman aynı rengi alır) — hiçbir liste "içi boş" bir gri kutu olarak kalmasın.
const FALLBACK_COLORS = ["#8e2de2", "#0EA5E9", "#F97316", "#14B8A6", "#DB2777", "#7C3AED", "#22C55E", "#EAB308"];

export function watchlistFallbackColor(list) {
  const seed = Number(list?.id) || 0;
  return FALLBACK_COLORS[seed % FALLBACK_COLORS.length];
}

export const COVER_EMOJI_OPTIONS = ["🎬", "🍿", "🔥", "😂", "😱", "💕", "🚀", "🎃", "📺", "✨"];
export const COVER_COLOR_OPTIONS = FALLBACK_COLORS;
