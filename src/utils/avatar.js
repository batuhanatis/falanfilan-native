// Web'deki AVATAR_OR() ile birebir aynı: gerçek yüklenmiş fotoğraf varsa onu, yoksa
// kişiye özel (id'ye göre sabit) rastgele bir görsel döndürür. Önceden native tarafta
// bu fallback yoktu — fotoğrafı olmayan kullanıcılar (ki çoğu gerçek kullanıcı/bot böyle)
// boş gri daire olarak görünüyordu, "diğer kullanıcıların fotoğrafı gelmiyor" izlenimi veriyordu.
export function avatarSeed(seed) {
  return `https://picsum.photos/seed/ffav${seed}/400/400`;
}

export function avatarOr(url, seed) {
  return url || avatarSeed(seed);
}
