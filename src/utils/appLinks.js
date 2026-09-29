// Pellix'in mağaza adresleri yayın öncesinde de sabit tutuluyor. Uygulama mağazada henüz
// yayınlanmadıysa bu URL'ler listing canlı olana kadar sonuç vermeyebilir; buna rağmen binary
// içine doğru production adresleri şimdiden gömülmüş olur.
export const IOS_STORE_LINK = "https://apps.apple.com/app/id6797965648";
export const ANDROID_STORE_LINK = "https://play.google.com/store/apps/details?id=com.batuhanatis.pellix";

// Paylaşım mesajlarındaki indirme linki. Eskiden HERKESE App Store linki gidiyordu — Android'deki
// arkadaş iPhone mağazasına düşüyordu. open.pellix.app/indir linki açan cihazı tanıyıp doğru
// mağazaya (masaüstünde web sitesine) yönlendiriyor; `campaign`, Android kurulumlarının hangi
// paylaşımdan geldiğini Play Console'da ayırt etmek için.
export function getStoreLink(campaign = "invite") {
  return `https://open.pellix.app/indir?c=${encodeURIComponent(campaign)}`;
}
