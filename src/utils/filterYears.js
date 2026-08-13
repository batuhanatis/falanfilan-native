// ÖNEMLİ: Bu liste eskiden GroupPartyScreen.js VE TasteRecommendModal.js içinde AYRI AYRI,
// birbirinden habersiz iki kopya olarak tanımlıydı. FilterFields (paylaşılan filtre bileşeni)
// üçüncü bir kullanım yeri (HomeScreen) daha eklediği için tek kaynağa çıkarıldı.
export const YEAR_OPTIONS = [
  ["1990 öncesi", "before1990"],
  ["1990'lar", "1990s"],
  ["2000'ler", "2000s"],
  ["2010'lar", "2010s"],
  ["2020 ve sonrası", "2020s"],
];

// HomeScreen'in filtrelemesi (GroupPartyScreen/TasteRecommendModal'ın aksine) sunucuya hiç
// gitmiyor — zaten ekrandaki listeyi CLIENT-side daraltıyor. Bu yüzden "yıl etiketi -> içerik
// yılı eşleşiyor mu" mantığının da burada, native tarafta bir karşılığı gerekiyor.
export function yearMatchesLabel(year, label) {
  const y = Number(year);
  if (!y) return false;
  switch (label) {
    case "1990 öncesi": return y < 1990;
    case "1990'lar": return y >= 1990 && y <= 1999;
    case "2000'ler": return y >= 2000 && y <= 2009;
    case "2010'lar": return y >= 2010 && y <= 2019;
    case "2020 ve sonrası": return y >= 2020;
    default: return false;
  }
}
