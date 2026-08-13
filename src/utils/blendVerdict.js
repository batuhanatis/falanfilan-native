// BL2 — eskiden bu SADECE BlendShareCard.js'in içinde tanımlıydı, yani bu eğlenceli/kişilikli
// yorum sadece dışa aktarılan paylaşım kartında görünüyordu — canlı Blend ekranı hiç kullanmıyordu.
// Artık paylaşılan tek bir kaynak, ikisi de aynı metni gösteriyor.
//
// ÖNEMLİ DÜZELTME: computeMatchPercent (bkz. server.js) az beğenisi olan kullanıcılarda skoru
// güven aralığıyla %50'ye doğru çekiyor — bu yüzden gerçek arkadaş çiftlerinin BÜYÜK ÇOĞUNLUĞU
// 55-90 aralığında kümeleniyor. Eskiden bu geniş aralık sadece İKİ kategoriye (75-89 ve 55-74)
// bölünmüştü, yani "hemen hemen herkes aynı şeyi görüyor" şikayeti tam olarak buradan
// kaynaklanıyordu. Artık en kalabalık bölge çok daha ince dilimlere ayrıldı (13 kademe), uçlar
// (gerçekten nadir olan çok yüksek/çok düşük skorlar) daha geniş bırakıldı.
export function verdictFor(pct) {
  if (pct >= 95) return "Tek yumurta ikizi 👯‍♀️";
  if (pct >= 90) return "İkiz ruhlar 👯";
  if (pct >= 85) return "Aynı frekanstasınız 📡";
  if (pct >= 80) return "Gerçek bir eşleşme 🔥";
  if (pct >= 75) return "Çok iyi anlaşıyorsunuz ✨";
  if (pct >= 70) return "İyi gidiyorsunuz 👌";
  if (pct >= 65) return "Ortak bir zemininiz var 🎬";
  if (pct >= 60) return "Fena değilsiniz 🙂";
  if (pct >= 55) return "Az da olsa ortak noktanız var 🤏";
  if (pct >= 45) return "Zevkleriniz farklı ama olur böyle 🤷";
  if (pct >= 35) return "Zıtlar birbirini çeker 😏";
  if (pct >= 25) return "Tam bir tezatsınız 🎭";
  return "Zevkleriniz maceraperest 🎢";
}
