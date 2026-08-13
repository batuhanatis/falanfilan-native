import { api } from "../api/client";

// Kritik olmayan, "en iyi çaba" bir analitik katmanı — kaybolan bir olay hiçbir şeyi bozmuyor.
// Hangi ekranda ne kadar kalındığını ve oturumun ne kadar sürdüğünü/nerede bittiğini kaydediyoruz.
let currentScreen = null;
let screenEnteredAt = null;
let sessionStartedAt = null;
let queue = [];
let authToken = null;

function resetAnalyticsState({ startNewSession = false } = {}) {
  currentScreen = null;
  screenEnteredAt = null;
  sessionStartedAt = startNewSession ? Date.now() : null;
  queue = [];
}

export function setAnalyticsToken(token) {
  // Hesap değiştiğinde önceki kullanıcının kuyrukta kalmış event'leri yeni kullanıcının
  // token'ıyla gönderilmesin. Aynı zamanda login ekranında geçirilen süreyi yeni kullanıcının
  // ilk oturumuna dahil etmemek için oturum sayacını token set edildiği anda yeniden başlatıyoruz.
  if (token !== authToken) {
    authToken = token;
    resetAnalyticsState({ startNewSession: !!token });
    return;
  }
  authToken = token;
}

export function trackScreen(screenName) {
  if (!screenName || screenName === currentScreen) return;
  const now = Date.now();
  if (currentScreen && screenEnteredAt) {
    queue.push({ type: "screen_view", screen: currentScreen, duration_ms: now - screenEnteredAt });
  }
  currentScreen = screenName;
  screenEnteredAt = now;
  if (queue.length >= 8) flush();
}

export function startSession() {
  // AppState birden fazla kez "active" üretebilir; mevcut açık oturumu gereksiz yere sıfırlama.
  if (!sessionStartedAt) sessionStartedAt = Date.now();
}

export function endSession() {
  const now = Date.now();
  if (currentScreen && screenEnteredAt) {
    queue.push({ type: "screen_view", screen: currentScreen, duration_ms: now - screenEnteredAt });
    screenEnteredAt = now; // arka plandan dönülürse aynı ekranda say
  }
  if (sessionStartedAt) {
    queue.push({ type: "session_end", screen: currentScreen, duration_ms: now - sessionStartedAt });
    sessionStartedAt = null;
  }
  flush();
}

export async function flush() {
  if (queue.length === 0 || !authToken) return;
  const tokenAtFlush = authToken;
  const events = queue.splice(0, queue.length);
  try {
    await api.trackEvents(tokenAtFlush, events);
  } catch {
    // Event'ler kritik değil; ancak bu sırada HÂLÂ aynı kullanıcı oturumundaysak bir sonraki
    // flush'ta tekrar deneyebilmek için kuyruğun başına geri koyuyoruz. Hesap değiştiyse eski
    // kullanıcının verisini yeni hesaba taşımamak için özellikle geri koymuyoruz.
    if (authToken === tokenAtFlush) queue = [...events, ...queue].slice(-100);
  }
}
