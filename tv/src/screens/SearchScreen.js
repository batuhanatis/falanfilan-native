import React, { useCallback, useEffect, useRef, useState } from "react";
import { View, Text, TextInput, FlatList, StyleSheet, BackHandler } from "react-native";
import { api } from "../api";
import { C, BOARD, FONTS, SAFE_X, SAFE_Y } from "../theme";
import Poster, { POSTER_W, POSTER_H, POSTER_GAP } from "../components/Poster";
import Huzme from "../components/Huzme";

// Arama: film ya da dizi adı yazılıyor (TV klavyesi ya da sesli giriş), sonuçlar afiş ızgarası.
// Yazmayı bırakınca 400 ms sonra film ve dizi aramaları birlikte gidiyor; eski yanıtlar yok sayılıyor.
const COLS = 6;

export default function SearchScreen({ auth, onOpen, onBack, hidden }) {
  const [q, setQ] = useState("");
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [lastId, setLastId] = useState(null); // detaydan dönünce odak bu afişe
  const seq = useRef(0);
  const inputRef = useRef(null);

  // Açılınca yazı alanına odak: TV klavyesi hemen açılıyor (hasTVPreferredFocus TextInput'ta her
  // cihazda işlemiyor).
  useEffect(() => {
    const t = setTimeout(() => inputRef.current?.focus(), 60);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    if (hidden) return undefined;
    const sub = BackHandler.addEventListener("hardwareBackPress", () => { onBack(); return true; });
    return () => sub.remove();
  }, [onBack, hidden]);

  useEffect(() => {
    const query = q.trim();
    if (query.length < 2) { setResults([]); setLoading(false); setError(null); return undefined; }
    setLoading(true);
    const t = setTimeout(() => {
      const my = ++seq.current;
      Promise.all([
        api.search(auth.token, query, "movie").catch(() => ({ results: [] })),
        api.search(auth.token, query, "tv").catch(() => ({ results: [] })),
      ]).then(([m, tv]) => {
        if (my !== seq.current) return;
        const lower = query.toLocaleLowerCase("tr-TR");
        const tier = (t) => { const x = String(t || "").toLocaleLowerCase("tr-TR"); return x === lower ? 0 : x.startsWith(lower) ? 1 : 2; };
        const seen = new Set();
        const merged = [...(m.results || []), ...(tv.results || [])]
          .filter((x) => x?.id != null && !seen.has(x.id) && seen.add(x.id))
          .sort((a, b) => tier(a.title) - tier(b.title) || Number(b.votes || 0) - Number(a.votes || 0))
          .slice(0, 30);
        setResults(merged);
        setError(null);
      }).catch(() => { if (my === seq.current) setError("Arama yapılamadı, tekrar dene."); })
        .finally(() => { if (my === seq.current) setLoading(false); });
    }, 400);
    return () => clearTimeout(t);
  }, [q, auth.token]);

  const onFocusItem = useCallback(() => {}, []);
  const onOpenItem = useCallback((movie) => { setLastId(movie.id); onOpen(movie, "search"); }, [onOpen]);
  const renderItem = useCallback(({ item, index }) => (
    <Poster movie={item} rowIndex={0} index={index} onFocusItem={onFocusItem} onOpenItem={onOpenItem} hasTVPreferredFocus={!hidden && item.id === lastId} />
  ), [onFocusItem, onOpenItem, hidden, lastId]);

  const empty = q.trim().length < 2
    ? "Film ya da dizi adını yaz. Kumandanın mikrofon tuşuyla sesle de arayabilirsin."
    : loading ? null : error || "Bununla eşleşen bir içerik bulamadık.";

  return (
    <View style={[styles.root, hidden && { display: "none" }]}>
      <Text style={styles.label}>ARA</Text>
      <TextInput
        ref={inputRef}
        value={q}
        onChangeText={setQ}
        placeholder="Film, dizi ara…"
        placeholderTextColor={C.dim}
        style={styles.input}
        autoCorrect={false}
        autoCapitalize="none"
        returnKeyType="search"
        hasTVPreferredFocus
        accessibilityLabel="Film ya da dizi ara"
      />
      {loading && !results.length ? (
        <Huzme compact label="ARANIYOR" />
      ) : results.length ? (
        <FlatList
          data={results}
          extraData={lastId}
          keyExtractor={(m) => String(m.id)}
          renderItem={renderItem}
          numColumns={COLS}
          getItemLayout={(_, i) => ({ length: POSTER_H + 20, offset: (POSTER_H + 20) * Math.floor(i / COLS), index: i })}
          initialNumToRender={12}
          windowSize={5}
          removeClippedSubviews
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.grid}
        />
      ) : (
        !!empty && <Text style={styles.empty}>{empty}</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { ...StyleSheet.absoluteFillObject, backgroundColor: C.bg, paddingTop: SAFE_Y + 8 },
  label: { fontFamily: FONTS.monoMedium, color: BOARD.gold, fontSize: 12, letterSpacing: 2, paddingHorizontal: SAFE_X },
  input: {
    marginHorizontal: SAFE_X, marginTop: 8, height: 54, borderRadius: 14, borderWidth: 2, borderColor: C.border,
    backgroundColor: C.surface, color: C.text, fontSize: 22, paddingHorizontal: 18, fontFamily: FONTS.marqueeBold, letterSpacing: 0.5,
  },
  grid: { paddingHorizontal: SAFE_X, paddingTop: 14, paddingBottom: 120, width: SAFE_X * 2 + COLS * (POSTER_W + POSTER_GAP) },
  empty: { color: C.dim, fontSize: 16, paddingHorizontal: SAFE_X, marginTop: 24, maxWidth: 620, lineHeight: 23 },
});
