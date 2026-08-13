// ChatConversationScreen (gün ayırıcıları) ve ChatMessageRow (balon içi saat) ikisi de aynı
// formatlamayı kullanıyor — tek yerde tutuluyor ki ikisi asla birbirinden sapmasın.
export function dayLabel(iso) {
  const d = new Date(iso);
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);
  const sameDay = (a, b) => a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
  if (sameDay(d, today)) return "Bugün";
  if (sameDay(d, yesterday)) return "Dün";
  return d.toLocaleDateString("tr-TR", { day: "numeric", month: "long", year: d.getFullYear() !== today.getFullYear() ? "numeric" : undefined });
}

export function timeLabel(iso) {
  return new Date(iso).toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" });
}
