// Web'deki recommendationReason'ın basitleştirilmiş hali — favoriler ve collaborative
// matrix native tarafta henüz yok, o yüzden şimdilik sadece tür (genre) örtüşmesine bakıyor.
export function recommendationReason(movie, likedIds, movies) {
  if (likedIds.size === 0) return null;
  let overlap = 0;
  likedIds.forEach((id) => {
    const liked = movies.find((m) => m.id === id);
    if (liked && liked.genre === movie.genre) overlap++;
  });
  if (overlap > 0) return `${movie.genre} sevdiğin içeriklere benziyor`;
  return null;
}
