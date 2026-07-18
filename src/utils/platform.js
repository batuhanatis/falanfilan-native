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
