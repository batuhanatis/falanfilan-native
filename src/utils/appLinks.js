// ⚠️ HATIRLATMA: pellix, App Store ve Google Play'de yayına çıktığında bu linkleri
// gerçek mağaza adresleriyle doldur. O ana kadar boş bırakıyoruz — davet/paylaşım
// mesajlarında "indir" çağrısı yapılıyor ama gerçek bir link verilmiyor, bu yüzden
// mağazalar hazır olur olmaz burayı güncellemek ÖNCELİKLİ bir iş.
export const IOS_STORE_LINK = ""; // ör: "https://apps.apple.com/app/idXXXXXXXXX"
export const ANDROID_STORE_LINK = ""; // ör: "https://play.google.com/store/apps/details?id=com.batuhanatis.pellix"

// Platformdan bağımsız, paylaşım mesajlarında kullanılacak tek link — ikisi de hazır
// olduğunda burada bir "akıllı link" (Branch/Firebase Dynamic Links vb.) servisine
// geçmek daha doğru olur (kullanıcının cihazına göre doğru mağazaya yönlendirir).
// Şimdilik ikisinden biri hazır olduğunda onu, ikisi de hazır olduğunda iOS'u öncelikli
// veriyoruz.
export function getStoreLink() {
  return IOS_STORE_LINK || ANDROID_STORE_LINK || "";
}
