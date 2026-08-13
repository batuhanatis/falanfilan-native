// Web'deki recommendationReason'ın basitleştirilmiş hali — favoriler ve collaborative
// matrix native tarafta henüz yok, o yüzden şimdilik sadece tür (genre) örtüşmesine bakıyor.
//
// PERF — `moviesById` bir Map (id -> movie) bekliyor, düz bir dizi değil. Eskiden her çağrıda
// `movies.find(m => m.id === id)` kullanılıyordu — bu, her beğenilen film için TÜM yüklenmiş
// filmler dizisinde doğrusal arama yapıyordu (beğeni sayısı × yüklenmiş film sayısı). Ana
// Sayfa'da aşağı kaydırdıkça hem beğeniler hem yüklenmiş film sayısı büyüdüğü için bu maliyet
// katlanarak artıyor, "kaydırdıkça daha da ağırlaşan" bir sayfa hissi yaratıyordu. Map lookup
// O(1) olduğu için toplam maliyet artık sadece beğeni sayısıyla orantılı.
export function recommendationReason(movie, likedIds, moviesById) {
  if (likedIds.size === 0) return null;
  const movieGenres = Array.isArray(movie.genres) && movie.genres.length > 0 ? movie.genres : [movie.genre];
  let overlap = 0;
  let matchedGenre = null;
  likedIds.forEach((id) => {
    const liked = moviesById.get(id);
    if (!liked) return;
    const likedGenres = Array.isArray(liked.genres) && liked.genres.length > 0 ? liked.genres : [liked.genre];
    const shared = likedGenres.find((g) => movieGenres.includes(g));
    if (shared) { overlap++; matchedGenre = shared; }
  });
  if (overlap > 0) return `${matchedGenre} sevdiğin içeriklere benziyor`;
  return null;
}
