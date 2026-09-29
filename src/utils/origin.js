// Yerli / yabancı ayrımı. TEK KURAL: TMDB'nin original_language alanı "tr" ise içerik yerli.
// Sunucudaki karşılığı server.js → DOMESTIC_LANGUAGE + originSqlCondition; ikisinin aynı
// kuralı uygulaması şart, yoksa Ana Sayfa (istemci tarafı süzme) ile MatchParty/AI
// (sunucu tarafı süzme) farklı sonuç verir.
export const ORIGIN_OPTIONS = [
  { key: null, label: "Hepsi" },
  { key: "yerli", label: "Yerli" },
  { key: "yabanci", label: "Yabancı" },
];

const DOMESTIC_LANGUAGE = "tr";

export function isDomestic(movie) {
  return String(movie?.originalLanguage || "").toLowerCase() === DOMESTIC_LANGUAGE;
}

// origin null/bilinmeyen ise filtre uygulanmaz. "yabanci" tarafında dili HİÇ bilinmeyen
// içerikler de kalıyor (sunucudaki IS DISTINCT FROM ile aynı davranış) — aksi halde bir
// içerik iki taraftan da düşer ve filtre açıldığında liste sessizce küçülürdü.
export function matchesOrigin(movie, origin) {
  if (origin !== "yerli" && origin !== "yabanci") return true;
  return origin === "yerli" ? isDomestic(movie) : !isDomestic(movie);
}
