import React, { useCallback, useEffect, useState } from "react";
import { View, Text, Image, FlatList, TouchableOpacity, StyleSheet, ActivityIndicator } from "react-native";
import { BookOpen, Star, CalendarDays, Film, ChevronRight } from "lucide-react-native";
import { useAppTheme } from "../context/ThemeContext";
import { useAuth } from "../context/AuthContext";
import { diaryApi } from "../api/diary";
import ScreenHeader from "../components/ScreenHeader";
import EmptyState from "../components/EmptyState";

function formatDate(value) {
  if (!value) return "";
  try {
    return new Date(value).toLocaleDateString("tr-TR", { day: "numeric", month: "short", year: "numeric" });
  } catch {
    return "";
  }
}

export default function DiaryScreen({ navigation }) {
  const { c } = useAppTheme();
  const { auth } = useAuth();
  const styles = makeStyles(c);

  const [entries, setEntries] = useState([]);
  const [stats, setStats] = useState(null);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [available, setAvailable] = useState(true);

  const load = useCallback(async ({ reset = false } = {}) => {
    const targetPage = reset ? 1 : page;
    const [listData, statsData] = await Promise.all([
      diaryApi.list(auth.token, targetPage, 30),
      reset || !stats ? diaryApi.stats(auth.token) : Promise.resolve(stats),
    ]);
    if (reset) {
      setEntries(listData.results || []);
      setPage(1);
    } else {
      setEntries((prev) => targetPage === 1 ? (listData.results || []) : [...prev, ...(listData.results || [])]);
    }
    setHasMore(!!listData.hasMore);
    setStats(statsData || null);
    setAvailable(true);
  }, [auth.token, page, stats]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    Promise.all([diaryApi.list(auth.token, 1, 30), diaryApi.stats(auth.token)])
      .then(([listData, statsData]) => {
        if (cancelled) return;
        setEntries(listData.results || []);
        setStats(statsData || null);
        setHasMore(!!listData.hasMore);
        setPage(1);
        setAvailable(true);
      })
      .catch(() => { if (!cancelled) setAvailable(false); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [auth.token]);

  useEffect(() => {
    const unsub = navigation.addListener("focus", () => {
      diaryApi.list(auth.token, 1, 30).then((data) => {
        setEntries(data.results || []);
        setHasMore(!!data.hasMore);
        setPage(1);
      }).catch(() => {});
      diaryApi.stats(auth.token).then(setStats).catch(() => {});
    });
    return unsub;
  }, [navigation, auth.token]);

  async function refresh() {
    setRefreshing(true);
    try { await load({ reset: true }); } catch { /* mevcut listeyi koru */ }
    setRefreshing(false);
  }

  async function loadMore() {
    if (!hasMore || loadingMore) return;
    setLoadingMore(true);
    const nextPage = page + 1;
    try {
      const data = await diaryApi.list(auth.token, nextPage, 30);
      setEntries((prev) => [...prev, ...(data.results || [])]);
      setPage(nextPage);
      setHasMore(!!data.hasMore);
    } catch { /* mevcut listeyi koru */ }
    setLoadingMore(false);
  }

  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      <ScreenHeader
        title="Pellix Diary"
        subtitle={stats?.total ? `${stats.total} izleme kaydı` : "İzlediklerin burada birikir"}
        onBack={() => navigation.goBack()}
      />

      {loading ? (
        <View style={styles.center}><ActivityIndicator size="large" color={c.accent} /></View>
      ) : !available ? (
        <View style={styles.center}>
          <BookOpen size={34} color={c.dim} style={{ opacity: 0.55 }} />
          <Text style={styles.unavailableTitle}>Diary henüz hazır değil</Text>
          <Text style={styles.unavailableText}>Sunucu güncellemesi tamamlandığında bu alan otomatik açılacak.</Text>
        </View>
      ) : (
        <FlatList
          data={entries}
          keyExtractor={(item) => String(item.movie?.id)}
          contentContainerStyle={styles.content}
          refreshing={refreshing}
          onRefresh={refresh}
          onEndReached={loadMore}
          onEndReachedThreshold={0.35}
          ListHeaderComponent={
            <View>
              <View style={styles.heroCard}>
                <View style={styles.heroIcon}><BookOpen size={21} color={c.accent} /></View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.heroEyebrow}>İZLEME HAFIZAN</Text>
                  <Text style={styles.heroTitle}>Ne izlediğini Pellix hatırlasın</Text>
                  <Text style={styles.heroText}>Puanlarını ve kısa notlarını tut; zamanla kendi izleme geçmişin ve recap'lerin oluşsun.</Text>
                </View>
              </View>

              <View style={styles.statsRow}>
                <Stat value={stats?.total ?? 0} label="TOPLAM" c={c} styles={styles} />
                <Stat value={stats?.thisYear ?? 0} label="BU YIL" c={c} styles={styles} />
                <Stat value={stats?.avgRating != null ? stats.avgRating : "—"} label="ORT. PUAN" c={c} styles={styles} />
              </View>

              {!!stats?.topGenres?.length && (
                <View style={styles.genreRow}>
                  {stats.topGenres.slice(0, 3).map((item) => (
                    <View key={item.genre} style={styles.genrePill}>
                      <Text style={styles.genrePillText}>{item.genre} · {item.count}</Text>
                    </View>
                  ))}
                </View>
              )}

              {entries.length > 0 && <Text style={styles.sectionLabel}>SON İZLEDİKLERİN</Text>}
            </View>
          }
          renderItem={({ item }) => {
            const movie = item.movie;
            return (
              <TouchableOpacity style={styles.entryCard} activeOpacity={0.86} onPress={() => navigation.navigate("Detail", { movie })}>
                {movie?.poster ? <Image source={{ uri: movie.poster }} style={styles.poster} /> : <View style={[styles.poster, { backgroundColor: c.surface2 }]} />}
                <View style={styles.entryCopy}>
                  <Text style={styles.entryTitle} numberOfLines={1}>{movie?.title}</Text>
                  <View style={styles.entryMetaRow}>
                    <CalendarDays size={11} color={c.dim} />
                    <Text style={styles.entryMeta}>{formatDate(item.watchedAt)}</Text>
                    {!!movie?.type && <><Text style={styles.entryMeta}>·</Text><Film size={10} color={c.dim} /><Text style={styles.entryMeta}>{movie.type}</Text></>}
                  </View>
                  {item.rating != null && (
                    <View style={styles.ratingRow}>
                      <Star size={12} color={c.accent} fill={c.accent} />
                      <Text style={styles.ratingText}>{item.rating}/10</Text>
                    </View>
                  )}
                  {!!item.note && <Text style={styles.note} numberOfLines={2}>“{item.note}”</Text>}
                </View>
                <ChevronRight size={17} color={c.dim} />
              </TouchableOpacity>
            );
          }}
          ListEmptyComponent={
            <EmptyState
              icon={BookOpen}
              title="Günlüğün henüz boş"
              text="Bir film veya dizi detayında ‘İzledim’ butonuna dokunarak ilk kaydını oluştur."
            />
          }
          ListFooterComponent={loadingMore ? <ActivityIndicator color={c.accent} style={{ marginVertical: 18 }} /> : null}
        />
      )}
    </View>
  );
}

function Stat({ value, label, styles }) {
  return (
    <View style={styles.statCard}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

function makeStyles(c) {
  return StyleSheet.create({
    center: { flex: 1, alignItems: "center", justifyContent: "center", padding: 28 },
    content: { padding: 16, paddingBottom: 32 },
    unavailableTitle: { color: c.text, fontSize: 16, fontWeight: "800", marginTop: 12 },
    unavailableText: { color: c.dim, fontSize: 11.5, lineHeight: 17, textAlign: "center", marginTop: 5 },
    heroCard: { flexDirection: "row", gap: 12, backgroundColor: c.surface, borderWidth: 1, borderColor: c.border, borderRadius: 18, padding: 15 },
    heroIcon: { width: 42, height: 42, borderRadius: 14, backgroundColor: c.surface2, alignItems: "center", justifyContent: "center" },
    heroEyebrow: { color: c.accent, fontSize: 9, fontWeight: "900", letterSpacing: 0.8 },
    heroTitle: { color: c.text, fontSize: 14, fontWeight: "900", marginTop: 3 },
    heroText: { color: c.dim, fontSize: 10.5, lineHeight: 15.5, marginTop: 3 },
    statsRow: { flexDirection: "row", gap: 8, marginTop: 10 },
    statCard: { flex: 1, alignItems: "center", backgroundColor: c.surface, borderWidth: 1, borderColor: c.border, borderRadius: 14, paddingVertical: 12 },
    statValue: { color: c.text, fontSize: 18, fontWeight: "900" },
    statLabel: { color: c.dim, fontSize: 8.5, fontWeight: "900", letterSpacing: 0.6, marginTop: 2 },
    genreRow: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 10 },
    genrePill: { backgroundColor: c.surface2, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 6 },
    genrePillText: { color: c.text, fontSize: 10.5, fontWeight: "700" },
    sectionLabel: { color: c.dim, fontSize: 9.5, fontWeight: "900", letterSpacing: 0.8, marginTop: 22, marginBottom: 9 },
    entryCard: { flexDirection: "row", alignItems: "center", gap: 11, backgroundColor: c.surface, borderWidth: 1, borderColor: c.border, borderRadius: 15, padding: 10, marginBottom: 8 },
    poster: { width: 52, height: 78, borderRadius: 9 },
    entryCopy: { flex: 1, minWidth: 0 },
    entryTitle: { color: c.text, fontSize: 13.5, fontWeight: "800" },
    entryMetaRow: { flexDirection: "row", alignItems: "center", gap: 4, marginTop: 4 },
    entryMeta: { color: c.dim, fontSize: 9.8, fontWeight: "600" },
    ratingRow: { flexDirection: "row", alignItems: "center", gap: 4, marginTop: 6 },
    ratingText: { color: c.text, fontSize: 11, fontWeight: "800" },
    note: { color: c.dim, fontSize: 10.5, lineHeight: 15, marginTop: 4, fontStyle: "italic" },
  });
}
