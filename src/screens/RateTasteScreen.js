import React, { useCallback, useMemo, useState } from "react";
import { View, Text, Image, FlatList, TouchableOpacity, StyleSheet, ActivityIndicator } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useFocusEffect } from "@react-navigation/native";
import { Star, Sparkles } from "lucide-react-native";
import { useAuth } from "../context/AuthContext";
import { useAppTheme } from "../context/ThemeContext";
import { diaryApi } from "../api/diary";
import { api } from "../api/client";
import ScreenHeader from "../components/ScreenHeader";
import DiaryEntryModal from "../components/DiaryEntryModal";

const DISPLAY_LIMIT = 30;
const PREFETCH_TARGET = 90;
const MAX_PAGES = 100;

function getDiaryMovieId(entry) {
  const value = entry?.movie?.id ?? entry?.movieId ?? entry?.movie_id;
  const id = Number(value);
  return Number.isFinite(id) ? id : null;
}

async function loadDiaryMap(token) {
  const map = new Map();
  let page = 1;

  while (page <= MAX_PAGES) {
    const data = await diaryApi.list(token, page, 100);
    const rows = data?.results || [];

    rows.forEach((entry) => {
      const movieId = getDiaryMovieId(entry);
      if (movieId != null) map.set(movieId, entry);
    });

    if (!data?.hasMore) break;
    page += 1;
  }

  return map;
}

async function loadTasteCandidates(token, userId, diaryByMovie) {
  const candidates = [];
  const seen = new Set();
  let page = 1;
  let hadLikes = false;

  while (page <= MAX_PAGES && candidates.length < PREFETCH_TARGET) {
    const data = await api.allLikes(token, userId, page);
    const rows = data?.results || [];
    if (rows.length) hadLikes = true;

    for (const movie of rows) {
      const movieId = Number(movie?.id);
      if (!Number.isFinite(movieId) || seen.has(movieId)) continue;
      seen.add(movieId);

      // Bu ekran sadece henüz puanlanmamış hızlı zevk sinyallerini derinleştirir.
      // İzledim kaydı olup puanı olmayan içerikler kalır; daha önce puanlananlar tekrar gösterilmez.
      const diaryEntry = diaryByMovie.get(movieId);
      if (diaryEntry?.rating != null) continue;

      candidates.push(movie);
      if (candidates.length >= PREFETCH_TARGET) break;
    }

    if (!data?.hasMore) break;
    page += 1;
  }

  return { candidates, hadLikes };
}

export default function RateTasteScreen({ navigation }) {
  const { auth } = useAuth();
  const { c } = useAppTheme();
  const insets = useSafeAreaInsets();
  const styles = makeStyles(c, insets);
  const [candidatePool, setCandidatePool] = useState([]);
  const [diaryByMovie, setDiaryByMovie] = useState(new Map());
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(null);
  const [hadLikes, setHadLikes] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      // Önce Diary snapshot'ını alıyoruz; böylece daha önce puanlanan içerikleri aday havuzuna
      // hiç sokmadan, all-likes sayfalarından onların arkasındaki yeni içerikleri doldurabiliyoruz.
      const diaryMap = await loadDiaryMap(auth.token);
      const { candidates, hadLikes: hasLikes } = await loadTasteCandidates(auth.token, auth.id, diaryMap);
      setDiaryByMovie(diaryMap);
      setCandidatePool(candidates);
      setHadLikes(hasLikes);
    } catch {}
    setLoading(false);
  }, [auth.token, auth.id]);

  // Ekrana her geri dönüşte server'dan taze snapshot al. Böylece başka bir ekranda verilen puanlar
  // da anında elenir ve ilk 30'un arkasından yeni adaylar doldurulur.
  useFocusEffect(useCallback(() => {
    load();
  }, [load]));

  const rows = useMemo(() => candidatePool
    .filter((movie) => diaryByMovie.get(Number(movie.id))?.rating == null)
    .slice(0, DISPLAY_LIMIT), [candidatePool, diaryByMovie]);

  const ratedTotal = useMemo(() => {
    let count = 0;
    diaryByMovie.forEach((entry) => { if (entry?.rating != null) count += 1; });
    return count;
  }, [diaryByMovie]);

  function applySaved(entry) {
    const movieId = getDiaryMovieId(entry) ?? Number(selected?.id);
    if (!Number.isFinite(movieId)) return;

    setDiaryByMovie((prev) => {
      const next = new Map(prev);
      next.set(movieId, entry);
      return next;
    });

    // Puan verildiyse içerik bu işini tamamladı: ekrandan hemen çıkar. Havuz önceden 90 adaya
    // kadar doldurulduğu için alttaki sıradaki içerik aynı anda onun yerini alır.
    if (entry?.rating != null) {
      setCandidatePool((prev) => prev.filter((movie) => Number(movie.id) !== movieId));
    }
  }

  function applyRemoved(movieId) {
    setDiaryByMovie((prev) => {
      const next = new Map(prev);
      next.delete(Number(movieId));
      return next;
    });
  }

  return (
    <View style={styles.screen}>
      <ScreenHeader title="İzlediklerini puanla" onBack={() => navigation.goBack()} />
      <View style={styles.intro}>
        <View style={styles.introIcon}><Sparkles size={18} color="#8B5CF6" /></View>
        <View style={{ flex: 1 }}>
          <Text style={styles.introTitle}>Zevk profilini derinleştir</Text>
          <Text style={styles.introText}>“Zevkime göre” işaretlediklerinden gerçekten izlediklerine puan ver. Puanladıkların bu listeden çıkar; sıradaki içerikler onların yerini alır.</Text>
        </View>
      </View>
      <View style={styles.progressRow}>
        <Text style={styles.progressText}>{rows.length} yeni içerik hazır</Text>
        <Text style={styles.progressHint}>{ratedTotal ? `Şimdiye kadar ${ratedTotal} içeriği puanladın.` : "İzledim ve zevk sinyali birbirinden ayrı kalır."}</Text>
      </View>

      {loading ? (
        <ActivityIndicator color={c.accent} style={{ marginTop: 40 }} />
      ) : (
        <FlatList
          data={rows}
          keyExtractor={(item) => String(item.id)}
          contentContainerStyle={styles.list}
          renderItem={({ item }) => {
            const entry = diaryByMovie.get(Number(item.id));
            return (
              <TouchableOpacity style={styles.row} activeOpacity={0.84} onPress={() => setSelected(item)}>
                {item.poster ? <Image source={{ uri: item.poster }} style={styles.poster} /> : <View style={styles.poster} />}
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={styles.title} numberOfLines={1}>{item.title}</Text>
                  <Text style={styles.meta} numberOfLines={1}>{[item.year, item.type].filter(Boolean).join(" · ")}</Text>
                  <Text style={styles.stateText}>
                    {entry ? "İzlendi · henüz puan yok" : "İzledin mi? Puanını ekleyebilirsin"}
                  </Text>
                </View>
                <View style={styles.action}>
                  <Star size={14} color={c.accent} />
                  <Text style={styles.actionText}>{entry ? "Puanla" : "İzledim"}</Text>
                </View>
              </TouchableOpacity>
            );
          }}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Text style={styles.emptyTitle}>{hadLikes ? "Puanlanacak yeni içerik kalmadı" : "Henüz hızlı zevk sinyalin yok"}</Text>
              <Text style={styles.emptyText}>
                {hadLikes
                  ? "Yeni içeriklere “Zevkime göre” dedikçe burada sadece henüz puanlamadıkların görünecek."
                  : "Keşfet’te “Zevkime göre” dediklerin burada görünür."}
              </Text>
            </View>
          }
        />
      )}

      <DiaryEntryModal
        visible={!!selected}
        movie={selected}
        entry={selected ? diaryByMovie.get(Number(selected.id)) : null}
        onClose={() => setSelected(null)}
        onSaved={applySaved}
        onRemoved={() => selected && applyRemoved(selected.id)}
        onOpenDiary={() => { setSelected(null); navigation.navigate("Diary"); }}
      />
    </View>
  );
}

function makeStyles(c, insets) {
  return StyleSheet.create({
    screen: { flex: 1, backgroundColor: c.bg },
    intro: { marginHorizontal: 16, marginTop: 10, flexDirection: "row", gap: 11, padding: 13, borderRadius: 16, backgroundColor: c.surface, borderWidth: 1, borderColor: c.border },
    introIcon: { width: 38, height: 38, borderRadius: 12, backgroundColor: "rgba(139,92,246,0.14)", alignItems: "center", justifyContent: "center" },
    introTitle: { color: c.text, fontSize: 14, fontWeight: "900" },
    introText: { color: c.dim, fontSize: 11, lineHeight: 16, marginTop: 3 },
    progressRow: { paddingHorizontal: 18, paddingTop: 12, paddingBottom: 6 },
    progressText: { color: c.text, fontSize: 11.5, fontWeight: "800" },
    progressHint: { color: c.dim, fontSize: 9.5, marginTop: 2 },
    list: { padding: 16, paddingTop: 6, paddingBottom: Math.max(28, insets.bottom + 18) },
    row: { flexDirection: "row", alignItems: "center", gap: 11, padding: 9, marginBottom: 8, borderRadius: 14, backgroundColor: c.surface, borderWidth: 1, borderColor: c.border },
    poster: { width: 48, height: 70, borderRadius: 9, backgroundColor: c.surface2 },
    title: { color: c.text, fontSize: 12.5, fontWeight: "850" },
    meta: { color: c.dim, fontSize: 10, marginTop: 2 },
    stateText: { color: c.dim, fontSize: 9.5, marginTop: 7 },
    action: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 9, paddingVertical: 7, borderRadius: 999, borderWidth: 1, borderColor: c.accent, backgroundColor: c.surface2 },
    actionText: { color: c.text, fontSize: 10, fontWeight: "800" },
    empty: { alignItems: "center", paddingVertical: 56, paddingHorizontal: 24 },
    emptyTitle: { color: c.text, fontWeight: "900", fontSize: 14 },
    emptyText: { color: c.dim, fontSize: 11, marginTop: 5, textAlign: "center" },
  });
}
