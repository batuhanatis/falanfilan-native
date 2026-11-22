import AsyncStorage from "@react-native-async-storage/async-storage";

// Düello davetinde "yalnızca ortak beğeniler" tercihi: lobi ve karne ekranı aynı değeri kullanıyor,
// uygulama kapanıp açılınca da hatırlanıyor.
const KEY = "pellix.duel.sharedOnly";
let cached = null;

export async function getDuelSharedOnly() {
  if (cached != null) return cached;
  try { cached = (await AsyncStorage.getItem(KEY)) === "1"; } catch { cached = false; }
  return cached;
}

export async function setDuelSharedOnly(value) {
  cached = !!value;
  try { await AsyncStorage.setItem(KEY, cached ? "1" : "0"); } catch {}
}
