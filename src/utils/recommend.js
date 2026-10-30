import { t as translateUI, getLanguage } from "../i18n/core";
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
      source: translateUI("PROFİL TERCİHİN"),
      personalized: true,
      title: translateUI("Seçtiğin türlerle doğrudan eşleşiyor"),
      detail: translateUI("Profilinde özellikle seçtiğin {0} türü bu içerikte var.", {0: (preferredOverlap.slice(0, 2).map(g => translateUI(g)).join(getLanguage() === "en" ? " and " : " ve "))}),
      short: translateUI("{0} tercihinle eşleşiyor", {0: (translateUI(preferredOverlap[0]))}),
    });
  }

  if (context.aiLabel && !/^ai önerilerin$/i.test(String(context.aiLabel).trim())) {
    addReason(reasons, {
      score: 100,
      source: translateUI("ŞU ANKİ İSTEĞİN"),
      personalized: true,
      title: translateUI("Az önce tarif ettiğin şeye göre seçildi"),
      detail: translateUI("“{0}” isteğin için çıkan sonuçlar arasında bu içerik üst sıralarda.", {0: (context.aiLabel)}),
      short: translateUI("Az önceki isteğine göre öne çıktı"),
    });
  }

  if (context.genreFilter && targetGenres.includes(context.genreFilter)) {
    addReason(reasons, {
      score: 96,
      source: translateUI("ŞU ANKİ FİLTREN"),
      personalized: true,
      title: translateUI("Tam seçtiğin türde"),
      detail: translateUI("Şu an akışı {0} türüne daralttın; bu içerik o tercihle doğrudan eşleşiyor.", {0: (translateUI(context.genreFilter))}),
      short: translateUI("{0} filtrene uyuyor", {0: (translateUI(context.genreFilter))}),
    });
  }

  if (context.shortOnly && targetRuntime != null && targetRuntime <= 105) {
    addReason(reasons, {
      score: 95,
      source: translateUI("ŞU ANKİ FİLTREN"),
      personalized: true,
      title: translateUI("Kısa bir şey istediğin için öne çıktı"),
      detail: translateUI("{0} dakikalık süresi, açtığın “Kısa bir şey” tercihine uyuyor.", {0: (targetRuntime)}),
      short: translateUI("{0} dk · kısa içerik tercihine uyuyor", {0: (targetRuntime)}),
    });
  }

  if (context.typeFilter && context.typeFilter !== "Hepsi" && targetType === context.typeFilter) {
    addReason(reasons, {
      score: 94,
      source: translateUI("ŞU ANKİ FİLTREN"),
      personalized: true,
      title: translateUI("Şu an {0} arıyorsun", {0: (translateUI(targetType).toLowerCase())}),
      detail: translateUI("Akışı {0} olarak filtrelediğin için bu seçim o anki niyetinle eşleşiyor.", {0: (translateUI(targetType))}),
      short: translateUI("{0} tercihine uyuyor", {0: (translateUI(targetType))}),
    });
  }

  const selectedPlatforms = Array.isArray(context.platformFilters) ? context.platformFilters : [];
  const selectedPlatformMatch = targetPlatforms.find((p) => selectedPlatforms.includes(p));
  if (selectedPlatformMatch) {
    addReason(reasons, {
      score: 93,
      source: translateUI("ŞU ANKİ FİLTREN"),
      personalized: true,
      title: translateUI("İzleyebileceğin platformda"),
      detail: translateUI("{0} filtresini açtın ve bu içerik orada izlenebiliyor.", {0: (selectedPlatformMatch)}),
      short: translateUI("{0} filtrene uyuyor", {0: (selectedPlatformMatch)}),
    });
  }

  if (Array.isArray(context.yearFilters) && context.yearFilters.length) {
    addReason(reasons, {
      score: 88,
      source: translateUI("ŞU ANKİ FİLTREN"),
      personalized: true,
      title: translateUI("Seçtiğin dönem aralığında"),
      detail: translateUI("{0}, seçtiğin {1} dönem filtresinden geçti.", {0: (movie.year || "Bu yapım"),1: (context.yearFilters.map(g => translateUI(g)).join(", "))}),
      short: translateUI("Seçtiğin dönem filtresine uyuyor"),
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
      source: translateUI("BEĞENİ GEÇMİŞİN"),
      personalized: true,
      title: translateUI("Beğeni geçmişinle güçlü tür eşleşmesi var"),
      detail: translateUI("{0}, beğendiğin {1} içerikte de var{2}.", {0: (translateUI(genre)),1: (count),2: (knownGenreLikes >= 4 ? translateUI("; kayıtlı beğenilerinin yaklaşık %{0}'ine denk geliyor", {0: (pct)}) : translateUI(""))}),
      short: translateUI("{0} · {1} beğeninle eşleşiyor", {0: (translateUI(genre)),1: (count)}),
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
        source: translateUI("BEĞENDİĞİN İÇERİKLER"),
        personalized: true,
        title: translateUI("Daha önce sevdiğin yapımlarla ortak tarafı var"),
        detail: translateUI("{0} ile {1} tarafında kesişiyor.", {0: (examples.map((x) => `“${x}”`).join(getLanguage() === "en" ? " and " : " ve ")),1: (sharedGenres.map(g => translateUI(g)).join(" / "))}),
        short: translateUI("{0} ile benzer zevk sinyali", {0: (examples[0])}),
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
        source: translateUI("BEĞENİ ALIŞKANLIĞIN"),
        personalized: true,
        title: translateUI("{0} tarafına daha çok eğiliyorsun", {0: (translateUI(targetType))}),
        detail: translateUI("Bildiğimiz beğenilerinin %{0}'i {1}; bu seçim de aynı formatta.", {0: (Math.round(ratio * 100)),1: (translateUI(targetType).toLowerCase())}),
        short: translateUI("Beğenilerinin %{0}'i {1}", {0: (Math.round(ratio * 100)),1: (translateUI(targetType).toLowerCase())}),
      });
    }
  }

  const likedRuntimes = likes.map((m) => runtimeMinutes(m.runtime)).filter((x) => x != null && x > 0);
  if (targetRuntime != null && likedRuntimes.length >= 3) {
    const typical = median(likedRuntimes);
    if (typical != null && Math.abs(targetRuntime - typical) <= 25) {
      addReason(reasons, {
        score: 72,
        source: translateUI("SÜRE ALIŞKANLIĞIN"),
        personalized: true,
        title: translateUI("Sevdiğin içeriklerin süresine yakın"),
        detail: translateUI("Beğendiğin yapımların tipik süresi yaklaşık {0} dakika; bu içerik {1} dakika.", {0: (typical),1: (targetRuntime)}),
        short: translateUI("Süre zevkine yakın · {0} dk", {0: (targetRuntime)}),
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
      source: translateUI("DÖNEM ZEVKİN"),
      personalized: true,
      title: translateUI("Sık beğendiğin dönemden"),
      detail: translateUI("Beğeni geçmişinde {0}'lar öne çıkıyor; bu yapım da {1} tarihli.", {0: (targetDecade),1: (movie.year || targetDecade)}),
      short: translateUI("{0}'lar zevkine uyuyor", {0: (targetDecade)}),
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
      source: translateUI("İZLEME ERİŞİMİN"),
      personalized: true,
      title: translateUI("Sık denk geldiğin platformlardan birinde"),
      detail: translateUI("Beğendiğin içeriklerin en az {0} tanesi de {1} kataloğunda; bu yapım da orada.", {0: (platformMatch[1]),1: (platformMatch[0])}),
      short: translateUI("{0} · geçmişinle örtüşüyor", {0: (platformMatch[0])}),
    });
  }

  const rating = Number(movie.imdb);
  if (Number.isFinite(rating) && rating >= 7.4) {
    addReason(reasons, {
      score: 35,
      source: translateUI("İÇERİK SİNYALİ"),
      personalized: false,
      title: translateUI("Kalite sinyali de güçlü"),
      detail: translateUI("IMDb puanı {0}; kişisel eşleşmeyi destekleyen güçlü bir genel kalite sinyali.", {0: (rating.toFixed(1))}),
      short: translateUI("{0} IMDb · güçlü kalite sinyali", {0: (rating.toFixed(1))}),
    });
  }

  if (!reasons.length && targetGenres.length) {
    addReason(reasons, {
      score: 10,
      source: translateUI("PELLIX SEÇİMİ"),
      personalized: false,
      title: translateUI("Zevk profilin henüz gelişiyor"),
      detail: translateUI("{0} türündeki bu içerik akışında öne çıktı. Birkaç beğeni daha verdikçe nedenler daha kişisel hale gelecek.", {0: (targetGenres.slice(0, 2).map(g => translateUI(g)).join(" / "))}),
      short: translateUI("{0} · zevk profilin geliştikçe daha kişisel olacak", {0: (translateUI(targetGenres[0]))}),
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
