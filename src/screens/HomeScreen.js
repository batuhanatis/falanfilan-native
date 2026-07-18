import React, { useState, useEffect, useCallback, useMemo } from "react";
import { View, Text, FlatList, StyleSheet, ActivityIndicator, TextInput, TouchableOpacity, Switch } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Search, Filter, Sparkles, MessageSquareText, Wand2, Image as ImageIcon, ChevronDown } from "lucide-react-native";
import { useAppTheme } from "../context/ThemeContext";
import { useAuth } from "../context/AuthContext";
import { api } from "../api/client";
import { GENRE_FILTERS } from "../theme/theme";
import MovieCard from "../components/MovieCard";
import ChipRow from "../components/ChipRow";
import PlatformChipRow from "../components/PlatformChipRow";
import { platformName, platformLogo } from "../utils/platform";
import { recommendationReason } from "../utils/recommend";
import TopBar from "../components/TopBar";
import SendToFriendModal from "../components/SendToFriendModal";
import TasteRecommendModal from "../components/TasteRecommendModal";
import PhotoIdentifyModal from "../components/PhotoIdentifyModal";

export default function HomeScreen({ navigation }) {
  const { c } = useAppTheme();
  const { auth } = useAuth();
  const styles = makeStyles(c);

  const [movies, setMovies] = useState([]);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [liked, setLiked] = useState(new Set());
  const [disliked, setDisliked] = useState(new Set());
  const [watchlist, setWatchlist] = useState(new Set());

  const [query, setQuery] = useState("");
  const [searchResults, setSearchResults] = useState(null); // null = arama aktif değil
  const [searchLoading, setSearchLoading] = useState(false);

  const [showFilters, setShowFilters] = useState(false);
  const [typeFilter, setTypeFilter] = useState("Hepsi");
  const [genreFilter, setGenreFilter] = useState(null);
  const [platformFilters, setPlatformFilters] = useState(new Set());
  const [hideRated, setHideRated] = useState(false);

  // "Yapay Zeka Köşesi" — üç alt özellik tek renkli bir buton değil, renkli bir alan.
  const [aiOpen, setAiOpen] = useState(false);
  const [describeOpen, setDescribeOpen] = useState(false);
  const [prompt, setPrompt] = useState("");
  const [describeResults, setDescribeResults] = useState(null);
  const [describeCount, setDescribeCount] = useState(8);
  const [describeLoading, setDescribeLoading] = useState(false);
  const [describeError, setDescribeError] = useState("");
  const [tasteModalOpen, setTasteModalOpen] = useState(false);
  const [photoModalOpen, setPhotoModalOpen] = useState(false);
  const [aiResultsLabel, setAiResultsLabel] = useState("");

  const [sendMovie, setSendMovie] = useState(null); // gönderilecek film

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

  useEffect(() => {
    (async () => {
      setLoading(true);
      await loadInteractions();
      const items = await loadPage(1);
      setMovies(dedupe(items));
      setLoading(false);
    })();
  }, []);

  // Film/dizi arama — 500ms bekleyip backend'e sorar.
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
    }, 500);
    return () => clearTimeout(timer);
  }, [query]);

  async function handleLoadMore() {
    if (loadingMore || searchResults !== null || describeResults) return;
    setLoadingMore(true);
    const nextPage = page + 1;
    const items = await loadPage(nextPage);
    setMovies((prev) => dedupe([...prev, ...items]));
    setPage(nextPage);
    setLoadingMore(false);
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

  const baseList = searchResults !== null ? searchResults : movies;
  const filteredList = useMemo(() => {
    let list = baseList;
    if (typeFilter !== "Hepsi") list = list.filter((m) => m.type === typeFilter);
    if (genreFilter) list = list.filter((m) => m.genre === genreFilter);
    if (platformFilters.size > 0) list = list.filter((m) => (m.platforms || []).some((p) => platformFilters.has(platformName(p))));
    if (hideRated) list = list.filter((m) => !liked.has(m.id) && !disliked.has(m.id));
    return list;
  }, [baseList, typeFilter, genreFilter, platformFilters, hideRated, liked, disliked]);

  const anyFilterActive = typeFilter !== "Hepsi" || !!genreFilter || platformFilters.size > 0 || hideRated;
  function clearFilters() { setTypeFilter("Hepsi"); setGenreFilter(null); setPlatformFilters(new Set()); setHideRated(false); }
  function togglePlatform(name) {
    setPlatformFilters((prev) => { const n = new Set(prev); n.has(name) ? n.delete(name) : n.add(name); return n; });
  }

  async function runDescribe() {
    if (!prompt.trim() || describeLoading) return;
    setDescribeLoading(true);
    setDescribeError("");
    try {
      const data = await api.describe(auth.token, prompt.trim());
      const matched = data.results || [];
      if (matched.length === 0) setDescribeError("Bu tanıma uyan bir şey bulamadım, farklı bir şekilde anlatmayı dener misin?");
      setDescribeResults(matched);
      setAiResultsLabel(`"${prompt.trim()}" için önerilerin`);
      setDescribeCount(8);
    } catch (e) {
      setDescribeError(e.message || "Öneri alınamadı, tekrar dener misin?");
    }
    setDescribeLoading(false);
  }
  function clearDescribe() { setDescribeResults(null); setPrompt(""); setDescribeOpen(false); setDescribeError(""); setAiResultsLabel(""); }

  function applyTasteResults(results) {
    setDescribeResults(results);
    setAiResultsLabel("Zevkine göre önerilerin");
    setDescribeCount(8);
  }

  const list = describeResults ? describeResults.slice(0, describeCount) : filteredList;

  const listHeader = (
    <View style={{ paddingHorizontal: 16, paddingTop: 14, paddingBottom: 6 }}>
      <View style={styles.searchRow}>
        <View style={styles.searchBox}>
          <Search size={16} color={c.dim} />
          <TextInput
            style={styles.searchInput}
            placeholder="Film veya dizi ara"
            placeholderTextColor={c.dim}
            value={query}
            onChangeText={setQuery}
          />
        </View>
        <TouchableOpacity
          style={[styles.filterBtn, showFilters && { backgroundColor: c.accent }]}
          onPress={() => setShowFilters((v) => !v)}
        >
          <Filter size={16} color={showFilters ? c.bg : c.text} />
          {anyFilterActive && !showFilters && <View style={styles.filterDot} />}
        </TouchableOpacity>
      </View>
      {searchLoading && <Text style={styles.searchingText}>Aranıyor...</Text>}

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

          <View style={styles.toggleRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.toggleTitle}>Oy verilenleri gizle</Text>
              <Text style={styles.toggleSubtitle}>Beğendiğin/beğenmediğin içerikler listede görünmesin</Text>
            </View>
            <Switch value={hideRated} onValueChange={setHideRated} trackColor={{ true: c.accent }} />
          </View>
        </View>
      )}

      {/* Yapay Zeka Köşesi — renkli, eğlenceli, üç alt özellik */}
      <TouchableOpacity activeOpacity={0.9} onPress={() => setAiOpen((v) => !v)}>
        <LinearGradient
          colors={["#ff6b6b", "#f7b733", "#48dbfb", "#7367f0"]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.aiZone}
        >
          <View style={styles.aiZoneHeader}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
              <Sparkles size={18} color="#fff" />
              <Text style={styles.aiZoneTitle}>Yapay Zeka Köşesi</Text>
            </View>
            <ChevronDown size={18} color="#fff" style={{ transform: [{ rotate: aiOpen ? "180deg" : "0deg" }] }} />
          </View>
          <Text style={styles.aiZoneSubtitle}>Ne izleyeceğine karar veremiyorsan bize bırak</Text>
        </LinearGradient>
      </TouchableOpacity>

      {aiOpen && (
        <View style={styles.aiPanel}>
          <TouchableOpacity style={styles.aiRow} onPress={() => setDescribeOpen((v) => !v)}>
            <View style={[styles.aiRowIcon, { backgroundColor: "#ff6b6b" }]}>
              <MessageSquareText size={16} color="#fff" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.aiRowTitle}>Anlat, Bulalım</Text>
              <Text style={styles.aiRowSubtitle}>Ne tür bir şey istediğini kendi cümlelerinle anlat</Text>
            </View>
            <ChevronDown size={16} color={c.dim} style={{ transform: [{ rotate: describeOpen ? "180deg" : "0deg" }] }} />
          </TouchableOpacity>

          {describeOpen && (
            <View style={styles.describePanel}>
              <TextInput
                style={styles.describeInput}
                placeholder="Örn: kapalı havada geçen klostrofobik atmosferli hayatta kalma filmleri"
                placeholderTextColor={c.dim}
                value={prompt}
                onChangeText={setPrompt}
                multiline
                numberOfLines={2}
              />
              <View style={{ flexDirection: "row", gap: 8, marginTop: 8 }}>
                <TouchableOpacity style={[styles.describeGoBtn, describeLoading && { opacity: 0.6 }]} onPress={runDescribe} disabled={describeLoading}>
                  {describeLoading ? <ActivityIndicator size="small" color="#14121a" /> : <Text style={styles.describeGoText}>Öneri al</Text>}
                </TouchableOpacity>
                {describeResults && (
                  <TouchableOpacity onPress={clearDescribe} style={{ justifyContent: "center" }}>
                    <Text style={styles.clearDescribeText}>Aramayı temizle</Text>
                  </TouchableOpacity>
                )}
              </View>
              {!!describeError && <Text style={styles.describeErrorText}>{describeError}</Text>}
            </View>
          )}

          <TouchableOpacity style={styles.aiRow} onPress={() => setTasteModalOpen(true)}>
            <View style={[styles.aiRowIcon, { backgroundColor: "#7367f0" }]}>
              <Wand2 size={16} color="#fff" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.aiRowTitle}>Zevkime Göre Öner</Text>
              <Text style={styles.aiRowSubtitle}>Beğendiklerine bakıp sana özel bir şey bulur</Text>
            </View>
          </TouchableOpacity>

          <TouchableOpacity style={[styles.aiRow, { borderBottomWidth: 0 }]} onPress={() => setPhotoModalOpen(true)}>
            <View style={[styles.aiRowIcon, { backgroundColor: "#f7b733" }]}>
              <ImageIcon size={16} color="#fff" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.aiRowTitle}>Fotoğraftan Bul</Text>
              <Text style={styles.aiRowSubtitle}>Bir sahne yükle, hangi film/diziden olduğunu bulalım</Text>
            </View>
          </TouchableOpacity>
        </View>
      )}

      {describeResults && !!aiResultsLabel && (
        <View style={styles.aiResultsBanner}>
          <Sparkles size={13} color={c.accent} />
          <Text style={styles.aiResultsBannerText} numberOfLines={1}>{aiResultsLabel}</Text>
          <TouchableOpacity onPress={clearDescribe}><Text style={styles.clearDescribeText}>Temizle</Text></TouchableOpacity>
        </View>
      )}
    </View>
  );

  if (loading) {
    return (
      <View style={{ flex: 1, backgroundColor: c.bg }}>
        <TopBar />
        <View style={styles.center}>
          <ActivityIndicator size="large" color={c.accent} />
          <Text style={{ color: c.dim, marginTop: 10, fontSize: 12 }}>İçerikler hazırlanıyor...</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      <TopBar />
      <FlatList
        data={list}
        keyExtractor={(item) => String(item.id)}
        contentContainerStyle={{ padding: 16, paddingTop: 0 }}
        ListHeaderComponent={listHeader}
        renderItem={({ item, index }) => (
          <MovieCard
            movie={item}
            liked={liked.has(item.id)}
            disliked={disliked.has(item.id)}
            watchlisted={watchlist.has(item.id)}
            onLike={like}
            onDislike={dislike}
            onWatchlist={watch}
            onSend={setSendMovie}
            onPress={(m) => navigation.navigate("Detail", { movie: m })}
            reason={!describeResults && searchResults === null && index < 8 ? recommendationReason(item, liked, movies) : null}
          />
        )}
        onEndReachedThreshold={0.4}
        onEndReached={describeResults ? () => setDescribeCount((v) => v + 8) : handleLoadMore}
        ListFooterComponent={loadingMore ? <ActivityIndicator style={{ marginVertical: 16 }} color={c.accent} /> : null}
      />
      {sendMovie && <SendToFriendModal movie={sendMovie} onClose={() => setSendMovie(null)} />}
      {tasteModalOpen && <TasteRecommendModal onClose={() => setTasteModalOpen(false)} onResults={applyTasteResults} />}
      {photoModalOpen && <PhotoIdentifyModal onClose={() => setPhotoModalOpen(false)} navigation={navigation} />}
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
    filterBtn: {
      width: 42, borderRadius: 12, backgroundColor: c.surface, borderWidth: 1, borderColor: c.border,
      alignItems: "center", justifyContent: "center",
    },
    filterDot: { position: "absolute", top: 6, right: 6, width: 7, height: 7, borderRadius: 999, backgroundColor: c.accent2 },
    searchingText: { fontSize: 11, color: c.dim, marginTop: 8 },
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

    aiZone: { marginTop: 14, borderRadius: 18, padding: 16 },
    aiZoneHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
    aiZoneTitle: { color: "#fff", fontWeight: "800", fontSize: 15 },
    aiZoneSubtitle: { color: "rgba(255,255,255,0.9)", fontSize: 11, marginTop: 6 },

    aiPanel: { marginTop: 8, backgroundColor: c.surface, borderWidth: 1, borderColor: c.border, borderRadius: 14, paddingHorizontal: 14 },
    aiRow: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: c.border },
    aiRowIcon: { width: 34, height: 34, borderRadius: 10, alignItems: "center", justifyContent: "center" },
    aiRowTitle: { fontSize: 13, fontWeight: "700", color: c.text },
    aiRowSubtitle: { fontSize: 11, color: c.dim, marginTop: 2 },

    describePanel: { paddingBottom: 14 },
    describeInput: {
      backgroundColor: c.surface2, borderWidth: 1, borderColor: c.border, borderRadius: 10,
      padding: 10, color: c.text, fontSize: 13, minHeight: 50, textAlignVertical: "top",
    },
    describeGoBtn: { backgroundColor: c.accent, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 8 },
    describeGoText: { color: "#14121a", fontWeight: "700", fontSize: 12 },
    clearDescribeText: { color: c.dim, fontSize: 11, textDecorationLine: "underline" },
    describeErrorText: { color: c.danger, fontSize: 11, marginTop: 8 },

    aiResultsBanner: {
      flexDirection: "row", alignItems: "center", gap: 8, marginTop: 10,
      backgroundColor: c.surface2, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10,
    },
    aiResultsBannerText: { flex: 1, fontSize: 12, fontWeight: "600", color: c.text },
  });
}
