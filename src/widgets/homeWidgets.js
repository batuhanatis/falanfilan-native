import { Platform } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { t as translateUI, getLanguage } from "../i18n/core";
import { upperTR } from "../theme/fonts";
import { isDomestic } from "../utils/origin";
import { api } from "../api/client";

// Ana ekran widget'larının verisi. Uygulama günün seçkisini (Ana Sayfa'daki seans panosu) ve
// son bakılan Blend'i burada paylaşılan depoya yazar:
//   iOS     → App Group UserDefaults (targets/widget/*.swift okur)
//   Android → AsyncStorage (src/widgets/android/widgetTaskHandler.js okur)
// Yerel modül yoksa (web, eski binary) her şey sessizce atlanır.

export const IOS_APP_GROUP = "group.com.batuhanatis.pellix";
export const ANDROID_KEYS = {
  seans: "pellix:widget:seans",
  index: "pellix:widget:seansIndex",
  blend: "pellix:widget:blend",
  labels: "pellix:widget:labels",
};
const DAY_KEY = "pellix:widget:day";
const BLEND_FRIEND_KEY = "pellix:widget:blendFriend";
const BLEND_REFRESH_MS = 12 * 60 * 60 * 1000;

let iosStorage;
let ExtensionStorageClass = null;
function iosStore() {
  if (Platform.OS !== "ios") return null;
  if (iosStorage !== undefined) return iosStorage;
  try {
    const { ExtensionStorage } = require("@bacons/apple-targets");
    ExtensionStorageClass = ExtensionStorage;
    iosStorage = new ExtensionStorage(IOS_APP_GROUP);
  } catch {
    iosStorage = null;
  }
  return iosStorage;
}

function reloadIos(kind) {
  try { ExtensionStorageClass?.reloadWidget(kind); } catch {}
}

async function updateAndroid(widgetName) {
  if (Platform.OS !== "android") return;
  try {
    const { requestWidgetUpdate } = require("react-native-android-widget");
    const { renderAndroidWidget } = require("./android/widgetTaskHandler");
    await requestWidgetUpdate({
      widgetName,
      renderWidget: (widgetInfo) => renderAndroidWidget(widgetName, widgetInfo),
      widgetNotFound: () => {},
    });
  } catch {}
}

// Widget etiketleri uygulamanın dilinde. {0}, {1} widget içinde doldurulur.
export function widgetLabels() {
  return {
    tonight: translateUI("BU AKŞAM SENİN İÇİN"),
    tonightShort: translateUI("BU AKŞAM"),
    upcoming: translateUI("SIRADAKİ SEANSLAR"),
    next: translateUI("Sıradaki"),
    restart: translateUI("Baştan"),
    discover: translateUI("Keşfet'e git"),
    emptyBoard: translateUI("5 AFİŞ BEĞEN"),
    emptyMeta: translateUI("PANO HENÜZ BOŞ"),
    emptyText: translateUI("Panon beğendiklerinle kurulur. Keşfet'te 5 afiş beğen, ilk seansın gelsin."),
    doneBoard: translateUI("YARIN YENİ PANO"),
    doneMeta: translateUI("BUGÜNÜN PANOSU TAMAM"),
    doneText: translateUI("{0} seçimin hepsine baktın. Yeni pano yarın hazır."),
    ofCount: translateUI("{0} SEÇİMDEN {1}."),
    inline: translateUI("Bu akşam: {0}"),
    inlineEmpty: translateUI("Pellix: panon hazırlanıyor"),
    seans: translateUI("SEANS"),
    blend: translateUI("BLEND"),
    blendScore: translateUI("BEĞENİ UYUMU"),
    together: translateUI("BİRLİKTE İZLEYİN"),
    togetherNote: translateUI("İkinizin beğendiklerinden; henüz izlemediğiniz."),
    blendEmpty: translateUI("Bir arkadaşınla Blend'e bak; uyumunuz burada dursun."),
    lang: getLanguage() === "en" ? "en" : "tr",
  };
}

// Afişin küçük boyu: widget'a w342 yetiyor (bellek sınırlı).
export function widgetPoster(url) {
  if (!url) return null;
  return String(url).replace(/\/t\/p\/(?:w\d+|original)\//, "/t/p/w342/");
}

function boardTitle(movie) {
  const title = String(movie.title || "");
  return isDomestic(movie) ? title.replace(/i/g, "İ").replace(/ı/g, "I").toUpperCase() : title.toUpperCase();
}

// SeansBoard'daki formatHeroRuntime ile aynı (bileşen dosyasını buraya çekmemek için kopya).
function formatHeroRuntime(runtime) {
  if (getLanguage() !== "en" || runtime == null) return runtime;
  return String(runtime)
    .replace(/(\d+)\s*Sezon/gi, (_, n) => `${n} season${Number(n) === 1 ? "" : "s"}`)
    .replace(/(\d+)\s*Bölüm/gi, (_, n) => `${n} episode${Number(n) === 1 ? "" : "s"}`)
    .replace(/\b(dakika|dk)\b/gi, "min")
    .replace(/\bsaat\b/gi, "hr");
}

function metaLine(movie) {
  const genre = String(movie.genre || "").split(/[,/·|]/)[0]?.trim();
  return [translateUI(genre), formatHeroRuntime(movie.runtime), movie.year].filter(Boolean).map((part) => upperTR(part)).join(" · ");
}

function firstName(name) {
  return String(name || "").trim().split(/\s+/)[0] || "";
}

let lastSeans = "";
let lastLabels = "";

// Ana Sayfa'nın günün seçkisi (dailyHeroSelections: [{ movie, reasons }]).
export async function publishSeans(selections, dayKey) {
  try {
    const items = (selections || []).slice(0, 10).filter((s) => s?.movie?.id).map(({ movie, reasons = [] }) => {
      const reason = reasons.find((r) => r.personalized)?.short || reasons[0]?.short || null;
      const overview = String(movie.overview || "").trim();
      return {
        id: movie.id,
        title: String(movie.title || ""),
        board: boardTitle(movie),
        meta: metaLine(movie),
        reason: reason ? translateUI(reason) : null,
        overview: overview ? (overview.length > 180 ? `${overview.slice(0, 177).trim()}…` : overview) : null,
        imdb: movie.imdb ? String(movie.imdb) : null,
        poster: widgetPoster(movie.poster),
      };
    });
    if (!items.length) return;
    const json = JSON.stringify({ dayKey: dayKey || null, items });
    const labels = JSON.stringify(widgetLabels());
    if (json === lastSeans && labels === lastLabels) return;
    lastSeans = json;
    lastLabels = labels;
    const previousDay = await AsyncStorage.getItem(DAY_KEY).catch(() => null);
    const newDay = previousDay !== (dayKey || "");
    await AsyncStorage.setItem(DAY_KEY, dayKey || "").catch(() => {});

    const ios = iosStore();
    if (ios) {
      ios.set("seans", json);
      ios.set("labels", labels);
      if (newDay) ios.set("seansIndex", 0);
      reloadIos("PellixSeans");
      reloadIos("PellixBlend");
    }
    if (Platform.OS === "android") {
      const pairs = [[ANDROID_KEYS.seans, json], [ANDROID_KEYS.labels, labels]];
      if (newDay) pairs.push([ANDROID_KEYS.index, "0"]);
      await AsyncStorage.multiSet(pairs);
      await updateAndroid("Seans");
    }
  } catch {}
}

// Blend ekranından: arkadaş, uyum ve birlikte izlenebilecekler (ilk 3 afiş).
export async function publishBlend({ friendId, friendName, myName, data }) {
  try {
    if (!friendId || data?.matchPercent == null) return;
    const films = [...(data.recommendations || []), ...(data.common || [])]
      .filter((m) => m?.id)
      .slice(0, 3)
      .map((m) => ({ id: m.id, title: String(m.title || ""), poster: widgetPoster(m.poster) }));
    const payload = {
      friendId: Number(friendId),
      me: firstName(myName) || translateUI("Sen"),
      friend: firstName(friendName || data.friend?.name),
      percent: Math.round(Number(data.matchPercent) || 0),
      films,
    };
    const json = JSON.stringify(payload);
    const labels = JSON.stringify(widgetLabels());
    await AsyncStorage.setItem(BLEND_FRIEND_KEY, JSON.stringify({ friendId: payload.friendId, friendName: payload.friend, at: Date.now() })).catch(() => {});

    const ios = iosStore();
    if (ios) {
      ios.set("blend", json);
      ios.set("labels", labels);
      reloadIos("PellixBlend");
    }
    if (Platform.OS === "android") {
      await AsyncStorage.multiSet([[ANDROID_KEYS.blend, json], [ANDROID_KEYS.labels, labels]]);
      await updateAndroid("Blend");
    }
  } catch {}
}

// Uygulama açıldığında son Blend'i günde en çok iki kez tazeler (uyum değişmiş olabilir).
export async function refreshBlendWidget(token, myName) {
  try {
    if (!token) return;
    const saved = JSON.parse((await AsyncStorage.getItem(BLEND_FRIEND_KEY)) || "null");
    if (!saved?.friendId || Date.now() - (saved.at || 0) < BLEND_REFRESH_MS) return;
    const data = await api.blend(token, saved.friendId);
    await publishBlend({ friendId: saved.friendId, friendName: saved.friendName, myName, data });
  } catch {}
}

// Oturum kapanınca widget'lar boş durumuna döner.
export async function clearWidgets() {
  lastSeans = "";
  lastLabels = "";
  try {
    await AsyncStorage.multiRemove([DAY_KEY, BLEND_FRIEND_KEY, ANDROID_KEYS.seans, ANDROID_KEYS.index, ANDROID_KEYS.blend]);
    const ios = iosStore();
    if (ios) {
      ios.remove("seans");
      ios.remove("blend");
      ios.set("seansIndex", 0);
      reloadIos("PellixSeans");
      reloadIos("PellixBlend");
    }
    await updateAndroid("Seans");
    await updateAndroid("Blend");
  } catch {}
}
