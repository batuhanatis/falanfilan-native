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

// Fragmanı TV'nin YouTube uygulamasında tam ekran açar (yerel oynatıcı, akıcı). YouTube yoksa
// tarayıcıya düşmüyoruz (TV-WB); durum yazısı dönüyor.
export function openTrailerInYouTube(videoKey) {
  try {
    const r = openUrl(`https://www.youtube.com/watch?v=${encodeURIComponent(videoKey)}`, PLATFORM_PACKAGES.YouTube || [], {});
    if (r) return { text: "Fragman YouTube'da açılıyor…", tone: "info" };
    return { text: "Bu TV'de YouTube uygulaması yok.", tone: "error" };
  } catch (e) {
    return { text: e?.message || "Fragman açılamadı.", tone: "error" };
  }
}

// Kiralık / satın alınabilir seçenekler (API'nin stores alanı). Açma akışı abonelik
// platformlarıyla aynı: içeriğin mağaza sayfası (yoksa mağazada adıyla arama) mağaza
// uygulamasında açılıyor; uygulama linki açamazsa ana ekranında, yüklü değilse bunu söylüyoruz.
const STORE_APPS = { apple: "Apple TV", google: "Google Play Movies", amazon: "Amazon Prime Video" };
const STORE_NAMES = { apple: "Apple TV", google: "Google Play", amazon: "Prime Video", microsoft: "Microsoft Store" };

export function storeOfferText(offers) {
  const rent = offers?.includes("rent");
  const buy = offers?.includes("buy");
  if (rent && buy) return "Kirala / Satın al";
  return rent ? "Kirala" : "Satın al";
}

export function storesOf(movie) {
  return (Array.isArray(movie?.stores) ? movie.stores : [])
    .filter((s) => s && s.store)
    .map((s) => ({
      ...s,
      name: STORE_NAMES[s.key] || s.store,
      offerText: storeOfferText(s.offers),
      packages: PLATFORM_PACKAGES[STORE_APPS[s.key]] || [],
    }));
}

export const canOpenStore = (store) => store.packages.length > 0;

export function openStoreAndDescribe(store) {
  try {
    const url = store.url || store.searchUrl;
    if (url && openUrl(url, store.packages, {})) return { text: `${store.name} açılıyor…`, tone: "info" };
    if (openApp(store.packages)) {
      return { text: `${store.name} açıldı; içeriği adıyla aratabilirsin.`, tone: "info" };
    }
    return { text: `${store.name} bu TV'de yüklü değil.`, tone: "error" };
  } catch (e) {
    return { text: e?.message || "Açılamadı.", tone: "error" };
  }
}
