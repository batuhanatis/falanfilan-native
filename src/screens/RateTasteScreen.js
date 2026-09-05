import React, { useCallback, useEffect, useMemo, useState } from "react";
import { View, Text, Image, FlatList, TouchableOpacity, StyleSheet, ActivityIndicator } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Star, CheckCircle2, Sparkles } from "lucide-react-native";
import { useAuth } from "../context/AuthContext";
import { useAppTheme } from "../context/ThemeContext";
import { diaryApi } from "../api/diary";
import { api } from "../api/client";
import ScreenHeader from "../components/ScreenHeader";
import DiaryEntryModal from "../components/DiaryEntryModal";

export default function RateTasteScreen({ navigation }) {
  const { auth } = useAuth();
  const { c } = useAppTheme();
  const insets = useSafeAreaInsets();
  const styles = makeStyles(c, insets);
  const [likedMovies, setLikedMovies] = useState([]);
  const [diaryByMovie, setDiaryByMovie] = useState(new Map());
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [profile, diary] = await Promise.all([
        api.userProfile(auth.token, auth.id),
        diaryApi.list(auth.token, { page: 1, limit: 100 }),
      ]);
      setLikedMovies(profile.likedMovies || []);
      setDiaryByMovie(new Map((diary.results || []).map((entry) => [Number(entry.movieId), entry])));
    } catch {}
    setLoading(false);
  }, [auth.token, auth.id]);

  useEffect(() => { load(); }, [load]);

  const rows = useMemo(() => [...likedMovies].sort((a, b) => {
    const ar = diaryByMovie.get(Number(a.id))?.rating;
    const br = diaryByMovie.get(Number(b.id))?.rating;
    if (ar == null && br != null) return -1;
    if (ar != null && br == null) return 1;
    return 0;
  }), [likedMovies, diaryByMovie]);

  const ratedCount = rows.filter((movie) => diaryByMovie.get(Number(movie.id))?.rating != null).length;

  function applySaved(entry) {
    setDiaryByMovie((prev) => {
      const next = new Map(prev);
      next.set(Number(entry.movieId), entry);
      return next;
    });
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
          <Text style={styles.introText}>“Zevkime göre” işaretlediklerinden gerçekten izlediklerine puan ver. Puan vermek zorunlu değil.</Text>
        </View>
      </View>
      <View style={styles.progressRow}>
        <Text style={styles.progressText}>{ratedCount}/{rows.length} puanlandı</Text>
        <Text style={styles.progressHint}>İzledim ve zevk sinyali birbirinden ayrı kalır.</Text>
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
            const rating = entry?.rating;
            return (
              <TouchableOpacity style={styles.row} activeOpacity={0.84} onPress={() => setSelected(item)}>
                {item.poster ? <Image source={{ uri: item.poster }} style={styles.poster} /> : <View style={styles.poster} />}
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={styles.title} numberOfLines={1}>{item.title}</Text>
                  <Text style={styles.meta} numberOfLines={1}>{[item.year, item.type].filter(Boolean).join(" · ")}</Text>
                  <Text style={styles.stateText}>
                    {rating != null ? `Pellix puanın ${rating}/10` : entry ? "İzlendi · henüz puan yok" : "İzledin mi? Puanını ekleyebilirsin"}
                  </Text>
                </View>
                <View style={[styles.action, rating != null && styles.actionDone]}>
                  {rating != null ? <CheckCircle2 size={14} color={c.accent} /> : <Star size={14} color={c.accent} />}
                  <Text style={styles.actionText}>{rating != null ? `${rating}/10` : entry ? "Puanla" : "İzledim"}</Text>
                </View>
              </TouchableOpacity>
            );
          }}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Text style={styles.emptyTitle}>Henüz hızlı zevk sinyalin yok</Text>
              <Text style={styles.emptyText}>Keşfet’te “Zevkime göre” dediklerin burada görünür.</Text>
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
    actionDone: { backgroundColor: c.surface },
    actionText: { color: c.text, fontSize: 10, fontWeight: "800" },
    empty: { alignItems: "center", paddingVertical: 56, paddingHorizontal: 24 },
    emptyTitle: { color: c.text, fontWeight: "900", fontSize: 14 },
    emptyText: { color: c.dim, fontSize: 11, marginTop: 5, textAlign: "center" },
  });
}
