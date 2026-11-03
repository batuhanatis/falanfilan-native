import { Linking } from "react-native";
import { t as translateUI } from "../i18n/core";
import { platformName } from "./platform";

// "Netflix'te izle" düğmeleri: API'nin watchLinks alanındaki link içeriğin platformdaki sayfası
// (Wikidata ya da admin panelinden). Telefon https linkini yüklü platform uygulamasında açıyor;
// uygulama yoksa tarayıcıda. Link yoksa platformun ana sayfası açılıyor (yine uygulamaya düşer).

const PLATFORMS = {
  "Netflix": { name: "Netflix", watch: "Netflix'te izle", open: "Netflix'i aç", home: "https://www.netflix.com/" },
  "Disney Plus": { name: "Disney+", watch: "Disney+'ta izle", open: "Disney+'ı aç", home: "https://www.disneyplus.com/" },
  "HBO Max": { name: "HBO Max", watch: "HBO Max'te izle", open: "HBO Max'i aç", home: "https://play.hbomax.com/" },
  "Amazon Prime Video": { name: "Prime Video", watch: "Prime Video'da izle", open: "Prime Video'yu aç", home: "https://www.primevideo.com/" },
  "TV+": { name: "TV+", watch: "TV+'ta izle", open: "TV+'ı aç", home: "https://tvplus.com.tr/" },
  "TOD TV": { name: "TOD", watch: "TOD'da izle", open: "TOD'u aç", home: "https://www.todtv.com.tr/" },
  "MUBI": { name: "MUBI", watch: "MUBI'de izle", open: "MUBI'yi aç", home: "https://mubi.com/" },
  "Crunchyroll": { name: "Crunchyroll", watch: "Crunchyroll'da izle", open: "Crunchyroll'u aç", home: "https://www.crunchyroll.com/" },
  "tabii": { name: "tabii", watch: "tabii'de izle", open: "tabii'yi aç", home: "https://www.tabii.com/" },
};

// İçeriğin platformları, her biri için açılacak adres ve düğme metniyle. Ana sayfası
// bilinmeyen ve linki olmayan platformlar düğme değil, yalnızca etiket olarak gösterilir.
export function watchOptions(platforms, watchLinks) {
  const links = Array.isArray(watchLinks) ? watchLinks : [];
  return (Array.isArray(platforms) ? platforms : []).map((p) => {
    const key = platformName(p);
    const meta = PLATFORMS[key];
    const link = links.find((l) => l.platform === key);
    const url = link?.url || meta?.home || null;
    return {
      key,
      platform: p,
      url,
      deep: !!link?.url,
      label: meta ? translateUI(link?.url ? meta.watch : meta.open) : key,
    };
  });
}

export function openWatchOption(option) {
  if (!option?.url) return Promise.resolve(false);
  return Linking.openURL(option.url).then(() => true).catch(() => false);
}
