from pathlib import Path

p = Path('src/screens/ProfileScreen.js')
s = p.read_text()

start = s.index('function buildTasteDNA(')
end = s.index('\n\nexport default function ProfileScreen', start)
new_fn = r'''function ratingPositiveWeight(value) {
  const rating = Number(value);
  if (!Number.isFinite(rating)) return 0;
  if (rating >= 10) return 1.6;
  if (rating >= 9) return 1.4;
  if (rating >= 8) return 1.1;
  if (rating >= 7) return 0.75;
  if (rating >= 6) return 0.25;
  return 0;
}

function buildTasteDNA(likedMovies, profile, diaryEntries = []) {
  const genreWeights = new Map();
  let filmWeight = 0;
  let showWeight = 0;
  let deepRatingCount = 0;

  const addPositiveMovie = (movie, weight) => {
    if (!movie || !(weight > 0)) return;
    if (movie.type === "Film") filmWeight += weight;
    else if (movie.type === "Dizi") showWeight += weight;
    const genres = [...new Set(splitGenres(movie.genre || movie.genres))];
    const perGenre = genres.length ? weight / genres.length : 0;
    genres.forEach((genre) => genreWeights.set(genre, (genreWeights.get(genre) || 0) + perGenre));
  };

  // Fast “Zevkime göre” remains the baseline one-tap signal.
  (likedMovies || []).forEach((movie) => addPositiveMovie(movie, 1));

  // Watched-only carries no taste meaning. Ratings of 6+ deepen the positive identity using
  // the same strength curve as the server Taste Engine; low ratings remain avoidance evidence
  // server-side and therefore are intentionally not presented as a “favorite genre” here.
  (diaryEntries || []).forEach((entry) => {
    const weight = ratingPositiveWeight(entry?.rating);
    if (weight <= 0) return;
    deepRatingCount += 1;
    addPositiveMovie(entry.movie, weight);
  });

  // Explicit onboarding genres are a light prior, not equal to a real fast-like.
  (profile?.preferredGenres || []).forEach((genre) => {
    if (!genre) return;
    genreWeights.set(genre, (genreWeights.get(genre) || 0) + 0.25);
  });

  const genreTotal = [...genreWeights.values()].reduce((sum, value) => sum + value, 0) || 1;
  const genres = [...genreWeights.entries()]
    .filter(([, weight]) => weight > 0)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([name, weight]) => ({
      name,
      percent: Math.max(10, Math.round((weight / genreTotal) * 100)),
    }));

  const typeTotal = filmWeight + showWeight;
  const filmPercent = typeTotal ? Math.round((filmWeight / typeTotal) * 100) : 50;
  const showPercent = typeTotal ? 100 - filmPercent : 50;

  return {
    genres,
    filmPercent,
    showPercent,
    signalCount: (likedMovies?.length || 0) + deepRatingCount,
    deepRatingCount,
  };
}'''
s = s[:start] + new_fn + s[end:]

old = '  const [diaryStats, setDiaryStats] = useState(null);'
new = old + '\n  const [diaryEntries, setDiaryEntries] = useState([]);'
if s.count(old) != 1: raise SystemExit('diaryEntries state anchor')
s = s.replace(old, new, 1)

old = '    diaryApi.stats(auth.token).then(setDiaryStats).catch(() => setDiaryStats(null));'
new = old + '\n    diaryApi.list(auth.token, { page: 1, limit: 50 }).then((data) => setDiaryEntries(data.results || [])).catch(() => setDiaryEntries([]));'
if s.count(old) != 1: raise SystemExit('diary list load anchor')
s = s.replace(old, new, 1)

old = '  const tasteDNA = useMemo(() => buildTasteDNA(likedMovies, profile), [likedMovies, profile]);'
new = '  const tasteDNA = useMemo(() => buildTasteDNA(likedMovies, profile, diaryEntries), [likedMovies, profile, diaryEntries]);'
if s.count(old) != 1: raise SystemExit('tasteDNA memo anchor')
s = s.replace(old, new, 1)

p.write_text(s)
print('Profile Taste DNA aligned to rating-aware positive taste evidence')
