import AsyncStorage from "@react-native-async-storage/async-storage";
import { Platform, Dimensions, PixelRatio, Linking } from "react-native";
import { API_BASE } from "../api/client";

// Ertelenmiş link: story/davet/profil linkinden mağazaya gidip uygulamayı kuran kişi, ilk
// açılışta linkin gösterdiği yere gitsin. Link sayfası (open.pellix.app) açılınca sunucuya bir
// işaret düşüyor; uygulama yeni kurulduğunda bir kez aynı ekran bilgileriyle soruyor (ayrıntı:
// API'deki deferred-links.js). Yalnızca girişsiz ilk açılışta soruluyor: mevcut kullanıcılar ya
// da uygulamayı zaten bir linkle açan kişi için hiçbir şey değişmiyor.
const CHECKED_KEY = "pellix_deferred_checked_v1";
const PENDING_KEY = "pellix_pending_link_v1";
// İşaret open.pellix.app'teki sayfadan düşüyor; soruyu da aynı adrese soruyoruz ki telefon iki
// istekte de aynı yoldan (aynı IP sürümüyle) gelsin. Hazırlık/yerel API'de o API'ye soruluyor.
const CLAIM_BASE = /^https:\/\/api\.pellix\.app$/.test(API_BASE) ? "https://open.pellix.app" : API_BASE;
const TARGET_RE = /^(film\/\d{1,9}|party\/[A-Za-z0-9_-]{4,64}|u\/[A-Za-z0-9_.-]{1,40}|blend\/[A-Za-z0-9_.-]{1,40}\/[A-Za-z0-9_.-]{1,40})$/;

export async function markDeferredChecked() {
  try { await AsyncStorage.setItem(CHECKED_KEY, String(Date.now())); } catch { /* kritik değil */ }
}

export async function claimDeferredLinkOnce() {
  try {
    if (Platform.OS !== "ios" && Platform.OS !== "android") return null;
    if (await AsyncStorage.getItem(CHECKED_KEY)) return null;
    await markDeferredChecked();
    // Uygulama zaten bir linkle açıldıysa o link geçerli; tahmine gerek yok.
    if (await Linking.getInitialURL().catch(() => null)) return null;

    const { width, height } = Dimensions.get("screen");
    let tz = "";
    try { tz = Intl.DateTimeFormat().resolvedOptions().timeZone || ""; } catch { /* yoksa boş */ }
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 6000);
    const res = await fetch(`${CLAIM_BASE}/api/deferred-link/claim`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ platform: Platform.OS, w: width, h: height, dpr: PixelRatio.get(), tz }),
      signal: ctrl.signal,
    }).finally(() => clearTimeout(timer));
    const data = await res.json().catch(() => null);
    const target = data?.target;
    if (typeof target === "string" && TARGET_RE.test(target)) {
      await AsyncStorage.setItem(PENDING_KEY, target);
      return target;
    }
  } catch { /* bağlantı yoksa normal açılış */ }
  return null;
}

// Giriş ve tanışma bittikten sonra bir kez okunup siliniyor.
export async function takePendingLink() {
  try {
    const target = await AsyncStorage.getItem(PENDING_KEY);
    if (target) await AsyncStorage.removeItem(PENDING_KEY);
    return target && TARGET_RE.test(target) ? target : null;
  } catch {
    return null;
  }
}
