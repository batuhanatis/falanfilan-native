// Web'deki recommendationReason'ın basitleştirilmiş hali — favoriler ve collaborative
// matrix native tarafta henüz yok, o yüzden şimdilik sadece tür (genre) örtüşmesine bakıyor.
export function recommendationReason(movie, likedIds, movies) {
  if (likedIds.size === 0) return null;
  const movieGenres = Array.isArray(movie.genres) && movie.genres.length > 0 ? movie.genres : [movie.genre];
  let overlap = 0;
  let matchedGenre = null;
  likedIds.forEach((id) => {
    const liked = movies.find((m) => m.id === id);
    if (!liked) return;
    const likedGenres = Array.isArray(liked.genres) && liked.genres.length > 0 ? liked.genres : [liked.genre];
    const shared = likedGenres.find((g) => movieGenres.includes(g));
    if (shared) { overlap++; matchedGenre = shared; }
  });
  if (overlap > 0) return `${matchedGenre} sevdiğin içeriklere benziyor`;
  return null;
}
