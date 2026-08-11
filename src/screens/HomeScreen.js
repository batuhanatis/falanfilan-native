import React, { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { View, Text, Image, FlatList, StyleSheet, ActivityIndicator, TextInput, TouchableOpacity, ScrollView, Dimensions, Animated, Alert, Keyboard } from "react-native";
import { Search, Filter, Sparkles, Flame, Clock, X, Star } from "lucide-react-native";
import { useAppTheme } from "../context/ThemeContext";
import { useAuth } from "../context/AuthContext";
import { api } from "../api/client";
import { GENRE_FILTERS } from "../theme/theme";
import MovieCard from "../components/MovieCard";
import ChipRow from "../components/ChipRow";
import PlatformChipRow from "../components/PlatformChipRow";
import PopularNowRow from "../components/PopularNowRow";
import { platformName, platformLogo } from "../utils/platform";
import { recommendationReason } from "../utils/recommend";
import TopBar from "../components/TopBar";
import SendToFriendModal from "../components/SendToFriendModal";
import ListPickerModal from "../components/ListPickerModal";
import AIZone from "../components/AIZone";

const { width: SCREEN_W } = Dimensions.get("window");
const FEED_TABS = [
  { icon: Sparkles, label: "Sana Özel" },
  { icon: Flame, label: "Şu An Gösterimde" }, // NOT: eskiden "Yeni Çıkanlar" — ama TMDB'nin
  // now_playing/on_the_air listeleri gerçekten "yeni çıkan" değil, hâlâ vizyonda/yayında olan
  // (bazen yıllar önce çıkmış) içerikleri de kapsıyor. İsim, gerçekte gösterdiği şeyle uyuşsun diye düzeltildi.
  { icon: Clock, label: "Yakında Gelecekler" },
];

export default function HomeScreen({ navigation }) {
  const { c } = useAppTheme();
  const { auth } = useAuth();
  const styles = makeStyles(c);
  const pagerRef = useRef(null);
  const mainListRef = useRef(null);
  const newReleasesListRef = useRef(null);
  const upcomingListRef = useRef(null);

  const [movies, setMovies] = useState([]);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [liked, setLiked] = useState(new Set());
  const [disliked, setDisliked] = useState(new Set());
  const [watchlist, setWatchlist] = useState(new Set());

  const [query, setQuery] = useState("");
  const [searchResults, setSearchResults] = useState(null); // null = arama aktif değil
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchFocused, setSearchFocused] = useState(false);

  const [showFilters, setShowFilters] = useState(false);
  const [typeFilter, setTypeFilter] = useState("Hepsi");
  const [genreFilter, setGenreFilter] = useState(null);
  const [platformFilters, setPlatformFilters] = useState(new Set());

  // "Şu An Popüler" şeridi — kişiselleştirilmiş akıştan TAMAMEN bağımsız, sadece TÜR filtresine
  // göre değişiyor (kategori/platform filtrelerinden etkilenmiyor, kasıtlı olarak). ÖNEMLİ:
  // eskiden /api/movies?sort=popular kullanıyorduk — bu, kendi kataloğumuzdaki TÜM ZAMANLARIN
  // en çok oy alan içeriklerini gösteriyordu (eski kült klasikler öne çıkıyordu, "güncel popüler"
  // değil). api.trending, TMDB'nin GERÇEK haftalık trend verisini kullanıyor.
  const [popularNow, setPopularNow] = useState([]);
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        if (typeFilter === "Film") {
          const data = await api.trending(auth.token, "movie");
          if (!cancelled) setPopularNow((data.results || []).slice(0, 10));
        } else if (typeFilter === "Dizi") {
          const data = await api.trending(auth.token, "tv");
          if (!cancelled) setPopularNow((data.results || []).slice(0, 10));
        } else {
          const [mRes, tRes] = await Promise.all([
            api.trending(auth.token, "movie").catch(() => ({ results: [] })),
            api.trending(auth.token, "tv").catch(() => ({ results: [] })),
          ]);
          const merged = dedupe([...(mRes.results || []), ...(tRes.results || [])])
            .sort((a, b) => (b.votes || 0) - (a.votes || 0));
          if (!cancelled) setPopularNow(merged.slice(0, 10));
        }
      } catch { if (!cancelled) setPopularNow([]); }
    })();
    return () => { cancelled = true; };
  }, [typeFilter, auth.token]);

  // "Yapay Zeka Köşesi" ARTIK ayrı, izole bir bileşen (AIZone.js) — sadece sonuçların besleme
  // akışını etkileyen kısmı burada kalıyor (panel aç/kapa gibi salt-görsel state artık orada,
  // açıp kapatmak Ana Sayfa'nın tamamını yeniden render etmiyor).
  const [describeResults, setDescribeResults] = useState(null);
  const [describeCount, setDescribeCount] = useState(8);
  const [aiResultsLabel, setAiResultsLabel] = useState("");

  function handleAiResults(results, label) {
    setDescribeResults(results);
    setAiResultsLabel(label);
    setDescribeCount(8);
  }
  function handleClearAiResults() {
    setDescribeResults(null);
    setAiResultsLabel("");
  }

  const [sendMovie, setSendMovie] = useState(null); // gönderilecek film
  const [pickerMovie, setPickerMovie] = useState(null); // liste seçici popup'ı için
  const [spotlight, setSpotlight] = useState({ upcoming: [], newReleases: [] });
  const [notifySubs, setNotifySubs] = useState(new Set());
  const [socialStats, setSocialStats] = useState({}); // movieId -> {likes, comments, watchlist, friendName}
  const statsFetchedRef = useRef(new Set());

  // Sana Özel / Şu An Gösterimde / Yakında Gelecekler — aynı alanda YATAY kaydırarak geçiliyor.
  const [activePage, setActivePage] = useState(0);
  function goToPage(i) {
    setActivePage(i);
    pagerRef.current?.scrollTo({ x: i * SCREEN_W, animated: true });
  }
  // AI sonucu geldiğinde otomatik olarak Önerilenler sayfasına dön — arama artık ayrı bir
  // dropdown olduğu için (bkz. headerContent) hangi sayfada olursan ol açılabiliyor, sayfa
  // değiştirmeye gerek yok.
  useEffect(() => {
    if (describeResults && activePage !== 0) goToPage(0);
  }, [describeResults]);


  // Ana Sayfa sekmesine, zaten o sekmedeyken tekrar basılırsa aktif listeyi en yukarı kaydır
  // (Instagram/Twitter'daki gibi tanıdık bir davranış).
  useEffect(() => {
    const unsub = navigation.addListener("tabPress", () => {
      if (!navigation.isFocused()) return;
      const refs = [mainListRef, newReleasesListRef, upcomingListRef];
      refs[activePage]?.current?.scrollToOffset?.({ offset: 0, animated: true });
    });
    return unsub;
  }, [navigation, activePage]);

  const loadInteractions = useCallback(async () => {
    try {
      const data = await api.interactions(auth.token);
      const l = new Set(), d = new Set(), w = new Set();
      (data.results || []).forEach((row) => {
        if (row.action === "like") l.add(row.movie_id);
        else if (row.action === "dislike") d.add(row.movie_id);
        else if (row.action === "watchlist") w.add(row.movie_id);
      });
      setLiked(l); setDisliked(d); setWatchlist(w);
    } catch { /* sessizce geç */ }
  }, [auth.token]);

  const loadPage = useCallback(async (pageNum) => {
    const [movieRes, tvRes] = await Promise.all([
      api.movies(auth.token, "movie", pageNum).catch(() => ({ results: [] })),
      api.movies(auth.token, "tv", pageNum).catch(() => ({ results: [] })),
    ]);
    return [...(movieRes.results || []), ...(tvRes.results || [])];
  }, [auth.token]);

  // Kullanıcı mevcut partiyi (sayfayı) bitirmeden BİR SONRAKİNİ arka planda önceden yüklemeye
  // başlıyoruz — böylece kaydırıp sona geldiğinde çoğu zaman veri zaten hazır bekliyor, yeni
  // bir istek başlatıp beklemek yerine anında gösterebiliyoruz.
  const prefetchedPageRef = useRef(null); // { page, promise }
  const prefetchNextPage = useCallback((afterPage) => {
    const nextPage = afterPage + 1;
    prefetchedPageRef.current = { page: nextPage, promise: loadPage(nextPage) };
  }, [loadPage]);

  useEffect(() => {
    (async () => {
      setLoading(true);
      await loadInteractions();
      const items = await loadPage(1);
      setMovies(dedupe(items));
      setLoading(false);
      prefetchNextPage(1);
    })();
    api.spotlight(auth.token).then((data) => setSpotlight({ upcoming: data.upcoming || [], newReleases: data.newReleases || [] })).catch(() => {});
    api.notifySubscriptions(auth.token).then((data) => setNotifySubs(new Set(data.movieIds || []))).catch(() => {});
  }, []);

  // Film/dizi arama — 250ms bekleyip backend'e sorar (artık backend önce kendi kataloğunu
  // ANINDA sorguladığı için — bkz. /api/search — daha kısa bir debounce da makul, sonuç
  // neredeyse hep tek bir hızlı yerel sorguyla geliyor).
  useEffect(() => {
    if (!query.trim()) { setSearchResults(null); return; }
    setSearchLoading(true);
    const timer = setTimeout(() => {
      Promise.all([
        api.search(auth.token, query, "movie").catch(() => ({ results: [] })),
        api.search(auth.token, query, "tv").catch(() => ({ results: [] })),
      ])
        .then(([mRes, tRes]) => {
          const merged = dedupe([...(mRes.results || []), ...(tRes.results || [])])
            .sort((a, b) => (b.votes || 0) - (a.votes || 0));
          setSearchResults(merged);
        })
        .finally(() => setSearchLoading(false));
    }, 250);
    return () => clearTimeout(timer);
  }, [query]);

  async function handleLoadMore() {
    if (loadingMore || describeResults) return;
    setLoadingMore(true);
    const nextPage = page + 1;
    // Bu sayfa daha önceden (kullanıcı hâlâ öncekini kaydırırken) arka planda başlatılmışsa,
    // burada yeni bir istek atmadan sadece o sonucu bekliyoruz — çoğu zaman zaten hazırdır.
    const prefetched = prefetchedPageRef.current;
    const items = (prefetched && prefetched.page === nextPage) ? await prefetched.promise : await loadPage(nextPage);
    setMovies((prev) => dedupe([...prev, ...items]));
    setPage(nextPage);
    setLoadingMore(false);
    prefetchNextPage(nextPage); // ...ve bir sonraki partiyi de şimdiden hazırlamaya başla
  }

  // Kullanıcı Önerilenler sayfasının en üstündeyken aşağı doğru daha fazla çekince (pull-to-
  // refresh) — listeyi baştan, güncel/yeniden sıralanmış haliyle getiriyor.
  async function handleRefresh() {
    setRefreshing(true);
    try {
      await loadInteractions();
      const items = await loadPage(1);
      setMovies(dedupe(items));
      setPage(1);
      prefetchNextPage(1);
    } catch { /* sessizce geç */ }
    setRefreshing(false);
  }

  function toggle(setFn, otherSetFn, id) {
    setFn((prev) => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
    otherSetFn((prev) => { const n = new Set(prev); n.delete(id); return n; });
  }
  function like(id) {
    const wasLiked = liked.has(id);
    toggle(setLiked, setDisliked, id);
    if (wasLiked) api.removeInteraction(auth.token, id, "like").catch(() => {});
    else api.recordInteraction(auth.token, id, "like").catch(() => {});
  }
  function dislike(id) {
    const wasDisliked = disliked.has(id);
    toggle(setDisliked, setLiked, id);
    if (wasDisliked) api.removeInteraction(auth.token, id, "dislike").catch(() => {});
    else api.recordInteraction(auth.token, id, "dislike").catch(() => {});
  }
  function watch(id) {
    const wasInWatchlist = watchlist.has(id);
    setWatchlist((prev) => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
    if (wasInWatchlist) api.removeInteraction(auth.token, id, "watchlist").catch(() => {});
    else api.recordInteraction(auth.token, id, "watchlist").catch(() => {});
  }

  const availablePlatformObjs = useMemo(() => {
    const byName = new Map();
    movies.forEach((m) => (m.platforms || []).forEach((p) => {
      const n = platformName(p);
      if (!n) return;
      const existing = byName.get(n);
      if (!existing || (!platformLogo(existing) && platformLogo(p))) byName.set(n, p);
    }));
    return [...byName.values()];
  }, [movies]);

  // ÖNEMLİ: Arama artık ana listeyi DEĞİŞTİRMİYOR — sadece arama kutusunun altında ayrı bir
  // dropdown olarak gösteriliyor (bkz. headerContent). Kişiselleştirilmiş öneriler alanı, arama
  // yazılırken/aktifken bile aynı kalıyor.
  const filteredList = useMemo(() => {
    let list = movies;
    if (typeFilter !== "Hepsi") list = list.filter((m) => m.type === typeFilter);
    // ÖNEMLİ: "genre" (tekil) sadece bir filmin İLK türünü tutuyor — Bilim Kurgu gibi ikincil
    // bir tür seçildiğinde, o türde olup da başka bir tür birincil olarak kaydedilmiş filmler
    // yanlışlıkla dışarıda kalıyordu. "genres" (çoğul, TÜM türleri içeren dizi) kullanıyoruz.
    if (genreFilter) list = list.filter((m) => (Array.isArray(m.genres) && m.genres.length > 0 ? m.genres.includes(genreFilter) : m.genre === genreFilter));
    if (platformFilters.size > 0) list = list.filter((m) => (m.platforms || []).some((p) => platformFilters.has(platformName(p))));
    return list;
  }, [movies, typeFilter, genreFilter, platformFilters]);

  const anyFilterActive = typeFilter !== "Hepsi" || !!genreFilter || platformFilters.size > 0;
  function clearFilters() { setTypeFilter("Hepsi"); setGenreFilter(null); setPlatformFilters(new Set()); }
  function togglePlatform(name) {
    setPlatformFilters((prev) => { const n = new Set(prev); n.has(name) ? n.delete(name) : n.add(name); return n; });
  }

  const list = describeResults ? describeResults.slice(0, describeCount) : filteredList;

  // Ekranda görünen filmlerin beğeni/yorum/liste sayılarını toplu çekiyoruz — her kart için
  // ayrı istek atmak yerine, henüz bilinmeyen ID'leri tek seferde topluyoruz.
  const fetchStatsFor = useCallback(async (movieIds) => {
    const newIds = movieIds.filter((id) => !statsFetchedRef.current.has(id));
    if (newIds.length === 0) return;
    newIds.forEach((id) => statsFetchedRef.current.add(id));
    try {
      const data = await api.socialStats(auth.token, newIds);
      setSocialStats((prev) => ({ ...prev, ...data.results }));
    } catch { /* sessizce geç */ }
  }, [auth.token]);

  useEffect(() => {
    const ids = list.map((m) => m.id);
    if (ids.length > 0) fetchStatsFor(ids);
  }, [list, fetchStatsFor]);

  useEffect(() => {
    const ids = [...spotlight.newReleases, ...spotlight.upcoming].map((m) => m.id);
    if (ids.length > 0) fetchStatsFor(ids);
  }, [spotlight, fetchStatsFor]);

  // Ana Sayfa'nın kişiselleştirilmiş 2 sütunlu ızgarası için — sadece poster + beğen butonu.
  // Beğenmeme/listeye ekleme/gönderme/yorum gibi diğer aksiyonlar artık sadece Detay sayfasında.
  function renderCompactCard({ item, index }) {
    return (
      <MovieCard
        movie={item}
        liked={liked.has(item.id)}
        onLike={like}
        onPress={(m) => navigation.navigate("Detail", { movie: m })}
        reason={!describeResults && index < 8 ? recommendationReason(item, liked, movies) : null}
        compact
      />
    );
  }

  function renderMovieCard({ item, index }) {
    return (
      <MovieCard
        movie={item}
        liked={liked.has(item.id)}
        disliked={disliked.has(item.id)}
        watchlisted={watchlist.has(item.id)}
        onLike={like}
        onDislike={dislike}
        onAddToList={setPickerMovie}
        onSend={setSendMovie}
        onPress={(m) => navigation.navigate("Detail", { movie: m })}
        reason={!describeResults && index < 8 ? recommendationReason(item, liked, movies) : null}
        stats={socialStats[item.id]}
      />
    );
  }

  // Bir içerik için "Beni Bilgilendir" aboneliğini açar/kapatır — sunucuya gitmeden önce
  // arayüzü hemen güncelliyoruz (optimistic update), sorun çıkarsa geri alıyoruz.
  async function toggleNotify(movieId) {
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
  }

  // "Yakında Çıkacaklar" sayfasına özel — diğer kartlardan farklı olarak bir zil/bildirim
  // butonu gösteriyor, henüz yayınlanmamış içerikler için beğeni/beğenmeme anlamsız olduğundan.
  function renderUpcomingCard({ item, index }) {
    return (
      <MovieCard
        movie={item}
        liked={liked.has(item.id)}
        disliked={disliked.has(item.id)}
        watchlisted={watchlist.has(item.id)}
        onLike={like}
        onDislike={dislike}
        onAddToList={setPickerMovie}
        onSend={setSendMovie}
        onPress={(m) => navigation.navigate("Detail", { movie: m })}
        stats={socialStats[item.id]}
        showNotify
        notifySubscribed={notifySubs.has(item.id)}
        onNotify={toggleNotify}
      />
    );
  }

  function selectSearchResult(m) {
    setQuery("");
    setSearchFocused(false);
    Keyboard.dismiss();
    navigation.navigate("Detail", { movie: m });
  }

  // ÖNEMLİ (dropdown'un dokunulamaması/kaydırılamaması düzeltmesi): Bu, eskiden arama kutusuyla
  // birlikte FlatList'in ListHeaderComponent'i İÇİNDE, "position: absolute" ile render ediliyordu.
  // Bu iç içe (FlatList içinde kaydırılabilir bir ScrollView) yapı, dokunma/kaydırma jestlerinin
  // hangi bileşene ait olduğu konusunda React Native'in jest çözümleyicisini karıştırıyordu —
  // dropdown'daki satırlara dokunmak Detay'a gitmiyordu, listenin kendisi de kaydırılamıyordu.
  // Çözüm: arama kutusu + dropdown'ı TAMAMEN dışarı, sayfalar arası kaydırılan pager'ın ÜSTÜNE,
  // sabit (kaydırılmayan) bir satıra taşıdık — artık FlatList'in hiç İÇİNDE değil, onun bir
  // KARDEŞİ. Aynı zamanda arama artık hangi sekmede olursan ol her zaman görünür/erişilebilir.
  const dropdownOpen = searchFocused && query.trim().length > 0;
  const dropdownResults = (searchResults || []).slice(0, 8);

  const headerContent = (
    <View style={{ paddingHorizontal: 16, paddingTop: 14, paddingBottom: 6 }}>
      {showFilters && (
        <View style={styles.filterPanel}>
          <View style={styles.filterHeaderRow}>
            <Text style={styles.filterTitle}>Filtrele</Text>
            {anyFilterActive && (
              <TouchableOpacity onPress={clearFilters}><Text style={styles.clearText}>Temizle</Text></TouchableOpacity>
            )}
          </View>

          <Text style={styles.filterLabel}>TÜR</Text>
          <ChipRow items={["Film", "Dizi"]} active={typeFilter === "Hepsi" ? null : typeFilter}
            onSelect={(v) => setTypeFilter(v === typeFilter ? "Hepsi" : v)} />

          <Text style={styles.filterLabel}>KATEGORİ</Text>
          <ChipRow items={GENRE_FILTERS} active={genreFilter}
            onSelect={(v) => setGenreFilter(v === genreFilter ? null : v)} />

          {availablePlatformObjs.length > 0 && (
            <>
              <Text style={styles.filterLabel}>PLATFORM</Text>
              <PlatformChipRow items={availablePlatformObjs} activeSet={platformFilters} onToggle={togglePlatform} />
            </>
          )}
        </View>
      )}

      {/* Yapay Zeka Köşesi — artık izole bir bileşen (AIZone.js), Ana Sayfa'nın geri kalanını
          yeniden render etmeden kendi içinde açılıp kapanıyor. */}
      <AIZone
        navigation={navigation}
        hasResults={!!describeResults}
        onResults={handleAiResults}
        onClear={handleClearAiResults}
      />

      {describeResults && !!aiResultsLabel && (
        <View style={styles.aiResultsBanner}>
          <Sparkles size={13} color={c.accent} />
          <Text style={styles.aiResultsBannerText} numberOfLines={1}>{aiResultsLabel}</Text>
          <TouchableOpacity onPress={handleClearAiResults}><Text style={styles.clearDescribeText}>Temizle</Text></TouchableOpacity>
        </View>
      )}
    </View>
  );

  if (loading) {
    return (
      <View style={{ flex: 1, backgroundColor: c.bg }}>
        <TopBar centerLabel={FEED_TABS[0].label} />
        <View style={styles.center}>
          <ActivityIndicator size="large" color={c.accent} />
          <Text style={{ color: c.dim, marginTop: 10, fontSize: 12 }}>İçerikler hazırlanıyor...</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      <TopBar centerLabel={FEED_TABS[activePage].label} />

      {/* Sana Özel / Şu An Gösterimde / Yakında Gelecekler sembolleri — tek ve sabit, kaydırılabilir
          alanın dışında, satırın tamamına eşit üçe bölünmüş (flex:1 her biri). */}
      <View style={styles.feedTabRow}>
        {FEED_TABS.map(({ icon: Icon, label }, i) => (
          <TouchableOpacity key={label} onPress={() => goToPage(i)} style={styles.feedTabBtn}>
            <Icon size={20} color={activePage === i ? c.accent : c.dim} />
            {activePage === i && <View style={styles.feedTabUnderline} />}
          </TouchableOpacity>
        ))}
      </View>

      {/* Arama kutusu + dropdown — artık sabit, hiçbir FlatList'in İÇİNDE değil (bkz. yukarıdaki
          not). "zIndex" bu bloğun altındaki pager'ın ÜSTÜNDE boyanmasını garanti ediyor. */}
      <View style={{ paddingHorizontal: 16, paddingTop: 10, paddingBottom: 10, zIndex: 30 }}>
        <View style={styles.searchRow}>
          <View style={[styles.searchBox, searchFocused && styles.searchBoxFocused]}>
            <Search size={16} color={searchFocused ? c.accent : c.dim} />
            <TextInput
              style={styles.searchInput}
              placeholder="Film veya dizi ara"
              placeholderTextColor={c.dim}
              value={query}
              onChangeText={setQuery}
              onFocus={() => setSearchFocused(true)}
              onBlur={() => setSearchFocused(false)}
            />
            {query.length > 0 && (
              <TouchableOpacity onPress={() => setQuery("")} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <X size={15} color={c.dim} />
              </TouchableOpacity>
            )}
          </View>
          <TouchableOpacity
            style={[styles.filterBtn, showFilters && { backgroundColor: c.accent }]}
            onPress={() => setShowFilters((v) => !v)}
          >
            <Filter size={16} color={showFilters ? c.bg : c.text} />
            {anyFilterActive && !showFilters && <View style={styles.filterDot} />}
          </TouchableOpacity>
        </View>

        {dropdownOpen && (
          <View style={styles.dropdown}>
            {searchLoading ? (
              <ActivityIndicator style={{ paddingVertical: 22 }} color={c.accent} />
            ) : dropdownResults.length === 0 ? (
              <Text style={styles.dropdownEmpty}>"{query}" için sonuç bulunamadı</Text>
            ) : (
              <ScrollView keyboardShouldPersistTaps="handled" style={{ maxHeight: 340 }}>
                {dropdownResults.map((m) => (
                  <TouchableOpacity key={m.id} style={styles.dropdownRow} onPress={() => selectSearchResult(m)} activeOpacity={0.7}>
                    {m.poster ? (
                      <Image source={{ uri: m.poster }} style={styles.dropdownPoster} />
                    ) : (
                      <View style={[styles.dropdownPoster, { backgroundColor: c.surface2 }]} />
                    )}
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <Text style={styles.dropdownTitle} numberOfLines={1}>{m.title}</Text>
                      <Text style={styles.dropdownMeta} numberOfLines={1}>{m.year} · {m.type}</Text>
                    </View>
                    <View style={styles.dropdownRating}>
                      <Star size={10} color={c.accent} fill={c.accent} />
                      <Text style={styles.dropdownRatingText}>{m.imdb}</Text>
                    </View>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            )}
          </View>
        )}
      </View>

      <ScrollView
        ref={pagerRef}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={(e) => setActivePage(Math.round(e.nativeEvent.contentOffset.x / SCREEN_W))}
        style={{ flex: 1 }}
      >
        {/* Sayfa 1: Önerilenler — kişiselleştirilmiş 2 sütunlu ızgara, sonsuz kaydırma destekli.
            AI sonuçları da (describeResults) aynı ızgarada gösteriliyor. Arama artık burayı hiç
            etkilemiyor, kendi dropdown'unda (headerContent içinde) kalıyor. */}
        <View style={{ width: SCREEN_W, flex: 1 }}>
          <FlatList
            ref={mainListRef}
            data={list}
            keyExtractor={(item) => String(item.id)}
            numColumns={2}
            columnWrapperStyle={{ gap: 12 }}
            contentContainerStyle={{ padding: 16, paddingTop: 0 }}
            ListHeaderComponent={
              <>
                {headerContent}
                <PopularNowRow items={popularNow} onPress={(m) => navigation.navigate("Detail", { movie: m })} />
              </>
            }
            renderItem={renderCompactCard}
            onEndReachedThreshold={0.4}
            onEndReached={describeResults ? () => setDescribeCount((v) => v + 8) : handleLoadMore}
            ListFooterComponent={loadingMore ? <ActivityIndicator style={{ marginVertical: 16 }} color={c.accent} /> : null}
            refreshing={refreshing}
            onRefresh={describeResults ? undefined : handleRefresh}
          />
        </View>

        {/* Sayfa 2: Şu An Gösterimde */}
        <View style={{ width: SCREEN_W, flex: 1 }}>
          <FlatList
            ref={newReleasesListRef}
            data={spotlight.newReleases}
            keyExtractor={(item) => String(item.id)}
            contentContainerStyle={{ padding: 16, paddingTop: 0 }}
            ListHeaderComponent={headerContent}
            renderItem={renderMovieCard}
            ListEmptyComponent={<Text style={styles.emptyPageText}>Şu an yeni çıkan bir şey bulunamadı.</Text>}
          />
        </View>

        {/* Sayfa 3: Yakında Çıkacaklar */}
        <View style={{ width: SCREEN_W, flex: 1 }}>
          <FlatList
            ref={upcomingListRef}
            data={spotlight.upcoming}
            keyExtractor={(item) => String(item.id)}
            contentContainerStyle={{ padding: 16, paddingTop: 0 }}
            ListHeaderComponent={headerContent}
            renderItem={renderUpcomingCard}
            ListEmptyComponent={<Text style={styles.emptyPageText}>Şu an yakında çıkacak bir şey bulunamadı.</Text>}
          />
        </View>
      </ScrollView>

      {sendMovie && <SendToFriendModal movie={sendMovie} onClose={() => setSendMovie(null)} />}
      {pickerMovie && <ListPickerModal movie={pickerMovie} onClose={() => setPickerMovie(null)} />}
    </View>
  );
}

function dedupe(items) {
  const byId = new Map();
  items.forEach((m) => byId.set(m.id, m));
  return [...byId.values()];
}

function makeStyles(c) {
  return StyleSheet.create({
    center: { flex: 1, alignItems: "center", justifyContent: "center" },
    searchRow: { flexDirection: "row", gap: 8 },
    searchBox: {
      flex: 1, flexDirection: "row", alignItems: "center", gap: 8,
      backgroundColor: c.surface, borderWidth: 1, borderColor: c.border, borderRadius: 12, paddingHorizontal: 12,
    },
    searchInput: { flex: 1, color: c.text, fontSize: 13, paddingVertical: 10 },
    searchBoxFocused: { borderColor: c.accent },
    filterBtn: {
      width: 42, borderRadius: 12, backgroundColor: c.surface, borderWidth: 1, borderColor: c.border,
      alignItems: "center", justifyContent: "center",
    },
    filterDot: { position: "absolute", top: 6, right: 6, width: 7, height: 7, borderRadius: 999, backgroundColor: c.accent2 },

    // Arama dropdown'u — kutunun hemen altında, listeye hiç dokunmadan açılıp kapanıyor.
    dropdown: {
      position: "absolute", top: "100%", left: 0, right: 0, marginTop: 8,
      backgroundColor: c.surface, borderWidth: 1, borderColor: c.border, borderRadius: 16,
      shadowColor: "#000", shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.18, shadowRadius: 16, elevation: 12,
      overflow: "hidden",
    },
    dropdownEmpty: { fontSize: 12, color: c.dim, textAlign: "center", paddingVertical: 22, paddingHorizontal: 16 },
    dropdownRow: {
      flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 14, paddingVertical: 10,
      borderBottomWidth: 1, borderBottomColor: c.border,
    },
    dropdownPoster: { width: 36, height: 52, borderRadius: 7 },
    dropdownTitle: { fontSize: 13, fontWeight: "700", color: c.text },
    dropdownMeta: { fontSize: 11, color: c.dim, marginTop: 2 },
    dropdownRating: { flexDirection: "row", alignItems: "center", gap: 3 },
    dropdownRatingText: { fontSize: 11, fontWeight: "800", color: c.text },
    filterPanel: {
      marginTop: 10, backgroundColor: c.surface, borderWidth: 1, borderColor: c.border, borderRadius: 18, padding: 16,
    },
    filterHeaderRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 12 },
    filterTitle: { fontWeight: "800", fontSize: 14, color: c.text },
    clearText: { color: c.accent, fontSize: 11, fontWeight: "700" },
    filterLabel: { fontSize: 10, fontWeight: "800", color: c.dim, letterSpacing: 0.5, marginBottom: 8, marginTop: 4 },
    toggleRow: {
      flexDirection: "row", alignItems: "center", marginTop: 16, paddingTop: 14,
      borderTopWidth: 1, borderTopColor: c.border, gap: 10,
    },
    toggleTitle: { fontSize: 13, fontWeight: "600", color: c.text },
    toggleSubtitle: { fontSize: 11, color: c.dim, marginTop: 2 },

    // aiZone/aiPanel/describe* stilleri artık AIZone.js'de yaşıyor — burada sadece Ana Sayfa'nın
    // KENDİ render ettiği "aktif AI sonucu" şeridi için gerekenler kaldı.
    clearDescribeText: { color: c.dim, fontSize: 11, textDecorationLine: "underline" },
    aiResultsBanner: {
      flexDirection: "row", alignItems: "center", gap: 8, marginTop: 10,
      backgroundColor: c.surface2, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10,
    },
    aiResultsBannerText: { flex: 1, fontSize: 12, fontWeight: "600", color: c.text },

    feedTabRow: { flexDirection: "row", borderBottomWidth: 1, borderBottomColor: c.border, backgroundColor: c.bg },
    feedTabBtn: { flex: 1, alignItems: "center", paddingVertical: 12 },
    feedTabUnderline: { height: 2, width: 28, backgroundColor: c.accent, borderRadius: 999, marginTop: 8 },
    emptyPageText: { color: c.dim, fontSize: 12, textAlign: "center", marginTop: 30 },
  });
}
