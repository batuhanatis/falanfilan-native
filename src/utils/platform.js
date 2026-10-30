// Veritabanındaki platform verisi karışık: bazı eski önbelleklenmiş kayıtlarda platform
// sadece bir string ("Netflix"), yeni kayıtlarda ise {name, logo} nesnesi olarak duruyor.
// Web uygulamasındaki platformName()/platformLogo() ile birebir aynı mantık — ikisini de
// güvenli şekilde okur, hangi formatta olursa olsun kırılmaz.
export function platformName(p) {
  return typeof p === "string" ? p : p?.name;
}

export function platformLogo(p) {
  return typeof p === "object" && p !== null ? p?.logo : null;
}

// Aynı servisin zaman içinde değişen adları. Apple 2025'te "Apple TV+" servisini "Apple TV"
// olarak yeniden adlandırdı, TMDB'nin sağlayıcı adı da değişti — yani veritabanında ESKİ
// kayıtlar "Apple TV Plus"/"Apple TV+", yeniler "Apple TV" taşıyor. Filtreler adları birebir
// karşılaştırdığı için, hangi adı seçersen seç kataloğun diğer yarısı eleniyordu.
// Grubun ilk elemanı kanonik anahtar; yeni bir ad çıkarsa gruba eklemek yeterli.
const PLATFORM_ALIAS_GROUPS = [["apple tv", "apple tv+", "apple tv plus"]];

// Bir platform adını (ya da {name,...} nesnesini) karşılaştırılabilir tek bir anahtara indirger.
export function platformKey(p) {
  const name = String(platformName(p) || "").trim().toLowerCase();
  const group = PLATFORM_ALIAS_GROUPS.find((g) => g.includes(name));
  return group ? group[0] : name;
}
