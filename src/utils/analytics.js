import { api } from "../api/client";

// Kritik olmayan, "en iyi çaba" bir analitik katmanı — kaybolan bir olay hiçbir şeyi bozmuyor.
// Hangi ekranda ne kadar kalındığını ve oturumun ne kadar sürdüğünü/nerede bittiğini kaydediyoruz.
let currentScreen = null;
let screenEnteredAt = null;
let sessionStartedAt = null;
let queue = [];
let authToken = null;

export function setAnalyticsToken(token) {
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
  sessionStartedAt = Date.now();
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
  const events = queue.splice(0, queue.length);
  try {
    await api.trackEvents(authToken, events);
  } catch {
    // olaylar kaybolur — analitik için kabul edilebilir, kritik veri değil
  }
}
