import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  View,
  Text,
  Image,
  FlatList,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  TextInput,
  TouchableOpacity,
  Keyboard,
  useWindowDimensions,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import {
  Search,
  Filter,
  Sparkles,
  Clock,
  X,
  Star,
  Heart,
  Film,
  Tv,
  Users,
  Shuffle,
  Timer,
  Trophy,
  Puzzle,
  ChevronRight,
} from "lucide-react-native";
import { useAppTheme } from "../context/ThemeContext";
import { useAuth } from "../context/AuthContext";
import { api } from "../api/client";
import { diaryApi } from "../api/diary";
import { GENRE_FILTERS } from "../theme/theme";
import MovieCard from "../components/MovieCard";
import PopularNowRow from "../components/PopularNowRow";
import { platformName, platformLogo } from "../utils/platform";
import { yearMatchesLabel } from "../utils/filterYears";
import { recommendationReason, recommendationReasons } from "../utils/recommend";
import TopBar from "../components/TopBar";
import SendToFriendModal from "../components/SendToFriendModal";
import ListPickerModal from "../components/ListPickerModal";
import AIZone from "../components/AIZone";
import EmptyState from "../components/EmptyState";
import FilterFields from "../components/FilterFields";
import IslandModal from "../components/IslandModal";
import HomeSkeleton from "../components/skeletons/HomeSkeleton";
import RecommendationWhyModal from "../components/RecommendationWhyModal";

function dedupe(items) {
  const byId = new Map();
  (items || []).forEach((m) => m?.id != null && byId.set(m.id, m));
  return [...byId.values()];
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

function questSummary(data) {
  const quests = data?.quests || [];
  const complete = quests.filter((q) => q.completed).length;
  return {
    complete,
    total: quests.length,
    percent: quests.length ? Math.round((complete / quests.length) * 100) : 0,
  };
}

export default function HomeScreenV2({ navigation }) {
  const { c } = useAppTheme();
  const { auth } = useAuth();
  const { width: windowWidth } = useWindowDimensions();
  const styles = makeStyles(c);
  const heroCardWidth = Math.max(280, windowWidth - 32);

  const mainListRef = useRef(null);
  const upcomingListRef = useRef(null);
  const heroListRef = useRef(null);
  const loadedIdsRef = useRef(new Set());

  const [activeTab, setActiveTab] = useState("forYou");
  const [movies, setMovies] = useState([]);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const [liked, setLiked] = useState(new Set());
  const [likedMovies, setLikedMovies] = useState([]);
  const [preferredGenres, setPreferredGenres] = useState([]);
  const [disliked, setDisliked] = useState(new Set());
  const [watchlist, setWatchlist] = useState(new Set());

  const [query, setQuery] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchFocused, setSearchFocused] = useState(false);
  const searchSeqRef = useRef(0);

  const [showFilters, setShowFilters] = useState(false);
  const [typeFilter, setTypeFilter] = useState("Hepsi");
  const [genreFilter, setGenreFilter] = useState(null);
  const [platformFilters, setPlatformFilters] = useState(new Set());
  const [yearFilters, setYearFilters] = useState(new Set());
  const [shortOnly, setShortOnly] = useState(false);

  const [popularNow, setPopularNow] = useState([]);
  const [spotlight, setSpotlight] = useState({ upcoming: [] });
  const [notifySubs, setNotifySubs] = useState(new Set());
  const [questData, setQuestData] = useState(null);
  const [diaryStats, setDiaryStats] = useState(null);

  const [describeResults, setDescribeResults] = useState(null);
  const [describeCount, setDescribeCount] = useState(8);
  const [aiResultsLabel, setAiResultsLabel] = useState("");

  const [sendMovie, setSendMovie] = useState(null);
  const [pickerMovie, setPickerMovie] = useState(null);
  const [showHeroReasons, setShowHeroReasons] = useState(false);
  const [activeHeroIndex, setActiveHeroIndex] = useState(0);

  const loadInteractions = useCallback(async () => {
    try {
      const [data, selfProfile, me] = await Promise.all([
        api.interactions(auth.token),
        api.userProfile(auth.token, auth.id).catch(() => ({ likedMovies: [] })),
        api.me(auth.token).catch(() => ({ preferredGenres: [] })),
      ]);
      const nextLiked = new Set();
      const nextDisliked = new Set();
      const nextWatchlist = new Set();
      (data.results || []).forEach((row) => {
        if (row.action === "like") nextLiked.add(row.movie_id);
        else if (row.action === "dislike") nextDisliked.add(row.movie_id);
        else if (row.action === "watchlist") nextWatchlist.add(row.movie_id);
      });
      setLiked(nextLiked);
      setLikedMovies(selfProfile.likedMovies || []);
      setPreferredGenres(me.preferredGenres || []);
      setDisliked(nextDisliked);
      setWatchlist(nextWatchlist);
    } catch {
      // Ana sayfa içerik göstermeye devam etsin.
    }
  }, [auth.token, auth.id]);

  const loadPage = useCallback(async (pageNum) => {
    const excludeIds = [...loadedIdsRef.current].slice(-500);
    const [movieRes, tvRes] = await Promise.all([
      api.movies(auth.token, "movie", pageNum, null, excludeIds).catch(() => ({ results: [] })),
      api.movies(auth.token, "tv", pageNum, null, excludeIds).catch(() => ({ results: [] })),
    ]);
    const items = dedupe([...(movieRes.results || []), ...(tvRes.results || [])]);
    items.forEach((m) => loadedIdsRef.current.add(m.id));
    return items;
  }, [auth.token]);

  const loadTrending = useCallback(async () => {
    try {
      const [movieRes, tvRes] = await Promise.all([
        api.trending(auth.token, "movie").catch(() => ({ results: [] })),
        api.trending(auth.token, "tv").catch(() => ({ results: [] })),
      ]);
      const a = movieRes.results || [];
      const b = tvRes.results || [];
      const merged = [];
      const len = Math.max(a.length, b.length);
      for (let i = 0; i < len; i++) {
        if (a[i]) merged.push(a[i]);
        if (b[i]) merged.push(b[i]);
      }
      setPopularNow(dedupe(merged).slice(0, 20));
    } catch {
      setPopularNow([]);
    }
  }, [auth.token]);

  const loadSecondary = useCallback(() => {
    api.spotlight(auth.token)
      .then((data) => setSpotlight({ upcoming: data.upcoming || [] }))
      .catch(() => setSpotlight({ upcoming: [] }));
    api.notifySubscriptions(auth.token)
      .then((data) => setNotifySubs(new Set(data.movieIds || [])))
      .catch(() => {});
    api.quests(auth.token).then(setQuestData).catch(() => setQuestData(null));
    diaryApi.stats(auth.token).then(setDiaryStats).catch(() => setDiaryStats(null));
    loadTrending();
  }, [auth.token, loadTrending]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      const [, first] = await Promise.all([loadInteractions(), loadPage(1)]);
      if (!cancelled) {
        setMovies(first);
        setPage(1);
        setLoading(false);
      }
    })();
    loadSecondary();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    const unsub = navigation.addListener("focus", () => {
      api.quests(auth.token).then(setQuestData).catch(() => {});
    });
    return unsub;
  }, [navigation, auth.token]);

  useEffect(() => {
    if (!query.trim()) {
      setSearchResults([]);
      setSearchLoading(false);
      return;
    }

    setSearchLoading(true);
    const timer = setTimeout(() => {
      const seq = ++searchSeqRef.current;
      Promise.all([
        api.search(auth.token, query, "movie").catch(() => ({ results: [] })),
        api.search(auth.token, query, "tv").catch(() => ({ results: [] })),
        api.search(auth.token, query, "person").catch(() => ({ results: [] })),
      ]).then(([mRes, tRes, pRes]) => {
        if (seq !== searchSeqRef.current) return;
        const q = query.trim().toLocaleLowerCase("tr-TR");
        const media = dedupe([...(mRes.results || []), ...(tRes.results || [])]).sort((a, b) => {
          const ta = (a.title || "").toLocaleLowerCase("tr-TR");
          const tb = (b.title || "").toLocaleLowerCase("tr-TR");
          const rank = (title) => title === q ? 0 : title.startsWith(q) ? 1 : 2;
          return rank(ta) - rank(tb) || Number(b.votes || 0) - Number(a.votes || 0);
        });
        setSearchResults([...media, ...(pRes.results || []).slice(0, 3)].slice(0, 7));
      }).finally(() => {
        if (seq === searchSeqRef.current) setSearchLoading(false);
      });
    }, 250);

    return () => clearTimeout(timer);
  }, [query, auth.token]);

  useEffect(() => {
    const unsub = navigation.addListener("tabPress", () => {
      if (!navigation.isFocused()) return;
      const ref = activeTab === "forYou" ? mainListRef : upcomingListRef;
      ref.current?.scrollToOffset?.({ offset: 0, animated: true });
    });
    return unsub;
  }, [navigation, activeTab]);

  function handleAiResults(results, label) {
    setDescribeResults(results || []);
    setAiResultsLabel(label || "AI önerilerin");
    setDescribeCount(8);
    setActiveTab("forYou");
  }

  function clearAiResults() {
    setDescribeResults(null);
    setAiResultsLabel("");
  }

  const moviesById = useMemo(() => {
    const map = new Map();
    [...movies, ...likedMovies].forEach((m) => {
      if (m?.id != null) map.set(m.id, m);
    });
    return map;
  }, [movies, likedMovies]);

  const tasteLikedMovies = useMemo(() => {
    const byId = new Map();
    likedMovies.forEach((movie) => {
      if (movie?.id != null) byId.set(Number(movie.id), movie);
    });
    liked.forEach((id) => {
      const movie = moviesById.get(id) || moviesById.get(Number(id));
      if (movie?.id != null) byId.set(Number(movie.id), movie);
    });
    return [...byId.values()];
  }, [likedMovies, liked, moviesById]);

  const filteredList = useMemo(() => {
    let result = movies;
    if (typeFilter !== "Hepsi") result = result.filter((m) => m.type === typeFilter);
    if (genreFilter) {
      result = result.filter((m) => {
        const genres = Array.isArray(m.genres) && m.genres.length ? m.genres : [m.genre];
        return genres.includes(genreFilter);
      });
    }
    if (platformFilters.size > 0) {
      result = result.filter((m) => (m.platforms || []).some((p) => platformFilters.has(platformName(p))));
    }
    if (yearFilters.size > 0) {
      result = result.filter((m) => [...yearFilters].some((label) => yearMatchesLabel(m.year, label)));
    }
    if (shortOnly) {
      result = result.filter((m) => {
        const mins = runtimeMinutes(m.runtime);
        return mins != null && mins <= 105;
      });
    }
    return result;
  }, [movies, typeFilter, genreFilter, platformFilters, yearFilters, shortOnly]);

  const visibleList = describeResults ? describeResults.slice(0, describeCount) : filteredList;
  const recommendationContext = useMemo(() => ({
    preferredGenres,
    genreFilter,
    typeFilter,
    shortOnly,
    platformFilters: [...platformFilters],
    yearFilters: [...yearFilters],
    aiLabel: describeResults ? aiResultsLabel : null,
  }), [preferredGenres, genreFilter, typeFilter, shortOnly, platformFilters, yearFilters, describeResults, aiResultsLabel]);

  const heroSourceList = describeResults ? describeResults : filteredList;
  const heroSelections = useMemo(() => {
    const eligible = dedupe(heroSourceList.filter((movie) => !disliked.has(movie.id))).slice(0, 60);
    const pool = eligible.length ? eligible : dedupe(heroSourceList).slice(0, 60);
    if (!pool.length) return [];

    return pool
      .map((movie, index) => {
        const reasons = recommendationReasons(movie, tasteLikedMovies, recommendationContext);
        const personalized = reasons.filter((reason) => reason.personalized);
        const score = personalized.length
          ? personalized.slice(0, 4).reduce(
              (sum, reason, reasonIndex) => sum + reason.score * (1 - reasonIndex * 0.12),
              0,
            ) + personalized.length * 6 - index * 0.05
          : -index;
        return { movie, reasons, score, sourceIndex: index };
      })
      .sort((a, b) => b.score - a.score || a.sourceIndex - b.sourceIndex)
      .slice(0, 10);
  }, [heroSourceList, disliked, tasteLikedMovies, recommendationContext]);

  const safeHeroIndex = Math.min(activeHeroIndex, Math.max(0, heroSelections.length - 1));
  const heroSelection = heroSelections[safeHeroIndex] || { movie: null, reasons: [], score: -Infinity };
  const heroMovie = heroSelection.movie;
  const heroReasons = heroSelection.reasons;
  const heroReason = heroReasons.find((reason) => reason.personalized)?.short || heroReasons[0]?.short || null;
  const heroIds = useMemo(() => new Set(heroSelections.map((item) => item.movie?.id).filter(Boolean)), [heroSelections]);
  const gridList = describeResults
    ? visibleList
    : heroSelections.length
      ? visibleList.filter((m) => !heroIds.has(m.id))
      : visibleList;

  useEffect(() => {
    setActiveHeroIndex(0);
    heroListRef.current?.scrollToOffset?.({ offset: 0, animated: false });
  }, [typeFilter, genreFilter, shortOnly, platformFilters, yearFilters, describeResults, aiResultsLabel]);

  useEffect(() => {
    if (activeHeroIndex < heroSelections.length) return;
    setActiveHeroIndex(0);
    heroListRef.current?.scrollToOffset?.({ offset: 0, animated: false });
  }, [activeHeroIndex, heroSelections.length]);

  const availablePlatformObjs = useMemo(() => {
    const byName = new Map();
    movies.forEach((m) => (m.platforms || []).forEach((p) => {
      const name = platformName(p);
      if (!name) return;
      const existing = byName.get(name);
      if (!existing || (!platformLogo(existing) && platformLogo(p))) byName.set(name, p);
    }));
    return [...byName.values()];
  }, [movies]);

  const anyFilterActive = typeFilter !== "Hepsi" || !!genreFilter || platformFilters.size > 0 || yearFilters.size > 0 || shortOnly;

  async function handleLoadMore() {
    if (loadingMore || describeResults) return;
    setLoadingMore(true);
    const next = page + 1;
    const items = await loadPage(next);
    setMovies((prev) => dedupe([...prev, ...items]));
    setPage(next);
    setLoadingMore(false);
  }

  async function handleRefresh() {
    setRefreshing(true);
    loadedIdsRef.current.clear();
    await loadInteractions();
    const first = await loadPage(1);
    setMovies(first);
    setPage(1);
    loadSecondary();
    setRefreshing(false);
  }

  function like(id) {
    const wasLiked = liked.has(id);
    setLiked((prev) => {
      const next = new Set(prev);
      wasLiked ? next.delete(id) : next.add(id);
      return next;
    });
    setDisliked((prev) => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
    if (wasLiked) api.removeInteraction(auth.token, id, "like").catch(() => {});
    else api.recordInteraction(auth.token, id, "like").catch(() => {});
  }

  function dislike(id) {
    const wasDisliked = disliked.has(id);
    setDisliked((prev) => {
      const next = new Set(prev);
      wasDisliked ? next.delete(id) : next.add(id);
      return next;
    });
    setLiked((prev) => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
    if (wasDisliked) api.removeInteraction(auth.token, id, "dislike").catch(() => {});
    else api.recordInteraction(auth.token, id, "dislike").catch(() => {});
  }

  const toggleNotify = useCallback(async (movieId) => {
    const wasSubscribed = notifySubs.has(movieId);
    setNotifySubs((prev) => {
      const next = new Set(prev);
      wasSubscribed ? next.delete(movieId) : next.add(movieId);
      return next;
    });
    try {
      await api.notifyMe(auth.token, movieId);
    } catch {
      setNotifySubs((prev) => {
        const next = new Set(prev);
        wasSubscribed ? next.add(movieId) : next.delete(movieId);
        return next;
      });
    }
  }, [notifySubs, auth.token]);

  function togglePlatform(name) {
    setPlatformFilters((prev) => {
      const next = new Set(prev);
      next.has(name) ? next.delete(name) : next.add(name);
      return next;
    });
  }

  function toggleYear(label) {
    setYearFilters((prev) => {
      const next = new Set(prev);
      next.has(label) ? next.delete(label) : next.add(label);
      return next;
    });
  }

  function clearFilters() {
    setTypeFilter("Hepsi");
    setGenreFilter(null);
    setPlatformFilters(new Set());
    setYearFilters(new Set());
    setShortOnly(false);
  }

  function surpriseMe() {
    if (!visibleList.length) return;
    const options = visibleList.filter((m) => !disliked.has(m.id));
    const pool = options.length ? options : visibleList;
    const pick = pool[Math.floor(Math.random() * pool.length)];
    if (pick) navigation.navigate("Detail", { movie: pick });
  }

  function selectSearchResult(item) {
    setQuery("");
    setSearchFocused(false);
    Keyboard.dismiss();
    if (item.kind === "person") {
      navigation.navigate("Person", {
        personId: item.personId || item.id,
        name: item.name,
        photo: item.photo,
        role: item.role || "actor",
      });
    } else {
      navigation.navigate("Detail", { movie: item });
    }
  }

  const renderCompactCard = useCallback(({ item, index }) => (
    <MovieCard
      movie={item}
      liked={liked.has(item.id)}
      disliked={disliked.has(item.id)}
      onLike={like}
      onDislike={dislike}
      onPress={(movie) => navigation.navigate("Detail", { movie })}
      reason={!describeResults && index < 8 ? recommendationReason(item, liked, moviesById) : null}
      compact
    />
  ), [liked, disliked, describeResults, moviesById, navigation]);

  const renderUpcomingCard = useCallback(({ item }) => (
    <MovieCard
      movie={item}
      liked={liked.has(item.id)}
      disliked={disliked.has(item.id)}
      watchlisted={watchlist.has(item.id)}
      onLike={like}
      onDislike={dislike}
      onAddToList={setPickerMovie}
      onSend={setSendMovie}
      onPress={(movie) => navigation.navigate("Detail", { movie })}
      showNotify
      notifySubscribed={notifySubs.has(item.id)}
      onNotify={toggleNotify}
    />
  ), [liked, disliked, watchlist, notifySubs, toggleNotify, navigation]);

  if (loading) {
    return (
      <View style={{ flex: 1, backgroundColor: c.bg }}>
        <TopBar centerLabel="Ana Sayfa" />
        <HomeSkeleton />
      </View>
    );
  }

  const q = questSummary(questData);

  const forYouHeader = (
    <View>
      <View style={styles.searchBlock}>
        <View style={styles.searchRow}>
          <View style={[styles.searchBox, searchFocused && styles.searchBoxFocused]}>
            <Search size={16} color={searchFocused ? c.accent : c.dim} />
            <TextInput
              style={styles.searchInput}
              placeholder="Film, dizi, oyuncu veya yönetmen ara"
              placeholderTextColor={c.dim}
              value={query}
              onChangeText={setQuery}
              onFocus={() => setSearchFocused(true)}
              onBlur={() => setSearchFocused(false)}
            />
            {!!query && (
              <TouchableOpacity onPress={() => setQuery("")} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <X size={15} color={c.dim} />
              </TouchableOpacity>
            )}
          </View>
          <TouchableOpacity style={[styles.filterBtn, anyFilterActive && styles.filterBtnActive]} onPress={() => setShowFilters(true)}>
            <Filter size={16} color={anyFilterActive ? c.bg : c.text} />
            {anyFilterActive && <View style={styles.filterDot} />}
          </TouchableOpacity>
        </View>

        {!!query.trim() && (
          <View style={styles.searchResultsCard}>
            {searchLoading ? (
              <ActivityIndicator color={c.accent} style={{ paddingVertical: 18 }} />
            ) : searchResults.length === 0 ? (
              <Text style={styles.searchEmpty}>“{query}” için sonuç bulunamadı.</Text>
            ) : (
              searchResults.map((item, index) => {
                const person = item.kind === "person";
                const image = person ? item.photo : item.poster;
                return (
                  <TouchableOpacity
                    key={`${item.kind || item.type}-${item.id}-${index}`}
                    style={styles.searchResultRow}
                    onPress={() => selectSearchResult(item)}
                    activeOpacity={0.78}
                  >
                    {image ? (
                      <Image source={{ uri: image }} style={[styles.searchThumb, person && styles.searchPersonThumb]} />
                    ) : (
                      <View style={[styles.searchThumb, person && styles.searchPersonThumb, { backgroundColor: c.surface2 }]} />
                    )}
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <Text style={styles.searchResultTitle} numberOfLines={1}>{person ? item.name : item.title}</Text>
                      <Text style={styles.searchResultMeta} numberOfLines={1}>
                        {person ? item.roleLabel : `${item.year || ""} · ${item.type || ""}`}
                      </Text>
                    </View>
                    {!person && (
                      <View style={styles.searchRating}>
                        <Star size={10} color={c.accent} fill={c.accent} />
                        <Text style={styles.searchRatingText}>{item.imdb}</Text>
                      </View>
                    )}
                  </TouchableOpacity>
                );
              })
            )}
          </View>
        )}

        <AIZone
          navigation={navigation}
          hasResults={!!describeResults}
          onResults={handleAiResults}
          onClear={clearAiResults}
        />

        {!!describeResults && (
          <View style={styles.aiResultBanner}>
            <Sparkles size={13} color="#8B5CF6" />
            <Text style={styles.aiResultText} numberOfLines={1}>{aiResultsLabel || "AI önerilerin"}</Text>
            <TouchableOpacity onPress={clearAiResults}><Text style={styles.aiClear}>Temizle</Text></TouchableOpacity>
          </View>
        )}
      </View>

      <View style={styles.heroArea}>
        {heroSelections.length ? (
          <>
            <FlatList
              ref={heroListRef}
              horizontal
              data={heroSelections}
              keyExtractor={(item) => String(item.movie.id)}
              showsHorizontalScrollIndicator={false}
              pagingEnabled
              nestedScrollEnabled
              decelerationRate="fast"
              snapToInterval={heroCardWidth}
              disableIntervalMomentum
              getItemLayout={(_, index) => ({ length: heroCardWidth, offset: heroCardWidth * index, index })}
              onMomentumScrollEnd={(event) => {
                const nextIndex = Math.round(event.nativeEvent.contentOffset.x / heroCardWidth);
                setActiveHeroIndex(Math.max(0, Math.min(nextIndex, heroSelections.length - 1)));
              }}
              renderItem={({ item, index }) => {
                const movie = item.movie;
                const reason = item.reasons.find((entry) => entry.personalized)?.short || item.reasons[0]?.short || null;
                return (
                  <TonightHero
                    width={heroCardWidth}
                    movie={movie}
                    reason={reason}
                    liked={liked.has(movie.id)}
                    onLike={() => like(movie.id)}
                    onWhy={() => {
                      setActiveHeroIndex(index);
                      setShowHeroReasons(true);
                    }}
                    onPress={() => navigation.navigate("Detail", { movie })}
                    c={c}
                  />
                );
              }}
            />
            <View style={styles.heroPagerRow}>
              <Text style={styles.heroPagerCount}>{safeHeroIndex + 1}/{heroSelections.length}</Text>
              <View style={styles.heroDotsRow}>
                {heroSelections.map((item, index) => (
                  <View
                    key={`hero-dot-${item.movie.id}`}
                    style={[styles.heroDot, index === safeHeroIndex && styles.heroDotActive]}
                  />
                ))}
              </View>
              <Text style={styles.heroSwipeHint}>Kaydır</Text>
            </View>
          </>
        ) : (
          <View style={styles.heroEmpty}>
            <Sparkles size={24} color={c.accent} />
            <Text style={styles.heroEmptyTitle}>Sana uygun yeni seçimler hazırlıyoruz</Text>
            <Text style={styles.heroEmptyText}>Filtreleri temizleyip tekrar deneyebilirsin.</Text>
          </View>
        )}

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.quickRow}>
          <QuickChip icon={Timer} label="Kısa bir şey" active={shortOnly} onPress={() => setShortOnly((v) => !v)} c={c} />
          <QuickChip icon={Film} label="Film" active={typeFilter === "Film"} onPress={() => setTypeFilter((v) => v === "Film" ? "Hepsi" : "Film")} c={c} />
          <QuickChip icon={Tv} label="Dizi" active={typeFilter === "Dizi"} onPress={() => setTypeFilter((v) => v === "Dizi" ? "Hepsi" : "Dizi")} c={c} />
          <QuickChip icon={Users} label="Arkadaşlarla" onPress={() => navigation.navigate("GroupParty")} c={c} />
          <QuickChip icon={Shuffle} label="Sürpriz" onPress={surpriseMe} c={c} />
        </ScrollView>

        {Number(diaryStats?.tasteCandidatesUnrated || 0) >= 5 && (
          <TouchableOpacity style={styles.ratingNudgeCard} activeOpacity={0.86} onPress={() => navigation.navigate("RateTaste")}>
            <View style={styles.ratingNudgeIcon}><Star size={17} color="#FFD76A" fill="rgba(255,215,106,0.16)" /></View>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={styles.ratingNudgeEyebrow}>ZEVK PROFİLİNİ DERİNLEŞTİR</Text>
              <Text style={styles.ratingNudgeTitle}>İzlediklerini puanlamak ister misin?</Text>
              <Text style={styles.ratingNudgeText}>{diaryStats.tasteCandidatesUnrated} zevk sinyalinden izlediklerini seç; puan vermek opsiyonel.</Text>
            </View>
            <ChevronRight size={17} color={c.dim} />
          </TouchableOpacity>
        )}

        <View style={styles.todayHeaderRow}>
          <View>
            <Text style={styles.sectionEyebrow}>BUGÜN PELLIX'TE</Text>
            <Text style={styles.sectionTitle}>Kısa bir şey yap, geri dönmek için sebebin olsun</Text>
          </View>
        </View>

        <View style={styles.todayRow}>
          <TouchableOpacity style={styles.todayCard} activeOpacity={0.86} onPress={() => navigation.navigate("DailyPosterPuzzle")}>
            <View style={[styles.todayIcon, { backgroundColor: "rgba(124,58,237,0.16)" }]}>
              <Puzzle size={18} color="#8B5CF6" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.todayKicker}>GÜNÜN OYUNU</Text>
              <Text style={styles.todayTitle}>Poster Puzzle</Text>
              <Text style={styles.todaySub}>1 dakikalık günlük tahmin</Text>
            </View>
            <ChevronRight size={16} color={c.dim} />
          </TouchableOpacity>

          <TouchableOpacity style={styles.todayCard} activeOpacity={0.86} onPress={() => navigation.navigate("WeeklyQuests")}>
            <View style={[styles.todayIcon, { backgroundColor: "rgba(201,164,76,0.16)" }]}>
              <Trophy size={18} color={c.accent} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.todayKicker}>HAFTALIK HEDEF</Text>
              <Text style={styles.todayTitle}>{q.total ? `${q.complete}/${q.total} tamamlandı` : "Görevlerini gör"}</Text>
              <View style={styles.questTrack}>
                <View style={[styles.questFill, { width: `${q.percent}%` }]} />
              </View>
            </View>
            <ChevronRight size={16} color={c.dim} />
          </TouchableOpacity>
        </View>


        <View style={styles.popularNowSection}>
          <PopularNowRow items={popularNow} onPress={(movie) => navigation.navigate("Detail", { movie })} />
        </View>

        <View style={styles.gridSectionHeader}>
          <View>
            <Text style={styles.sectionEyebrow}>{describeResults ? "AI SEÇİMLERİN" : "SANA ÖZEL"}</Text>
            <Text style={styles.gridSectionTitle}>{describeResults ? "İstediğine en yakın sonuçlar" : "Zevkine göre devam et"}</Text>
          </View>
          {anyFilterActive && (
            <TouchableOpacity onPress={clearFilters}>
              <Text style={styles.clearFiltersText}>Filtreleri temizle</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    </View>
  );

  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      <TopBar centerLabel="Ana Sayfa" />

      <View style={styles.tabsRow}>
        <TouchableOpacity style={[styles.tabBtn, activeTab === "forYou" && styles.tabBtnActive]} onPress={() => setActiveTab("forYou")}>
          <Sparkles size={14} color={activeTab === "forYou" ? c.accent : c.dim} />
          <Text style={[styles.tabText, activeTab === "forYou" && styles.tabTextActive]}>Sana Özel</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.tabBtn, activeTab === "upcoming" && styles.tabBtnActive]} onPress={() => setActiveTab("upcoming")}>
          <Clock size={14} color={activeTab === "upcoming" ? c.accent : c.dim} />
          <Text style={[styles.tabText, activeTab === "upcoming" && styles.tabTextActive]}>Yakında</Text>
        </TouchableOpacity>
      </View>

      {activeTab === "forYou" ? (
        <FlatList
          ref={mainListRef}
          data={gridList}
          key="home-for-you-v2"
          keyExtractor={(item) => String(item.id)}
          numColumns={2}
          columnWrapperStyle={styles.gridRow}
          contentContainerStyle={styles.listContent}
          keyboardShouldPersistTaps="handled"
          nestedScrollEnabled
          ListHeaderComponent={forYouHeader}
          renderItem={renderCompactCard}
          onEndReachedThreshold={0.45}
          onEndReached={describeResults ? () => setDescribeCount((v) => v + 8) : handleLoadMore}
          ListFooterComponent={loadingMore ? <ActivityIndicator color={c.accent} style={{ marginVertical: 18 }} /> : null}
          refreshing={refreshing}
          onRefresh={describeResults ? undefined : handleRefresh}
          ListEmptyComponent={
            <EmptyState
              icon={Sparkles}
              title="Bu filtrelerle seçim kalmadı"
              text="Filtreleri temizleyip sana özel akışı yeniden açabilirsin."
            />
          }
        />
      ) : (
        <FlatList
          ref={upcomingListRef}
          data={spotlight.upcoming}
          key="home-upcoming-v2"
          keyExtractor={(item) => String(item.id)}
          contentContainerStyle={styles.upcomingContent}
          renderItem={renderUpcomingCard}
          ListHeaderComponent={
            <View style={styles.upcomingHeader}>
              <Text style={styles.sectionEyebrow}>RADARINDA OLSUN</Text>
              <Text style={styles.upcomingTitle}>Yakında gelecekler</Text>
              <Text style={styles.upcomingSub}>İlgini çeken içerikte zili aç; çıktığında Pellix sana haber versin.</Text>
            </View>
          }
          ListEmptyComponent={
            <EmptyState
              icon={Clock}
              title="Yakında çıkacak bir şey görünmüyor"
              text="Yeni duyurular geldiğinde burada görünecek."
            />
          }
        />
      )}

      <IslandModal
        visible={showFilters}
        onClose={() => setShowFilters(false)}
        title="Akışını Daralt"
        icon={Filter}
        gradientColors={["#7C3AED", "#4F46E5", "#2563EB"]}
        subtitle="Ne izleyeceğini daha hızlı bul"
      >
        <FilterFields
          typeValue={typeFilter}
          onTypeChange={setTypeFilter}
          genreValue={genreFilter}
          onGenreChange={setGenreFilter}
          yearSet={yearFilters}
          onToggleYear={toggleYear}
          platformSet={platformFilters}
          onTogglePlatform={togglePlatform}
          platforms={availablePlatformObjs}
          onShuffleGenre={() => setGenreFilter(GENRE_FILTERS[Math.floor(Math.random() * GENRE_FILTERS.length)])}
          anyActive={anyFilterActive}
          onClear={clearFilters}
        />
        <TouchableOpacity style={[styles.shortFilterRow, shortOnly && styles.shortFilterRowActive]} onPress={() => setShortOnly((v) => !v)}>
          <Timer size={16} color={shortOnly ? c.bg : c.text} />
          <View style={{ flex: 1 }}>
            <Text style={[styles.shortFilterTitle, shortOnly && { color: c.bg }]}>Kısa bir şey göster</Text>
            <Text style={[styles.shortFilterSub, shortOnly && { color: "rgba(20,18,26,0.72)" }]}>105 dakika ve altındaki içerikler</Text>
          </View>
        </TouchableOpacity>
      </IslandModal>

      <RecommendationWhyModal
        visible={showHeroReasons}
        movie={heroMovie}
        reasons={heroReasons}
        onClose={() => setShowHeroReasons(false)}
        onOpenDetail={() => {
          setShowHeroReasons(false);
          if (heroMovie) navigation.navigate("Detail", { movie: heroMovie });
        }}
      />
      {sendMovie && <SendToFriendModal movie={sendMovie} onClose={() => setSendMovie(null)} />}
      {pickerMovie && <ListPickerModal movie={pickerMovie} onClose={() => setPickerMovie(null)} />}
    </View>
  );
}

function TonightHero({ movie, reason, liked, onLike, onWhy, onPress, width, c }) {
  const styles = makeStyles(c);
  const platform = (movie.platforms || [])[0];
  return (
    <TouchableOpacity style={[styles.heroCard, width ? { width } : null]} activeOpacity={0.94} onPress={onPress}>
      {movie.poster ? (
        <Image source={{ uri: movie.poster }} style={StyleSheet.absoluteFillObject} resizeMode="cover" blurRadius={10} />
      ) : (
        <View style={[StyleSheet.absoluteFillObject, { backgroundColor: c.surface2 }]} />
      )}
      <LinearGradient
        colors={["rgba(8,7,12,0.28)", "rgba(8,7,12,0.72)", "rgba(8,7,12,0.96)"]}
        locations={[0, 0.5, 1]}
        style={StyleSheet.absoluteFillObject}
      />

      <View style={styles.heroInner}>
        {movie.poster ? <Image source={{ uri: movie.poster }} style={styles.heroPoster} /> : <View style={[styles.heroPoster, { backgroundColor: c.surface2 }]} />}
        <View style={styles.heroCopy}>
          <View style={styles.heroEyebrowRow}>
            <Sparkles size={11} color="#FFD76A" />
            <Text style={styles.heroEyebrow}>BU AKŞAM SENİN İÇİN</Text>
          </View>
          <Text style={styles.heroTitle} numberOfLines={2}>{movie.title}</Text>
          <View style={styles.heroMetaRow}>
            <Star size={11} color="#FFD76A" fill="#FFD76A" />
            <Text style={styles.heroMeta}>{movie.imdb || "—"}</Text>
            <Text style={styles.heroMeta}>· {movie.year || ""}</Text>
            {!!movie.runtime && <Text style={styles.heroMeta}>· {movie.runtime}</Text>}
          </View>
          {!!reason && (
            <View style={styles.reasonPill}>
              <Text style={styles.reasonPillText} numberOfLines={2}>{reason}</Text>
            </View>
          )}
          {!!platform && (
            <View style={styles.heroPlatformRow}>
              {!!platformLogo(platform) && <Image source={{ uri: platformLogo(platform) }} style={styles.heroPlatformLogo} />}
              <Text style={styles.heroPlatformText}>{platformName(platform)}</Text>
            </View>
          )}
        </View>
      </View>

      <View style={styles.heroActions}>
        <TouchableOpacity style={styles.heroPrimaryBtn} onPress={(e) => { e.stopPropagation?.(); onWhy?.(); }}>
          <Text style={styles.heroPrimaryText}>Neden buna bakmalısın?</Text>
          <ChevronRight size={15} color="#14121a" />
        </TouchableOpacity>
        <TouchableOpacity style={[styles.heroLikeBtn, liked && styles.heroLikeBtnActive]} onPress={(e) => { e.stopPropagation?.(); onLike(); }}>
          <Heart size={17} color="#fff" fill={liked ? "#fff" : "none"} />
        </TouchableOpacity>
      </View>
    </TouchableOpacity>
  );
}

function QuickChip({ icon: Icon, label, active, onPress, c }) {
  return (
    <TouchableOpacity
      style={[
        quickStyles.chip,
        { backgroundColor: active ? c.accent : c.surface, borderColor: active ? c.accent : c.border },
      ]}
      onPress={onPress}
      activeOpacity={0.82}
    >
      <Icon size={13} color={active ? c.bg : c.text} />
      <Text style={[quickStyles.text, { color: active ? c.bg : c.text }]}>{label}</Text>
    </TouchableOpacity>
  );
}

const quickStyles = StyleSheet.create({
  chip: { flexDirection: "row", alignItems: "center", gap: 6, borderRadius: 999, borderWidth: 1, paddingHorizontal: 12, paddingVertical: 8 },
  text: { fontSize: 11.5, fontWeight: "700" },
});

function makeStyles(c) {
  return StyleSheet.create({
    tabsRow: { flexDirection: "row", paddingHorizontal: 16, paddingTop: 10, paddingBottom: 4, gap: 8, backgroundColor: c.bg },
    tabBtn: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, borderRadius: 12, paddingVertical: 9, backgroundColor: c.surface, borderWidth: 1, borderColor: c.border },
    tabBtnActive: { borderColor: c.accent, backgroundColor: c.surface2 },
    tabText: { color: c.dim, fontSize: 12, fontWeight: "700" },
    tabTextActive: { color: c.text },

    listContent: { paddingHorizontal: 16, paddingBottom: 24 },
    gridRow: { gap: 12 },
    heroArea: { paddingTop: 10 },
    heroPagerRow: { minHeight: 28, flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 4, paddingTop: 8 },
    heroPagerCount: { width: 34, color: c.dim, fontSize: 10, fontWeight: "800" },
    heroDotsRow: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 5 },
    heroDot: { width: 5, height: 5, borderRadius: 999, backgroundColor: c.border },
    heroDotActive: { width: 16, backgroundColor: c.accent },
    heroSwipeHint: { width: 34, color: c.dim, fontSize: 9.5, fontWeight: "700", textAlign: "right" },
    heroCard: { borderRadius: 24, overflow: "hidden", minHeight: 286, borderWidth: 1, borderColor: "rgba(255,255,255,0.10)", backgroundColor: c.surface },
    heroInner: { flexDirection: "row", alignItems: "flex-end", gap: 14, padding: 16, paddingTop: 24, minHeight: 220 },
    heroPoster: { width: 98, height: 148, borderRadius: 14, backgroundColor: c.surface2, borderWidth: 1, borderColor: "rgba(255,255,255,0.13)" },
    heroCopy: { flex: 1, minWidth: 0 },
    heroEyebrowRow: { flexDirection: "row", alignItems: "center", gap: 5 },
    heroEyebrow: { color: "#FFD76A", fontSize: 9.5, fontWeight: "900", letterSpacing: 0.9 },
    heroTitle: { color: "#fff", fontSize: 24, fontWeight: "900", lineHeight: 27, marginTop: 6 },
    heroMetaRow: { flexDirection: "row", alignItems: "center", flexWrap: "wrap", gap: 4, marginTop: 7 },
    heroMeta: { color: "rgba(255,255,255,0.76)", fontSize: 10.5, fontWeight: "700" },
    reasonPill: { alignSelf: "flex-start", marginTop: 9, backgroundColor: "rgba(124,58,237,0.24)", borderWidth: 1, borderColor: "rgba(167,139,250,0.28)", borderRadius: 10, paddingHorizontal: 9, paddingVertical: 6 },
    reasonPillText: { color: "#E9DDFF", fontSize: 10.5, lineHeight: 14, fontWeight: "700" },
    heroPlatformRow: { flexDirection: "row", alignItems: "center", gap: 5, marginTop: 9 },
    heroPlatformLogo: { width: 17, height: 17, borderRadius: 4, backgroundColor: "#fff" },
    heroPlatformText: { color: "rgba(255,255,255,0.76)", fontSize: 10.5, fontWeight: "700" },
    heroActions: { flexDirection: "row", gap: 8, paddingHorizontal: 16, paddingBottom: 16 },
    heroPrimaryBtn: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, minHeight: 42, borderRadius: 13, backgroundColor: "#FFD76A" },
    heroPrimaryText: { color: "#14121a", fontSize: 11.5, fontWeight: "900" },
    heroLikeBtn: { width: 44, height: 42, borderRadius: 13, backgroundColor: "rgba(255,255,255,0.14)", borderWidth: 1, borderColor: "rgba(255,255,255,0.18)", alignItems: "center", justifyContent: "center" },
    heroLikeBtnActive: { backgroundColor: "#5fb3a3", borderColor: "#5fb3a3" },
    heroEmpty: { borderRadius: 20, borderWidth: 1, borderColor: c.border, backgroundColor: c.surface, padding: 24, alignItems: "center" },
    heroEmptyTitle: { color: c.text, fontSize: 15, fontWeight: "800", textAlign: "center", marginTop: 10 },
    heroEmptyText: { color: c.dim, fontSize: 11.5, textAlign: "center", marginTop: 5 },

    quickRow: { gap: 8, paddingTop: 12, paddingBottom: 2 },
    ratingNudgeCard: { marginTop: 14, flexDirection: "row", alignItems: "center", gap: 10, borderRadius: 16, borderWidth: 1, borderColor: "rgba(255,215,106,0.22)", backgroundColor: "rgba(255,215,106,0.07)", padding: 12 },
    ratingNudgeIcon: { width: 38, height: 38, borderRadius: 12, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(255,215,106,0.10)" },
    ratingNudgeEyebrow: { color: "#FFD76A", fontSize: 8.5, fontWeight: "900", letterSpacing: 0.65 },
    ratingNudgeTitle: { color: c.text, fontSize: 12.5, fontWeight: "850", marginTop: 2 },
    ratingNudgeText: { color: c.dim, fontSize: 10, lineHeight: 14, marginTop: 2 },
    todayHeaderRow: { marginTop: 22, marginBottom: 10 },
    sectionEyebrow: { color: c.accent, fontSize: 9.5, fontWeight: "900", letterSpacing: 0.9 },
    sectionTitle: { color: c.text, fontSize: 14, fontWeight: "800", marginTop: 3 },
    todayRow: { gap: 8 },
    popularNowSection: { marginTop: 22 },
    todayCard: { minHeight: 72, flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: c.surface, borderWidth: 1, borderColor: c.border, borderRadius: 16, paddingHorizontal: 12, paddingVertical: 11 },
    todayIcon: { width: 38, height: 38, borderRadius: 12, alignItems: "center", justifyContent: "center" },
    todayKicker: { color: c.dim, fontSize: 8.5, fontWeight: "900", letterSpacing: 0.7 },
    todayTitle: { color: c.text, fontSize: 12.5, fontWeight: "800", marginTop: 2 },
    todaySub: { color: c.dim, fontSize: 10, marginTop: 2 },
    questTrack: { height: 4, borderRadius: 999, backgroundColor: c.surface2, marginTop: 6, overflow: "hidden" },
    questFill: { height: 4, borderRadius: 999, backgroundColor: c.accent },

    searchBlock: { marginTop: 14, marginBottom: 10 },
    searchRow: { flexDirection: "row", gap: 8 },
    searchBox: { flex: 1, flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: c.surface, borderWidth: 1, borderColor: c.border, borderRadius: 13, paddingHorizontal: 12 },
    searchBoxFocused: { borderColor: c.accent },
    searchInput: { flex: 1, color: c.text, fontSize: 13, paddingVertical: 11 },
    filterBtn: { width: 44, borderRadius: 13, backgroundColor: c.surface, borderWidth: 1, borderColor: c.border, alignItems: "center", justifyContent: "center" },
    filterBtnActive: { backgroundColor: c.accent, borderColor: c.accent },
    filterDot: { position: "absolute", top: 5, right: 5, width: 6, height: 6, borderRadius: 999, backgroundColor: c.accent2 },
    searchResultsCard: { marginTop: 8, backgroundColor: c.surface, borderWidth: 1, borderColor: c.border, borderRadius: 16, overflow: "hidden" },
    searchResultRow: { flexDirection: "row", alignItems: "center", gap: 10, padding: 9, borderBottomWidth: 1, borderBottomColor: c.border },
    searchThumb: { width: 34, height: 49, borderRadius: 7 },
    searchPersonThumb: { width: 40, height: 40, borderRadius: 999 },
    searchResultTitle: { color: c.text, fontSize: 12.5, fontWeight: "800" },
    searchResultMeta: { color: c.dim, fontSize: 10.5, marginTop: 2 },
    searchRating: { flexDirection: "row", alignItems: "center", gap: 3 },
    searchRatingText: { color: c.text, fontSize: 10.5, fontWeight: "800" },
    searchEmpty: { color: c.dim, fontSize: 11.5, textAlign: "center", padding: 18 },
    aiResultBanner: { marginTop: 8, flexDirection: "row", alignItems: "center", gap: 7, backgroundColor: "rgba(124,58,237,0.10)", borderWidth: 1, borderColor: "rgba(124,58,237,0.22)", borderRadius: 12, paddingHorizontal: 11, paddingVertical: 9 },
    aiResultText: { flex: 1, color: c.text, fontSize: 11.5, fontWeight: "700" },
    aiClear: { color: c.dim, fontSize: 10.5, fontWeight: "700" },

    gridSectionHeader: { flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between", gap: 10, marginTop: 22, marginBottom: 12 },
    gridSectionTitle: { color: c.text, fontSize: 17, fontWeight: "900", marginTop: 2 },
    clearFiltersText: { color: c.dim, fontSize: 10.5, fontWeight: "700" },

    upcomingContent: { paddingHorizontal: 16, paddingBottom: 24 },
    upcomingHeader: { paddingTop: 14, paddingBottom: 14 },
    upcomingTitle: { color: c.text, fontSize: 22, fontWeight: "900", marginTop: 3 },
    upcomingSub: { color: c.dim, fontSize: 11.5, lineHeight: 17, marginTop: 4 },

    shortFilterRow: { marginTop: 12, flexDirection: "row", alignItems: "center", gap: 10, borderRadius: 14, borderWidth: 1, borderColor: c.border, backgroundColor: c.surface2, padding: 12 },
    shortFilterRowActive: { backgroundColor: c.accent, borderColor: c.accent },
    shortFilterTitle: { color: c.text, fontSize: 12, fontWeight: "800" },
    shortFilterSub: { color: c.dim, fontSize: 10.5, marginTop: 2 },
  });
}
