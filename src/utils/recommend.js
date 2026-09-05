import { platformName } from "./platform";

function splitGenres(value) {
  if (Array.isArray(value)) return value.flatMap(splitGenres);
  if (!value || typeof value !== "string") return [];
  return value
    .split(/[,/·|]/)
    .map((x) => x.trim())
    .filter(Boolean);
}

function movieGenres(movie) {
  return [...new Set(splitGenres(movie?.genres?.length ? movie.genres : movie?.genre))];
}

function runtimeMinutes(runtime) {
  if (runtime == null) return null;
  if (typeof runtime === "number" && Number.isFinite(runtime)) return runtime;
  const raw = String(runtime).toLowerCase().trim();
  const numeric = Number(raw);
  if (Number.isFinite(numeric)) return numeric;

  const hours = Number((raw.match(/(\d+)\s*(?:saat|sa|h)/) || [])[1] || 0);
  const mins = Number((raw.match(/(\d+)\s*(?:dk|dak|dakika|min)/) || [])[1] || 0);
  if (hours || mins) return hours * 60 + mins;

  const colon = raw.match(/^(\d+):(\d+)$/);
  if (colon) return Number(colon[1]) * 60 + Number(colon[2]);
  return null;
}

function median(values) {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : Math.round((sorted[mid - 1] + sorted[mid]) / 2);
}

function decadeOf(year) {
  const y = Number(year);
  if (!Number.isFinite(y) || y < 1900 || y > 2100) return null;
  return Math.floor(y / 10) * 10;
}

function platformNames(movie) {
  return [...new Set((movie?.platforms || []).map(platformName).filter(Boolean))];
}

function addReason(list, reason) {
  if (!reason?.title || !reason?.detail) return;
  if (list.some((item) => item.title === reason.title && item.detail === reason.detail)) return;
  list.push(reason);
}

/**
 * Kullanıcıya gösterilebilecek gerçek açıklama sinyallerini üretir.
 *
 * Burada "benzer kullanıcılar bunu sevdi" gibi elimizde olmayan hiçbir veri uydurulmuyor.
 * Sadece gerçek beğeni geçmişi, onboarding tercihleri, kullanıcının o an açtığı filtreler
 * ve içeriğin kendi ölçülebilir özellikleri kullanılıyor.
 */
export function recommendationReasons(movie, likedMovies = [], context = {}) {
  if (!movie) return [];

  const reasons = [];
  const likes = (likedMovies || []).filter((m) => m && Number(m.id) !== Number(movie.id));
  const targetGenres = movieGenres(movie);
  const targetType = movie.type || null;
  const targetRuntime = runtimeMinutes(movie.runtime);
  const targetDecade = decadeOf(movie.year);
  const targetPlatforms = platformNames(movie);

  const preferredGenres = splitGenres(context.preferredGenres || []);
  const preferredOverlap = targetGenres.filter((g) => preferredGenres.includes(g));
  if (preferredOverlap.length) {
    addReason(reasons, {
      score: 98,
      source: "PROFİL TERCİHİN",
      personalized: true,
      title: "Seçtiğin türlerle doğrudan eşleşiyor",
      detail: `Profilinde özellikle seçtiğin ${preferredOverlap.slice(0, 2).join(" ve ")} türü bu içerikte var.`,
      short: `${preferredOverlap[0]} tercihinle eşleşiyor`,
    });
  }

  if (context.aiLabel && !/^ai önerilerin$/i.test(String(context.aiLabel).trim())) {
    addReason(reasons, {
      score: 100,
      source: "ŞU ANKİ İSTEĞİN",
      personalized: true,
      title: "Az önce tarif ettiğin şeye göre seçildi",
      detail: `“${context.aiLabel}” isteğin için çıkan sonuçlar arasında bu içerik üst sıralarda.`,
      short: "Az önceki isteğine göre öne çıktı",
    });
  }

  if (context.genreFilter && targetGenres.includes(context.genreFilter)) {
    addReason(reasons, {
      score: 96,
      source: "ŞU ANKİ FİLTREN",
      personalized: true,
      title: "Tam seçtiğin türde",
      detail: `Şu an akışı ${context.genreFilter} türüne daralttın; bu içerik o tercihle doğrudan eşleşiyor.`,
      short: `${context.genreFilter} filtrene uyuyor`,
    });
  }

  if (context.shortOnly && targetRuntime != null && targetRuntime <= 105) {
    addReason(reasons, {
      score: 95,
      source: "ŞU ANKİ FİLTREN",
      personalized: true,
      title: "Kısa bir şey istediğin için öne çıktı",
      detail: `${targetRuntime} dakikalık süresi, açtığın “Kısa bir şey” tercihine uyuyor.`,
      short: `${targetRuntime} dk · kısa içerik tercihine uyuyor`,
    });
  }

  if (context.typeFilter && context.typeFilter !== "Hepsi" && targetType === context.typeFilter) {
    addReason(reasons, {
      score: 94,
      source: "ŞU ANKİ FİLTREN",
      personalized: true,
      title: `Şu an ${targetType.toLowerCase()} arıyorsun`,
      detail: `Akışı ${targetType} olarak filtrelediğin için bu seçim o anki niyetinle eşleşiyor.`,
      short: `${targetType} tercihine uyuyor`,
    });
  }

  const selectedPlatforms = Array.isArray(context.platformFilters) ? context.platformFilters : [];
  const selectedPlatformMatch = targetPlatforms.find((p) => selectedPlatforms.includes(p));
  if (selectedPlatformMatch) {
    addReason(reasons, {
      score: 93,
      source: "ŞU ANKİ FİLTREN",
      personalized: true,
      title: "İzleyebileceğin platformda",
      detail: `${selectedPlatformMatch} filtresini açtın ve bu içerik orada izlenebiliyor.`,
      short: `${selectedPlatformMatch} filtrene uyuyor`,
    });
  }

  if (Array.isArray(context.yearFilters) && context.yearFilters.length) {
    addReason(reasons, {
      score: 88,
      source: "ŞU ANKİ FİLTREN",
      personalized: true,
      title: "Seçtiğin dönem aralığında",
      detail: `${movie.year || "Bu yapım"}, seçtiğin ${context.yearFilters.join(", ")} dönem filtresinden geçti.`,
      short: "Seçtiğin dönem filtresine uyuyor",
    });
  }

  const genreCounts = new Map();
  const matchedLikes = [];
  likes.forEach((liked) => {
    const likedGenres = movieGenres(liked);
    const shared = targetGenres.filter((g) => likedGenres.includes(g));
    if (!shared.length) return;
    matchedLikes.push({ movie: liked, shared });
    shared.forEach((g) => genreCounts.set(g, (genreCounts.get(g) || 0) + 1));
  });

  const strongestGenre = [...genreCounts.entries()].sort((a, b) => b[1] - a[1])[0];
  if (strongestGenre) {
    const [genre, count] = strongestGenre;
    const knownGenreLikes = likes.filter((m) => movieGenres(m).length).length || likes.length || 1;
    const pct = Math.round((count / knownGenreLikes) * 100);
    addReason(reasons, {
      score: 92 + Math.min(count, 5),
      source: "BEĞENİ GEÇMİŞİN",
      personalized: true,
      title: "Beğeni geçmişinle güçlü tür eşleşmesi var",
      detail: `${genre}, beğendiğin ${count} içerikte de var${knownGenreLikes >= 4 ? `; kayıtlı beğenilerinin yaklaşık %${pct}'ine denk geliyor` : ""}.`,
      short: `${genre} · ${count} beğeninle eşleşiyor`,
    });
  }

  if (matchedLikes.length) {
    const examples = matchedLikes
      .sort((a, b) => b.shared.length - a.shared.length)
      .map((x) => x.movie?.title)
      .filter(Boolean)
      .slice(0, 2);
    if (examples.length) {
      const sharedGenres = [...new Set(matchedLikes.flatMap((x) => x.shared))].slice(0, 2);
      addReason(reasons, {
        score: 90,
        source: "BEĞENDİĞİN İÇERİKLER",
        personalized: true,
        title: "Daha önce sevdiğin yapımlarla ortak tarafı var",
        detail: `${examples.map((x) => `“${x}”`).join(" ve ")} ile ${sharedGenres.join(" / ")} tarafında kesişiyor.`,
        short: `${examples[0]} ile benzer zevk sinyali`,
      });
    }
  }

  const typedLikes = likes.filter((m) => m.type === "Film" || m.type === "Dizi");
  if (typedLikes.length >= 3 && (targetType === "Film" || targetType === "Dizi")) {
    const sameTypeCount = typedLikes.filter((m) => m.type === targetType).length;
    const ratio = sameTypeCount / typedLikes.length;
    if (ratio >= 0.6) {
      addReason(reasons, {
        score: 79,
        source: "BEĞENİ ALIŞKANLIĞIN",
        personalized: true,
        title: `${targetType} tarafına daha çok eğiliyorsun`,
        detail: `Bildigimiz beğenilerinin %${Math.round(ratio * 100)}'i ${targetType.toLowerCase()}; bu seçim de aynı formatta.`,
        short: `Beğenilerinin %${Math.round(ratio * 100)}'i ${targetType.toLowerCase()}`,
      });
    }
  }

  const likedRuntimes = likes.map((m) => runtimeMinutes(m.runtime)).filter((x) => x != null && x > 0);
  if (targetRuntime != null && likedRuntimes.length >= 3) {
    const typical = median(likedRuntimes);
    if (typical != null && Math.abs(targetRuntime - typical) <= 25) {
      addReason(reasons, {
        score: 72,
        source: "SÜRE ALIŞKANLIĞIN",
        personalized: true,
        title: "Sevdiğin içeriklerin süresine yakın",
        detail: `Beğendiğin yapımların tipik süresi yaklaşık ${typical} dakika; bu içerik ${targetRuntime} dakika.`,
        short: `Süre zevkine yakın · ${targetRuntime} dk`,
      });
    }
  }

  const likedDecades = new Map();
  likes.forEach((m) => {
    const d = decadeOf(m.year);
    if (d != null) likedDecades.set(d, (likedDecades.get(d) || 0) + 1);
  });
  const topDecade = [...likedDecades.entries()].sort((a, b) => b[1] - a[1])[0];
  if (targetDecade != null && topDecade && topDecade[0] === targetDecade && topDecade[1] >= 2) {
    addReason(reasons, {
      score: 68,
      source: "DÖNEM ZEVKİN",
      personalized: true,
      title: "Sık beğendiğin dönemden",
      detail: `Beğeni geçmişinde ${targetDecade}'lar öne çıkıyor; bu yapım da ${movie.year || targetDecade} tarihli.`,
      short: `${targetDecade}'lar zevkine uyuyor`,
    });
  }

  const likedPlatformCounts = new Map();
  likes.forEach((m) => {
    platformNames(m).forEach((p) => likedPlatformCounts.set(p, (likedPlatformCounts.get(p) || 0) + 1));
  });
  const platformMatch = targetPlatforms
    .map((p) => [p, likedPlatformCounts.get(p) || 0])
    .sort((a, b) => b[1] - a[1])[0];
  if (platformMatch && platformMatch[1] >= 2) {
    addReason(reasons, {
      score: 61,
      source: "İZLEME ERİŞİMİN",
      personalized: true,
      title: "Sık denk geldiğin platformlardan birinde",
      detail: `Beğendiğin içeriklerin en az ${platformMatch[1]} tanesi de ${platformMatch[0]} kataloğunda; bu yapım da orada.`,
      short: `${platformMatch[0]} · geçmişinle örtüşüyor`,
    });
  }

  const rating = Number(movie.imdb);
  if (Number.isFinite(rating) && rating >= 7.4) {
    addReason(reasons, {
      score: 35,
      source: "İÇERİK SİNYALİ",
      personalized: false,
      title: "Kalite sinyali de güçlü",
      detail: `IMDb puanı ${rating.toFixed(1)}; kişisel eşleşmeyi destekleyen güçlü bir genel kalite sinyali.`,
      short: `${rating.toFixed(1)} IMDb · güçlü kalite sinyali`,
    });
  }

  if (!reasons.length && targetGenres.length) {
    addReason(reasons, {
      score: 10,
      source: "PELLIX SEÇİMİ",
      personalized: false,
      title: "Zevk profilin henüz gelişiyor",
      detail: `${targetGenres.slice(0, 2).join(" / ")} türündeki bu içerik akışında öne çıktı. Birkaç beğeni daha verdikçe nedenler daha kişisel hale gelecek.`,
      short: `${targetGenres[0]} · zevk profilin geliştikçe daha kişisel olacak`,
    });
  }

  return reasons.sort((a, b) => b.score - a.score);
}

// Kartlarda tek satırlık eski API'yi kullanan yerleri bozmadan, yeni açıklama motorunun
// en güçlü kısa nedenini döndürür.
export function recommendationReason(movie, likedIds, moviesById) {
  const likedMovies = [];
  likedIds?.forEach?.((id) => {
    const liked = moviesById?.get?.(id);
    if (liked) likedMovies.push(liked);
  });
  return recommendationReasons(movie, likedMovies)[0]?.short || null;
}
