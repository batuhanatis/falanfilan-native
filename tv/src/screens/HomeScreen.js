import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { View, Text, FlatList, StyleSheet, Platform, findNodeHandle } from "react-native";
import { api } from "../api";
import { C, FONTS, SAFE_X, SAFE_Y, TOPBAR_H, HERO_H, PREVIEW_H, upperTR } from "../theme";
import { focusStore } from "../focusStore";
import Hero from "../components/Hero";
import Row, { ROW_H } from "../components/Row";
import PreviewHeader from "../components/PreviewHeader";
import FocusButton from "../components/FocusButton";
import Huzme from "../components/Huzme";

// Telefondaki ana ekranın TV hali:
// - En üstte pano (Hero): telefondaki "Bu akşam senin için" seçkisi, sol/sağ ile filmler arası.
// - Altında satırlar: telefondaki "Sana özel" ve "Şu an popüler", sonra TV'ye özel 15-20 kişisel
//   satır (/api/tv/rows: izleme listesi, "Sevdiğin X gibi", "Korku sevdiğin için", platformlar...).
//   En altta "Başa dön".
// Akıcılık için: dikey ve yatay listeler sanallaştırılmış, satır yükseklikleri sabit (ölçmeden
// kaydırılıyor), odaktaki afişin tanıtımı ayrı bir bileşende (afiş değişince yalnız o çiziliyor),
// bulanık görsel yok.

const HEADER_H = TOPBAR_H + HERO_H + 22;

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

function localDayKey(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

// Telefonun yazdığı seçki bugünün ya da dünün ise kullanılıyor; değilse TV "Sana özel"in başından seçiyor.
function isFreshSlate(dayKey) {
  if (!dayKey) return false;
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  return dayKey === localDayKey() || dayKey === localDayKey(yesterday);
}

const tagOf = (r) => (Platform.OS === "android" && r ? findNodeHandle(r) : null);

export default function HomeScreen({ auth, onOpen, onSignOut, onSearch, preferred, hidden }) {
  const [picks, setPicks] = useState([]);
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [zone, setZone] = useState("board"); // "board" | "rows"
  const [heroTags, setHeroTags] = useState({});
  const [searchTag, setSearchTag] = useState(null);
  const listRef = useRef(null);
  const heroRef = useRef(null);
  const rowsRef = useRef(rows);
  rowsRef.current = rows;
  const searchBtn = useRef(null);
  const searchRefCb = useCallback((r) => {
    if (r) searchBtn.current = r;
    const t = tagOf(r);
    if (t) setSearchTag((old) => (old === t ? old : t));
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const safe = (p) => p.catch((e) => { if (e.status === 401) throw e; return { results: [], rows: [] }; });
      const [m1, t1, trM, trT, hero, tv] = await Promise.all([
        safe(api.movies(auth.token, "movie", 1)),
        safe(api.movies(auth.token, "tv", 1)),
        safe(api.trending(auth.token, "movie")),
        safe(api.trending(auth.token, "tv")),
        safe(api.homeHero(auth.token)),
        safe(api.tvRows(auth.token)),
      ]);
      const seen = new Set();
      const slate = isFreshSlate(hero.dayKey) ? uniq(hero.results || [], seen).slice(0, 10) : [];
      let forYou = uniq(interleave(m1.results, t1.results), seen);
      let nextPicks = slate.map((movie) => ({ movie, reason: movie.heroReason || null }));
      if (!nextPicks.length) {
        nextPicks = forYou.slice(0, 10).map((movie) => ({ movie, reason: null }));
        forYou = forYou.slice(10);
      }
      const popular = uniq(interleave(trM.results, trT.results)).slice(0, 20);
      setPicks(nextPicks);
      setRows([
        { key: "forYou", title: "Sana özel", items: forYou.slice(0, 24) },
        { key: "popular", title: "Şu an popüler", items: popular },
        ...(tv.rows || []),
      ].filter((r) => r.items?.length));
    } catch (e) {
      if (e.status === 401) { onSignOut(true); return; }
      setError(e.message || "Öneriler yüklenemedi.");
    } finally {
      setLoading(false);
    }
  }, [auth.token, onSignOut]);

  useEffect(() => { load(); }, [load]);

  // Arama ya da detaydan dönünce odak geldiği yere: "Ara" düğmesi ya da pano. (Afişe dönüş
  // Poster'ın hasTVPreferredFocus'u ile.)
  useEffect(() => {
    if (hidden || !preferred) return undefined;
    const target = preferred.row === "search" ? searchBtn.current : preferred.row === "board" ? heroRef.current : null;
    if (!target) return undefined;
    const id = requestAnimationFrame(() => {
      if (target.requestTVFocus) target.requestTVFocus();
      else target.focus?.();
    });
    return () => cancelAnimationFrame(id);
  }, [hidden, preferred]);

  const scrollTo = useCallback((offset) => {
    requestAnimationFrame(() => listRef.current?.scrollToOffset({ offset: Math.max(0, offset), animated: true }));
  }, []);

  const onHeroFocus = useCallback(() => { setZone("board"); scrollTo(0); }, [scrollTo]);
  // Afiş odağa gelince: tanıtım şeridi güncellenir, satır şeridin hemen altına oturur.
  const onFocusItem = useCallback((movie, rowIndex) => {
    focusStore.set(movie);
    setZone("rows");
    scrollTo(HEADER_H + rowIndex * ROW_H - PREVIEW_H);
  }, [scrollTo]);
  const onOpenItem = useCallback((movie, rowIndex) => onOpen(movie, rowsRef.current[rowIndex]?.key), [onOpen]);
  const backToTop = useCallback(() => { scrollTo(0); setZone("board"); heroRef.current?.focus(); }, [scrollTo]);

  const header = useMemo(() => (
    <View style={styles.header}>
      <View style={styles.topBar}>
        <Text style={styles.logo}>pellix</Text>
        <View style={styles.topRight}>
          <FocusButton
            ref={searchRefCb}
            label="⌕  Ara"
            compact
            onPress={onSearch}
            onFocus={onHeroFocus}
            nextFocusDown={heroTags.catcher}
            style={styles.topBtn}
          />
          {!!auth.user?.name && <Text style={styles.user}>{upperTR(auth.user.name)}</Text>}
          <FocusButton label="Çıkış" compact onPress={() => onSignOut(false)} onFocus={onHeroFocus} nextFocusDown={heroTags.catcher} style={styles.topBtn} />
        </View>
      </View>
      {!!picks.length && (
        <View style={styles.heroWrap}>
          <Hero
            ref={heroRef}
            picks={picks}
            token={auth.token}
            active={zone === "board" && !hidden}
            onOpen={(m) => onOpen(m, "board")}
            upTag={searchTag}
            onHeroFocus={onHeroFocus}
            onTags={setHeroTags}
            preferredFocus={preferred ? preferred.row === "board" : true}
          />
        </View>
      )}
    </View>
  ), [picks, zone, hidden, auth, onOpen, onSearch, onSignOut, onHeroFocus, preferred, heroTags.catcher, searchTag, searchRefCb]);

  const renderRow = useCallback(({ item, index }) => (
    <Row
      row={item}
      rowIndex={index}
      onFocusItem={onFocusItem}
      onOpenItem={onOpenItem}
      preferredId={preferred && preferred.row === item.key ? preferred.id : null}
      upTag={index === 0 ? heroTags.catcher : null}
    />
  ), [onFocusItem, onOpenItem, preferred, heroTags.catcher]);

  const footer = useMemo(() => (
    <View style={styles.footer}>
      <FocusButton label="▲  Başa dön" onPress={backToTop} />
    </View>
  ), [backToTop]);

  if (loading && !rows.length && !picks.length) {
    return <View style={[styles.root, hidden && styles.hidden]}><Huzme /></View>;
  }

  return (
    <View style={[styles.root, hidden && styles.hidden]}>
      {error && !rows.length ? (
        <View style={styles.errorBox}>
          <Text style={styles.error}>{error}</Text>
          <FocusButton label="Tekrar dene" onPress={load} primary hasTVPreferredFocus style={{ marginTop: 12 }} />
        </View>
      ) : (
        <FlatList
          ref={listRef}
          data={rows}
          keyExtractor={(r) => r.key}
          renderItem={renderRow}
          ListHeaderComponent={header}
          ListFooterComponent={footer}
          getItemLayout={(_, i) => ({ length: ROW_H, offset: HEADER_H + ROW_H * i, index: i })}
          initialNumToRender={3}
          maxToRenderPerBatch={2}
          windowSize={5}
          removeClippedSubviews
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.list}
        />
      )}
      <PreviewHeader visible={zone === "rows" && !hidden} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },
  hidden: { display: "none" },
  header: { height: HEADER_H },
  topBar: { height: TOPBAR_H, flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: SAFE_X, paddingTop: SAFE_Y - 8 },
  logo: { fontFamily: FONTS.logo, fontSize: 26, color: C.text },
  topRight: { flexDirection: "row", alignItems: "center", gap: 12 },
  topBtn: { minHeight: 34, paddingHorizontal: 16 },
  user: { fontFamily: FONTS.monoMedium, color: C.dim, fontSize: 12, letterSpacing: 1.5 },
  heroWrap: { paddingHorizontal: SAFE_X, marginTop: 4 },
  list: { paddingBottom: 540 - PREVIEW_H - ROW_H },
  footer: { height: 90, paddingHorizontal: SAFE_X, justifyContent: "center", alignItems: "flex-start" },
  errorBox: { paddingHorizontal: SAFE_X, marginTop: 80, alignItems: "flex-start" },
  error: { color: C.danger, fontSize: 16 },
});
