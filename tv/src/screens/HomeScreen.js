import React, { useCallback, useEffect, useState } from "react";
import { View, Text, Image, ScrollView, FlatList, StyleSheet, ActivityIndicator } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { api } from "../api";
import { C, FONTS, SAFE_X, SAFE_Y, upperTR } from "../theme";
import { platformLabel } from "../platforms";
import Poster from "../components/Poster";
import FocusButton from "../components/FocusButton";

// Telefondaki ana ekranın önerileri, TV düzeninde: üstte odaktaki içeriğin büyük tanıtımı,
// altında kumandayla gezilen satırlar. AI modu yok.

function interleave(a = [], b = []) {
  const out = [];
  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    if (a[i]) out.push(a[i]);
    if (b[i]) out.push(b[i]);
  }
  return out;
}

function uniq(list, seen = new Set()) {
  return list.filter((m) => m && m.id != null && !seen.has(m.id) && seen.add(m.id));
}

export default function HomeScreen({ auth, onOpen, onSignOut, preferred, hidden }) {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [hero, setHero] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const safe = (p) => p.catch((e) => { if (e.status === 401) throw e; return { results: [] }; });
      const [m1, t1, trM, trT, m2, t2] = await Promise.all([
        safe(api.movies(auth.token, "movie", 1)),
        safe(api.movies(auth.token, "tv", 1)),
        safe(api.trending(auth.token, "movie")),
        safe(api.trending(auth.token, "tv")),
        safe(api.movies(auth.token, "movie", 2)),
        safe(api.movies(auth.token, "tv", 2)),
      ]);
      const seen = new Set();
      const forYou = uniq(interleave(m1.results, t1.results), seen).slice(0, 24);
      const more = uniq(interleave(m2.results, t2.results), seen).slice(0, 24);
      const popular = uniq(interleave(trM.results, trT.results)).slice(0, 20);
      const next = [
        { key: "forYou", title: "SANA ÖZEL", items: forYou },
        { key: "popular", title: "ŞU AN POPÜLER", items: popular },
        { key: "more", title: "DAHA FAZLA ÖNERİ", items: more },
      ].filter((r) => r.items.length);
      setRows(next);
      setHero((h) => h || next[0]?.items[0] || null);
    } catch (e) {
      if (e.status === 401) { onSignOut(true); return; }
      setError(e.message || "Öneriler yüklenemedi.");
    } finally {
      setLoading(false);
    }
  }, [auth.token, onSignOut]);

  useEffect(() => { load(); }, [load]);

  const onFocusMovie = useCallback((m) => setHero(m), []);
  const platforms = (hero?.platforms || []).map((p) => platformLabel(p.name).name).join("  ·  ");
  const heroMeta = hero ? [hero.type, hero.year, hero.imdb ? `IMDb ${hero.imdb}` : null].filter(Boolean).join("  ·  ") : "";

  return (
    <View style={[styles.root, hidden && { display: "none" }]}>
      {/* Kahraman alanı: odaktaki içeriğin büyük tanıtımı */}
      <View style={styles.hero}>
        {!!hero?.poster && (
          <View style={styles.heroArt}>
            <Image source={{ uri: hero.poster }} style={StyleSheet.absoluteFill} blurRadius={14} />
            <LinearGradient colors={[C.bg, "rgba(20,18,26,0.55)", "rgba(20,18,26,0.2)"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={StyleSheet.absoluteFill} />
            <LinearGradient colors={["rgba(20,18,26,0)", C.bg]} start={{ x: 0, y: 0.5 }} end={{ x: 0, y: 1 }} style={StyleSheet.absoluteFill} />
          </View>
        )}
        <View style={styles.topBar}>
          <Text style={styles.logo}>pellix</Text>
          <View style={styles.topRight}>
            {!!auth.user?.name && <Text style={styles.user}>{upperTR(auth.user.name)}</Text>}
            <FocusButton label="Çıkış" onPress={() => onSignOut(false)} style={styles.signOut} />
          </View>
        </View>
        {hero && (
          <View style={styles.heroText}>
            <Text style={styles.heroMeta}>{upperTR(heroMeta)}</Text>
            <Text style={styles.heroTitle} numberOfLines={1}>{hero.title}</Text>
            {!!hero.overview && <Text style={styles.heroOverview} numberOfLines={3}>{hero.overview}</Text>}
            {!!platforms && <Text style={styles.heroPlatforms}>{upperTR(platforms)}</Text>}
          </View>
        )}
      </View>

      {loading && !rows.length ? (
        <ActivityIndicator color={C.accent} style={{ marginTop: 40 }} />
      ) : error ? (
        <View style={styles.errorBox}>
          <Text style={styles.error}>{error}</Text>
          <FocusButton label="Tekrar dene" onPress={load} primary hasTVPreferredFocus style={{ marginTop: 12 }} />
        </View>
      ) : (
        <ScrollView style={styles.rows} contentContainerStyle={{ paddingBottom: SAFE_Y * 2 }} showsVerticalScrollIndicator={false}>
          {rows.map((row, rowIndex) => (
            <View key={row.key} style={styles.row}>
              <Text style={styles.rowTitle}>{row.title}</Text>
              <FlatList
                horizontal
                data={row.items}
                keyExtractor={(m) => `${row.key}-${m.id}`}
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={{ paddingHorizontal: SAFE_X }}
                renderItem={({ item, index }) => (
                  <Poster
                    movie={item}
                    onFocusMovie={onFocusMovie}
                    onOpen={(m) => onOpen(m, row.key)}
                    hasTVPreferredFocus={preferred
                      ? (preferred.row === row.key && preferred.id === item.id)
                      : rowIndex === 0 && index === 0}
                  />
                )}
              />
            </View>
          ))}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },
  hero: { height: 260 },
  heroArt: { position: "absolute", top: 0, right: 0, bottom: 0, width: "62%" },
  topBar: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: SAFE_X, paddingTop: SAFE_Y },
  logo: { fontFamily: FONTS.logo, fontSize: 26, color: C.text },
  topRight: { flexDirection: "row", alignItems: "center", gap: 14 },
  user: { fontFamily: FONTS.monoMedium, color: C.dim, fontSize: 12, letterSpacing: 1.5 },
  signOut: { minHeight: 34, paddingHorizontal: 16 },
  heroText: { paddingHorizontal: SAFE_X, marginTop: 18, maxWidth: 560 },
  heroMeta: { fontFamily: FONTS.monoMedium, color: C.accent, fontSize: 12, letterSpacing: 1.5 },
  heroTitle: { fontFamily: FONTS.marquee, color: C.text, fontSize: 48, lineHeight: 52, marginTop: 4 },
  heroOverview: { color: C.text, opacity: 0.82, fontSize: 15, lineHeight: 21, marginTop: 6 },
  heroPlatforms: { fontFamily: FONTS.monoMedium, color: C.dim, fontSize: 12, letterSpacing: 1.5, marginTop: 10 },
  rows: { flex: 1 },
  row: { marginTop: 6 },
  rowTitle: { fontFamily: FONTS.monoMedium, color: C.dim, fontSize: 12, letterSpacing: 2, paddingHorizontal: SAFE_X, marginBottom: 2 },
  errorBox: { paddingHorizontal: SAFE_X, marginTop: 30, alignItems: "flex-start" },
  error: { color: C.danger, fontSize: 16 },
});
