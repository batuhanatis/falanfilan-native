import { getLanguage } from "../i18n/core";
// "Salon" tasarımının yazıları (App.js'te yükleniyor). Başlıklar sinema tabelası gibi dar ve
// iri bir harfle, saat/sayı/meta satırları daktilo rakamıyla yazılıyor; gövde metni sistem fontu.
// Özel font kullanan stillerde fontWeight VERMİYORUZ — Android ağırlığı ayrı bir dosya olarak
// arıyor, bulamayınca sistem fontuna düşüyor.
export const FONTS = {
  marquee: "BigShoulders_800ExtraBold",
  marqueeBold: "BigShoulders_700Bold",
  marqueeMedium: "BigShoulders_500Medium",
  mono: "DMMono_400Regular",
  monoMedium: "DMMono_500Medium",
};

// Türkçe büyük harf: "i" → "İ", "ı" → "I". toLocaleUpperCase("tr") her JS motorunda
// güvenilir olmadığı için elle çeviriyoruz. Yalnızca Türkçe metinlerde kullan — yabancı bir
// film adı ("Inception") bununla "İNCEPTİON" olur.
export function upperTR(text) {
  if (getLanguage() === "en") return String(text || "").toUpperCase();
  return String(text || "").replace(/i/g, "İ").replace(/ı/g, "I").toUpperCase();
}
