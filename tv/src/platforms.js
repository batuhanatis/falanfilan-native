import { PLATFORM_PACKAGES } from "./platformPackages.json";
import { openUrl, openApp } from "../modules/platform-launcher";

// Ekranda görünen ad ve Türkçe ekiyle "…'te izle" metni.
const LABELS = {
  "Netflix": { name: "Netflix", watch: "Netflix'te izle", open: "Netflix'i aç" },
  "Disney Plus": { name: "Disney+", watch: "Disney+'ta izle", open: "Disney+'ı aç" },
  "HBO Max": { name: "HBO Max", watch: "HBO Max'te izle", open: "HBO Max'i aç" },
  "Amazon Prime Video": { name: "Prime Video", watch: "Prime Video'da izle", open: "Prime Video'yu aç" },
  "TV+": { name: "TV+", watch: "TV+ uygulamasında izle", open: "TV+ uygulamasını aç" },
  "TOD TV": { name: "TOD", watch: "TOD uygulamasında izle", open: "TOD uygulamasını aç" },
};

export function platformLabel(platform) {
  return LABELS[platform] || { name: platform, watch: `${platform} uygulamasında izle`, open: `${platform} uygulamasını aç` };
}

// TV'de bu platformu açabiliyor muyuz: içerik linki ya da bilinen bir uygulama paketi gerekli.
export function canOpenPlatform(link) {
  return !!(link?.url || (PLATFORM_PACKAGES[link?.platform] || []).length);
}

// Netflix, TV uygulamasına dışarıdan gelen içerik linkinde bu ekstrayı bekliyor.
const EXTRAS = { "Netflix": { source: "30" } };

// Dönüş: { ok: true, how: "deep" | "app" } ya da { ok: false, reason }.
export function openOnPlatform(link) {
  const packages = PLATFORM_PACKAGES[link.platform] || [];
  try {
    if (link.url) {
      const r = openUrl(link.url, packages, EXTRAS[link.platform] || {});
      if (r) return { ok: true, how: "deep" };
    }
    if (packages.length) {
      const r = openApp(packages);
      if (r) return { ok: true, how: "app" };
      return { ok: false, reason: "not_installed" };
    }
    return { ok: false, reason: "unknown_app" };
  } catch (e) {
    return { ok: false, reason: "error", message: e?.message };
  }
}

// İçeriğin platform listesi: API'nin watchLinks'i, yoksa yalnızca platform adları (link yok).
export function watchLinksOf(movie) {
  return Array.isArray(movie?.watchLinks) && movie.watchLinks.length
    ? movie.watchLinks
    : (movie?.platforms || []).map((p) => ({ platform: p.name, url: null }));
}

// Panodaki tek "izle" düğmesi için: TV'de açabildiğimiz ilk platform (yoksa null).
export function primaryWatchLink(movie) {
  return watchLinksOf(movie).find(canOpenPlatform) || null;
}

// Düğme metni: içerik linki varsa "Netflix'te izle", yoksa "Netflix'i aç".
export function watchButtonLabel(link) {
  const label = platformLabel(link.platform);
  return link.url ? label.watch : label.open;
}

// Platformu açar ve ekranda gösterilecek durumu döner: { text, tone: "info" | "error" }.
export function watchAndDescribe(link) {
  const label = platformLabel(link.platform);
  const r = openOnPlatform(link);
  if (r.ok && r.how === "deep") return { text: `${label.name} açılıyor…`, tone: "info" };
  if (r.ok) return { text: `Bu içeriğin ${label.name} linki henüz yok; ${label.name} açıldı, adını aratabilirsin.`, tone: "info" };
  if (r.reason === "not_installed") return { text: `${label.name} bu TV'de yüklü değil.`, tone: "error" };
  if (r.reason === "unknown_app") return { text: `${label.name} uygulamasını bu TV'de henüz açamıyoruz.`, tone: "error" };
  return { text: r.message || "Açılamadı.", tone: "error" };
}
