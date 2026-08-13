// ÖNEMLİ (geri alındı): Bu daha önce fotoğrafı olmayan kullanıcılara id'ye göre sabit,
// rastgele bir stok fotoğraf (picsum.photos) atıyordu — amaç "boş gri daire" izlenimini
// önlemekti. Ama pratikte TERS etki yaptı: herkesin zaten "bir fotoğrafı" varmış gibi
// göründüğü için gerçek kullanıcılar kendi fotoğraflarını hiç yüklemedi. Artık gerçek bir
// fotoğraf yoksa null dönüyoruz — RetryImage bunu görünce nötr, boş bir "fotoğraf yok"
// göstergesi çiziyor (bkz. components/RetryImage.js), sahte bir fotoğraf DEĞİL.
export function avatarOr(url) {
  return url || null;
}
