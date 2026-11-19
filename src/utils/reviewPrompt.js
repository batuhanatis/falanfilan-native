import AsyncStorage from "@react-native-async-storage/async-storage";
import { requireOptionalNativeModule } from "expo";

// Mağaza puan penceresi (iOS'ta Apple'ın kendi penceresi, Android'de Google Play In-App Review).
// Yalnızca olumlu bir anın ardından çağrılır (MatchParty eşleşmesi, yüksek Blend uyumu,
// Bu Akşamı Planla sonucu). İlk olumlu anda değil, en az MIN_MOMENTS olumlu an biriktiğinde istenir;
// iki istek arasında en az COOLDOWN_DAYS gün geçer. Pencereyi gösterip göstermemeye son kararı
// Apple/Google verir (Apple yılda en fazla 3 kez gösterir), yani bu çağrı bir "istek".
//
// Yerel modül (expo-store-review) yalnızca onu içeren mağaza sürümlerinde (1.0.2+) var; eski
// sürümlerde OTA ile gelen bu kod sessizce hiçbir şey yapmaz. Mağaza linkine yönlendirme yedeği
// bilerek yok: kullanıcıyı habersizce uygulamadan çıkarmak istemiyoruz.
const KEY = "pellix.reviewPrompt.v1";
const MIN_MOMENTS = 2;
const COOLDOWN_DAYS = 120;

let cached;
function nativeModule() {
  if (cached !== undefined) return cached;
  try {
    cached = requireOptionalNativeModule("ExpoStoreReview");
  } catch {
    cached = null;
  }
  return cached;
}

async function readState() {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    const parsed = raw ? JSON.parse(raw) : null;
    return { moments: parsed?.moments || 0, lastAskAt: parsed?.lastAskAt || 0 };
  } catch {
    return { moments: 0, lastAskAt: 0 };
  }
}

let busy = false;

// reason: yalnızca kayıt için ("match", "blend", "plan"). delayMs: animasyon/kutlama bitsin diye bekleme.
export async function reviewMoment(reason, { delayMs = 800 } = {}) {
  const mod = nativeModule();
  if (!mod?.requestReview || busy) return;
  busy = true;
  try {
    const state = await readState();
    state.moments += 1;
    const now = Date.now();
    const cooled = now - state.lastAskAt >= COOLDOWN_DAYS * 24 * 60 * 60 * 1000;
    const ready = state.moments >= MIN_MOMENTS && cooled;
    const available = ready ? await Promise.resolve(mod.isAvailableAsync?.()).catch(() => false) : false;
    if (available) {
      await AsyncStorage.setItem(KEY, JSON.stringify({ moments: 0, lastAskAt: now, lastReason: reason })).catch(() => {});
      await new Promise((resolve) => setTimeout(resolve, delayMs));
      await mod.requestReview();
    } else {
      await AsyncStorage.setItem(KEY, JSON.stringify(state)).catch(() => {});
    }
  } catch {
    // Puan penceresi açılamadıysa kullanıcıya gösterilecek bir şey yok.
  } finally {
    busy = false;
  }
}
