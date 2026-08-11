// Sohbette mini anket ve izleme planı mesajlarını "zengin" kartlar olarak gösterebilmek için,
// movieShare.js'teki AYNI yöntemi kullanıyoruz: mesaj metninin içine tanınabilir bir işaretle
// birlikte veriyi JSON olarak gömüyoruz. Oy/kabul durumu değiştiğinde backend bu JSON'u güncelleyip
// mesajı tekrar kaydediyor (bkz. server.js: /api/messages/:id/vote, /api/messages/:id/accept-plan).

const POLL_PREFIX = "__POLL__";
const PLAN_PREFIX = "__PLAN__";

export function encodePoll({ question, options }) {
  // options: [{ id, title, poster }] — film/dizi seçenekleri
  const payload = { question: question || "Hangisini izleyelim?", options, votes: {} };
  return `${POLL_PREFIX}${JSON.stringify(payload)}`;
}

export function decodePoll(body) {
  if (!body || typeof body !== "string" || !body.startsWith(POLL_PREFIX)) return null;
  try {
    return JSON.parse(body.slice(POLL_PREFIX.length));
  } catch {
    return null;
  }
}

export function encodePlan({ scheduledAt, note }) {
  // scheduledAt: ISO tarih string'i — artık serbest metin DEĞİL, gerçek bir zaman damgası.
  const payload = { scheduledAt, note: note || null, status: "pending" }; // status: pending | accepted
  return `${PLAN_PREFIX}${JSON.stringify(payload)}`;
}

export function decodePlan(body) {
  if (!body || typeof body !== "string" || !body.startsWith(PLAN_PREFIX)) return null;
  try {
    return JSON.parse(body.slice(PLAN_PREFIX.length));
  } catch {
    return null;
  }
}

// Bir planın zamanını "Bugün 21:00" / "Yarın 21:00" / "Cuma 21:00" / "24 Tem 21:00" gibi
// okunması kolay, Türkçe bir metne çeviriyor.
export function formatPlanTime(scheduledAt) {
  if (!scheduledAt) return "";
  const date = new Date(scheduledAt);
  if (isNaN(date.getTime())) return "";
  const now = new Date();
  const startOfDay = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const dayDiff = Math.round((startOfDay(date) - startOfDay(now)) / 86400000);
  const timeStr = date.toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" });
  if (dayDiff === 0) return `Bugün ${timeStr}`;
  if (dayDiff === 1) return `Yarın ${timeStr}`;
  if (dayDiff > 1 && dayDiff < 7) {
    const dayName = date.toLocaleDateString("tr-TR", { weekday: "long" });
    return `${dayName} ${timeStr}`;
  }
  return `${date.toLocaleDateString("tr-TR", { day: "numeric", month: "short" })} ${timeStr}`;
}
