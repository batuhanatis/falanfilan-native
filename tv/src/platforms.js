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
