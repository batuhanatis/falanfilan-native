const PREFIX = "__ACTIVITY_SHARE__";

function activityText(item) {
  const userName = item?.user?.name || "Bir kullanıcı";
  if (item?.kind === "post") {
    if (item?.post?.type === "recommend") return `${userName} bir içerik önerdi`;
    if (item?.post?.type === "poll") return `${userName} bir anket paylaştı`;
    if (item?.post?.type === "card") return `${userName} bir kart paylaştı`;
    return `${userName} bir paylaşım yaptı`;
  }
  if (item?.activityType === "like") {
    const count = item?.activityCount || item?.movies?.length || 1;
    return count > 1 ? `${userName} ${count} içerik beğendi` : `${userName} bir içeriği beğendi`;
  }
  if (item?.activityType === "favorite_set") {
    return item?.payload?.liked
      ? `${userName} bir içeriği beğendi ve favorisi yaptı`
      : `${userName} favorisini güncelledi`;
  }
  if (item?.activityType === "list_created") return `${userName} yeni bir liste oluşturdu`;
  return `${userName} zevk profilini güncelledi`;
}

export function encodeActivityShare(item, note) {
  const movie = item?.post?.movie || item?.movies?.[0] || null;
  const payload = {
    kind: item?.kind || "activity",
    activityId: item?.activityId || null,
    postId: item?.post?.id || null,
    activityType: item?.activityType || null,
    createdAt: item?.created_at || null,
    text: activityText(item),
    body: item?.post?.body?.trim() || null,
    note: note?.trim() || null,
    user: item?.user ? {
      id: item.user.id,
      name: item.user.name,
      username: item.user.username || null,
      avatar_url: item.user.avatar_url || null,
    } : null,
    movie: movie ? {
      id: movie.id,
      title: movie.title,
      poster: movie.poster || null,
      year: movie.year || null,
      type: movie.type || null,
      imdb: movie.imdb || null,
      genre: movie.genre || null,
    } : null,
  };
  return `${PREFIX}${JSON.stringify(payload)}`;
}

export function decodeActivityShare(body) {
  if (!body || typeof body !== "string" || !body.startsWith(PREFIX)) return null;
  try {
    return JSON.parse(body.slice(PREFIX.length));
  } catch {
    return null;
  }
}
