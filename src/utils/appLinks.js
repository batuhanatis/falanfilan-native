// Pellix'in mağaza adresleri yayın öncesinde de sabit tutuluyor. Uygulama mağazada henüz
// yayınlanmadıysa bu URL'ler listing canlı olana kadar sonuç vermeyebilir; buna rağmen binary
// içine doğru production adresleri şimdiden gömülmüş olur.
export const IOS_STORE_LINK = "https://apps.apple.com/app/id6797965648";
export const ANDROID_STORE_LINK = "https://play.google.com/store/apps/details?id=com.batuhanatis.pellix";

// Platformdan bağımsız paylaşım mesajlarında şimdilik iOS adresini önceliklendiriyoruz.
// İki mağaza da canlı olduğunda cihazı doğru mağazaya yönlendiren tek bir akıllı/universal link
// kullanmak daha doğru olur.
export function getStoreLink() {
  return IOS_STORE_LINK || ANDROID_STORE_LINK || "";
}
