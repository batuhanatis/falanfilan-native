import AsyncStorage from "@react-native-async-storage/async-storage";
import { Platform } from "react-native";
import * as Updates from "expo-updates";
import { api } from "../api/client";

// Çökme kaydı. Eskiden global yakalayıcı raporu gönderip HEMEN varsayılan yakalayıcıyı
// çağırıyordu; ölümcül hatada uygulama o anda kapandığı için istek hiç çıkamıyordu (4 haftada
// sunucuya tek rapor gelmemişti). Artık: hata önce diske yazılıyor, isteğe en fazla 1,5 sn
// tanınıyor, sonra uygulama kapanıyor. İstek yine çıkamadıysa bir sonraki açılışta gönderiliyor.
// Yakalanmamış Promise redleri de (yayın sürümünde başka hiçbir yerde görünmüyorlardı) hafif
// hata olarak bildiriliyor. Aynı hata bir oturumda bir kez, oturum başına en fazla 8 rapor.
const PENDING_KEY = "pellix_pending_crash_v1";
const MAX_PER_SESSION = 8;
const FATAL_WAIT_MS = 1500;
let sentCount = 0;
const seen = new Set();

function where(kind) {
  const update = Updates.updateId ? Updates.updateId.slice(0, 8) : "gömülü";
  return `${kind} · ${Platform.OS} · ${update}`;
}

function payloadFor(error, kind) {
  return {
    message: String(error?.message || error || "Bilinmeyen hata").slice(0, 500),
    stack: String(error?.stack || "").slice(0, 8000),
    context: where(kind),
  };
}

function send(payload) {
  const key = `${payload.context}|${payload.message}`;
  if (seen.has(key) || sentCount >= MAX_PER_SESSION) return Promise.resolve(null);
  seen.add(key);
  sentCount += 1;
  return Promise.resolve(api.reportError(payload)).catch(() => null);
}

export function reportHandledError(error, kind = "render-crash", extraStack = "") {
  const payload = payloadFor(error, kind);
  if (extraStack) payload.stack = `${payload.stack}\n${extraStack}`.slice(0, 8000);
  return send(payload);
}

async function flushPendingCrash() {
  try {
    const raw = await AsyncStorage.getItem(PENDING_KEY);
    if (!raw) return;
    const saved = JSON.parse(raw);
    const result = await send({ ...saved, context: `${saved.context} · önceki açılış` });
    if (result?.ok) await AsyncStorage.removeItem(PENDING_KEY);
  } catch {}
}

export function installCrashReporter() {
  if (typeof ErrorUtils === "undefined" || global.__pellixCrashReporter) return;
  global.__pellixCrashReporter = true;

  const defaultHandler = ErrorUtils.getGlobalHandler();
  ErrorUtils.setGlobalHandler((error, isFatal) => {
    const payload = payloadFor(error, isFatal ? "fatal" : "non-fatal");
    if (!isFatal) {
      send(payload);
      defaultHandler(error, isFatal);
      return;
    }
    let finished = false;
    const finish = () => {
      if (finished) return;
      finished = true;
      defaultHandler(error, isFatal);
    };
    AsyncStorage.setItem(PENDING_KEY, JSON.stringify(payload)).catch(() => {});
    send(payload).then((result) => {
      if (result?.ok) AsyncStorage.removeItem(PENDING_KEY).catch(() => {});
      finish();
    }, finish);
    setTimeout(finish, FATAL_WAIT_MS);
  });

  // Geliştirme modunda React Native kendi izleyicisini (LogBox) kullanıyor; onu ezmiyoruz.
  const hermes = global.HermesInternal;
  if (!__DEV__ && typeof hermes?.enablePromiseRejectionTracker === "function") {
    hermes.enablePromiseRejectionTracker({
      allRejections: true,
      onUnhandled: (_id, rejection) => { send(payloadFor(rejection, "promise")); },
      onHandled: () => {},
    });
  }

  flushPendingCrash();
}
