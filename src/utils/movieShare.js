// Sohbette bir film/dizi önerisini "zengin" bir kart olarak gösterebilmek için,
// mesaj metninin içine tanınabilir bir işaretle birlikte film verisini JSON olarak
// gömüyoruz. Backend'de ayrı bir "mesaj tipi" alanı olmadığı için (sadece düz metin
// body kolonu var), bu en basit ve backend değişikliği gerektirmeyen çözüm.
const PREFIX = "__MOVIE_SHARE__";

export function encodeMovieShare(movie, note) {
  const payload = {
    id: movie.id,
    title: movie.title,
    poster: movie.poster || null,
    year: movie.year,
    type: movie.type,
    imdb: movie.imdb,
    genre: movie.genre,
    overview: movie.overview,
    runtime: movie.runtime,
    votes: movie.votes,
    platforms: movie.platforms,
    note: note?.trim() || null,
  };
  return `${PREFIX}${JSON.stringify(payload)}`;
}

export function decodeMovieShare(body) {
  if (!body || typeof body !== "string" || !body.startsWith(PREFIX)) return null;
  try {
    return JSON.parse(body.slice(PREFIX.length));
  } catch {
    return null;
  }
}
