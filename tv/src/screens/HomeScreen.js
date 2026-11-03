import React, { useCallback, useEffect, useRef, useState } from "react";
import * as RN from "react-native";
import { View, Text, Image, ScrollView, FlatList, StyleSheet, ActivityIndicator, Animated, AppState, BackHandler, Platform, findNodeHandle } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { api } from "../api";
import { C, FONTS, SAFE_X, SAFE_Y, upperTR } from "../theme";
import { platformLabel, watchAndDescribe } from "../platforms";
import Poster from "../components/Poster";
import FocusButton from "../components/FocusButton";
import SeansBoard, { TRAILER_DWELL_MS } from "../components/SeansBoard";

// Telefondaki ana ekranın TV hali. En üstte telefondaki "Bu akşam senin için" panosu, büyük:
// aynı günlük seçki, konusu ve "Netflix'te izle" düğmesiyle; içerikte 3 saniye durulunca fragmanı
// panonun ekranında oynuyor. Altında kumandayla gezilen satırlar; odak satırlara inince pano yukarı
// kayıyor ve üstte odaktaki afişin kısa tanıtımı çıkıyor. AI modu yok.

const PREVIEW_H = 190; // satırlardayken üstteki tanıtım şeridinin yüksekliği
const AUTO_ADVANCE_MS = 9000; // kumandaya dokunulmadıkça (fragmanı olmayan) seçimde sıradakine geçiş
const TRAILER_LOAD_TIMEOUT_MS = 12000; // oynatıcı bu sürede başlamazsa fragman yok sayılıyor
// Kumandaya hiç dokunulmazsa pano en fazla bu kadar fragman oynatıp bu kadar kez sıradakine geçiyor,
// sonra duruyor: kimse bakmıyorken TV'nin ekran koruyucusuna geçmesini engellemeyelim (Google
// Play TV kuralı: kullanıcının başlatmadığı oynatma ambient modu engellememeli).
const MAX_UNATTENDED_TRAILERS = 3;
const MAX_UNATTENDED_ADVANCES = 10;
const tagOf = (r) => (Platform.OS === "android" && r ? findNodeHandle(r) : null);

// Kumanda tuşları: TV'de react-native-tvos'un olay dinleyicisi; tarayıcı ön izlemesinde klavye.
function useWebKeys(handler) {
  useEffect(() => {
    const onKey = (e) => handler({ eventType: e.key });
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [handler]);
}
const useRemoteKeys = RN.useTVEventHandler || useWebKeys;

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

// Telefonun yazdığı seçki bugünün ya da dünün ise kullanılıyor. Daha eskiyse ya da hiç yoksa
// (telefon uygulaması güncel değil, ya da uzun süredir açılmadı) TV "Sana özel"in başından seçiyor.
function isFreshSlate(dayKey) {
  if (!dayKey) return false;
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  return dayKey === localDayKey() || dayKey === localDayKey(yesterday);
}

export default function HomeScreen({ auth, onOpen, onSignOut, preferred, hidden }) {
  const [rows, setRows] = useState([]);
  const [picks, setPicks] = useState([]); // [{ movie, reason }]
  const [pickIndex, setPickIndex] = useState(0);
  const [boardStatus, setBoardStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [preview, setPreview] = useState(null);
  const [zone, setZone] = useState("board"); // "board" | "rows"
  const [interacted, setInteracted] = useState(false);
  const previewIn = useRef(new Animated.Value(0)).current;
  const scrollRef = useRef(null);
  const rowY = useRef({});
  // Fragman: içerik id'si → { key } | null (yok). Henüz bakılmadıysa anahtar yok (undefined).
  const [trailers, setTrailers] = useState({});
  const requestedTrailers = useRef(new Set());
  // idle → waiting (3 sn) → loading → playing → done. Seçim değişince idle'a dönüyor.
  const [phase, setPhase] = useState("idle");
  const [appActive, setAppActive] = useState(AppState.currentState === "active" || AppState.currentState == null);
  const interactedRef = useRef(false);
  interactedRef.current = interacted;
  const phaseRef = useRef(phase);
  phaseRef.current = phase;
  const unattended = useRef({ trailers: 0, advances: 0 });
  const [resting, setResting] = useState(false); // dokunulmadan sınır doldu: pano duruyor
  // Android odak yolları için düğme kimlikleri (bkz. SeansBoard).
  const [signOutTag, setSignOutTag] = useState(null);
  const [primaryTag, setPrimaryTag] = useState(null);
  const signOutRef = useCallback((r) => { const t = tagOf(r); setSignOutTag((old) => (old === t ? old : t)); }, []);
  const onPrimaryTag = useCallback((t) => setPrimaryTag((old) => (old === t ? old : t)), []);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const safe = (p) => p.catch((e) => { if (e.status === 401) throw e; return { results: [] }; });
      const [m1, t1, trM, trT, m2, t2, hero] = await Promise.all([
        safe(api.movies(auth.token, "movie", 1)),
        safe(api.movies(auth.token, "tv", 1)),
        safe(api.trending(auth.token, "movie")),
        safe(api.trending(auth.token, "tv")),
        safe(api.movies(auth.token, "movie", 2)),
        safe(api.movies(auth.token, "tv", 2)),
        safe(api.homeHero(auth.token)),
      ]);
      const seen = new Set();
      const slate = isFreshSlate(hero.dayKey) ? uniq(hero.results || [], seen).slice(0, 10) : [];
      let forYou = uniq(interleave(m1.results, t1.results), seen);
      let nextPicks = slate.map((movie) => ({ movie, reason: movie.heroReason || null }));
      if (!nextPicks.length) {
        nextPicks = forYou.slice(0, 10).map((movie) => ({ movie, reason: null }));
        forYou = forYou.slice(10);
      }
      const more = uniq(interleave(m2.results, t2.results), seen).slice(0, 24);
      const popular = uniq(interleave(trM.results, trT.results)).slice(0, 20);
      setPicks(nextPicks);
      setPickIndex(0);
      setRows([
        { key: "forYou", title: "SANA ÖZEL", items: forYou.slice(0, 24) },
        { key: "popular", title: "ŞU AN POPÜLER", items: popular },
        { key: "more", title: "DAHA FAZLA ÖNERİ", items: more },
      ].filter((r) => r.items.length));
    } catch (e) {
      if (e.status === 401) { onSignOut(true); return; }
      setError(e.message || "Öneriler yüklenemedi.");
    } finally {
      setLoading(false);
    }
  }, [auth.token, onSignOut]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => { setBoardStatus(null); setPhase("idle"); }, [pickIndex]);
  // Platform uygulamasından geri dönünce izle düğmesinin durum yazısını temizle.
  useEffect(() => {
    const sub = AppState.addEventListener("change", (s) => {
      setAppActive(s === "active");
      if (s === "active") setBoardStatus(null);
    });
    return () => sub.remove();
  }, []);

  // Fragmanlar: o anki seçimin ve bir sonrakinin fragmanına önceden bakıyoruz.
  const pickAt = (i) => picks[((i % picks.length) + picks.length) % picks.length];
  useEffect(() => {
    if (!picks.length) return;
    [pickAt(pickIndex), pickAt(pickIndex + 1)].forEach((p) => {
      const id = p?.movie?.id;
      if (id == null || requestedTrailers.current.has(id)) return;
      requestedTrailers.current.add(id);
      api.trailer(auth.token, id)
        .then((r) => setTrailers((m) => ({ ...m, [id]: r.trailer?.key ? r.trailer : null })))
        .catch(() => setTrailers((m) => ({ ...m, [id]: null })));
    });
  }, [picks, pickIndex, auth.token]);

  const currentId = picks.length ? pickAt(pickIndex)?.movie?.id : null;
  const currentTrailer = currentId == null ? null : trailers[currentId];
  const canPlay = zone === "board" && !hidden && appActive;

  // Kumandanın herhangi bir tuşu: fragman oynuyorsa keser (pano geri gelir, o seçimde bir daha
  // kendiliğinden başlamaz); geri sayım sürüyorsa 3 saniyeyi baştan başlatır ("3 saniye
  // dokunulmazsa" kuralı). Hiç dokunulmadıysa pano kendi kendine sıradakine de geçiyor.
  const onRemoteKey = useCallback((evt) => {
    const type = evt?.eventType;
    if (!type || type === "focus" || type === "blur") return;
    setInteracted(true);
    setResting(false);
    const p = phaseRef.current;
    if (p === "playing" || p === "ready") setPhase("done");
    else if (p === "waiting" || p === "loading") setPhase("idle");
  }, []);
  useRemoteKeys(onRemoteKey);
  const onStopTrailer = useCallback(() => { setInteracted(true); setPhase("done"); }, []);

  // İçerikte 3 saniye durulunca fragman: pano görünürken (odak panoda, detay kapalı, uygulama önde).
  useEffect(() => {
    if (!canPlay) {
      setPhase((p) => (p === "waiting" || p === "loading" || p === "ready" || p === "playing" ? "idle" : p));
      return undefined;
    }
    if (phase === "idle" && currentTrailer?.key && !resting) setPhase("waiting");
    if (phase === "waiting") {
      const t = setTimeout(() => {
        if (!interactedRef.current) unattended.current.trailers += 1;
        setPhase("loading");
      }, TRAILER_DWELL_MS);
      return () => clearTimeout(t);
    }
    if (phase === "loading" || phase === "ready") {
      const t = setTimeout(() => onTrailerError(), TRAILER_LOAD_TIMEOUT_MS);
      return () => clearTimeout(t);
    }
    return undefined;
  }, [canPlay, phase, currentTrailer, resting]);

  // Kumandaya dokunulmadıkça pano 9 saniyede bir sıradakine geçiyor; kullanıcı bir şeye
  // dokunduğu an duruyor (izle düğmesi elinin altındayken içerik değişmesin).
  // Fragmanı olan seçimde geçiş fragman bitince oluyor (onTrailerEnded).
  useEffect(() => {
    if (interacted || resting || hidden || zone !== "board" || picks.length < 2) return undefined;
    if (currentTrailer === undefined || (currentTrailer?.key && phase !== "done")) return undefined;
    const timer = setTimeout(() => {
      if (unattended.current.advances >= MAX_UNATTENDED_ADVANCES) { setResting(true); return; }
      unattended.current.advances += 1;
      setPickIndex((i) => (i + 1) % picks.length);
    }, AUTO_ADVANCE_MS);
    return () => clearTimeout(timer);
  }, [interacted, resting, hidden, zone, picks.length, pickIndex, currentTrailer, phase]);

  // Oynatıcı panonun arkasında hazır: pano kalkıyor, alan tamamen görününce oynatma başlıyor.
  const onTrailerReady = useCallback(() => setPhase((p) => (p === "loading" ? "ready" : p)), []);
  const onTrailerPlaying = useCallback(() => setPhase((p) => (p === "loading" || p === "ready" ? "playing" : p)), []);
  // Fragman bitince afişe dönülüyor; kumandaya hiç dokunulmadıysa pano sıradakine geçiyor
  // (o da 3 saniye sonra kendi fragmanını oynatıyor). Dokunulmadan oynanan fragman sınırı
  // dolduysa pano duruyor.
  const onTrailerEnded = useCallback(() => {
    setPhase("done");
    if (interactedRef.current || picks.length < 2) return;
    if (unattended.current.trailers >= MAX_UNATTENDED_TRAILERS) { setResting(true); return; }
    unattended.current.advances += 1;
    setPickIndex((i) => (i + 1) % picks.length);
  }, [picks.length]);
  // Oynatılamayan fragman (YouTube'da gömülmeye kapalı vb.) bu oturumda "yok" sayılıyor.
  function onTrailerError() {
    if (currentId != null) setTrailers((m) => ({ ...m, [currentId]: null }));
    setPhase("done");
  }

  // Fragman oynarken (ya da başlamak üzereyken) geri tuşu yalnızca fragmanı durduruyor.
  useEffect(() => {
    if (hidden || !(phase === "waiting" || phase === "loading" || phase === "ready" || phase === "playing")) return undefined;
    const sub = BackHandler.addEventListener("hardwareBackPress", () => { setPhase("done"); return true; });
    return () => sub.remove();
  }, [hidden, phase]);

  useEffect(() => {
    Animated.timing(previewIn, { toValue: zone === "rows" ? 1 : 0, duration: 180, useNativeDriver: true }).start();
  }, [zone, previewIn]);

  // Odak değişince sistemin kendi kaydırması da çalışıyor; bizimki ondan sonra gelsin diye bir kare bekliyoruz.
  const scrollTo = useCallback((y) => {
    requestAnimationFrame(() => scrollRef.current?.scrollTo({ y: Math.max(0, y), animated: true }));
  }, []);

  const onFocusBoard = useCallback(() => {
    setZone("board");
    scrollTo(0);
  }, [scrollTo]);

  // Satır içinde ilerlerken de yeniden hizalıyoruz: sistemin odak kaydırması yarım kalmış bir
  // kaydırmayı kesebiliyor. Satır, üstteki tanıtım şeridinin hemen altına oturuyor.
  const onFocusPoster = useCallback((movie, rowIndex) => {
    setPreview(movie);
    setZone("rows");
    setInteracted(true);
    scrollTo((rowY.current[rowIndex] || 0) - PREVIEW_H);
  }, [scrollTo]);

  // Fragman oynarken pano 16:9'a uzuyor; sayfayı panonun tamamı ekrana sığacak kadar kaydırıyoruz
  // (üst kenarı güvenli alanın başına). Fragman bitince başa dönülüyor.
  const boardY = useRef(0);
  const topBarIn = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    const revealed = phase === "ready" || phase === "playing";
    if (revealed) scrollTo(boardY.current - SAFE_Y);
    else if (zone === "board") scrollTo(0);
    // Kayınca yarım kalan üst çubuk (logo, Çıkış) fragman boyunca gizli.
    Animated.timing(topBarIn, { toValue: revealed ? 0 : 1, duration: 300, useNativeDriver: true }).start();
  }, [phase, zone, scrollTo, topBarIn]);

  // İzle'ye basınca fragman susuyor ve o seçimde bir daha kendiliğinden başlamıyor.
  const onWatch = useCallback((movie, link) => { setPhase("done"); setBoardStatus(watchAndDescribe(link)); }, []);

  // Marka adları düz büyük harf (NETFLIX, PRIME VIDEO), Türkçe İ değil.
  const previewPlatforms = (preview?.platforms || []).map((p) => platformLabel(p.name).name.toUpperCase()).join("  ·  ");
  const previewMeta = preview ? [preview.type, preview.year, preview.imdb ? `IMDb ${preview.imdb}` : null].filter(Boolean).join("  ·  ") : "";
  const pick = picks[Math.min(pickIndex, Math.max(0, picks.length - 1))];
  const boardPreferred = preferred ? preferred.row === "board" : true;

  const topBar = (
    <Animated.View style={[styles.topBar, { opacity: topBarIn }]}>
      <Text style={styles.logo}>pellix</Text>
      <View style={styles.topRight}>
        {!!auth.user?.name && <Text style={styles.user}>{upperTR(auth.user.name)}</Text>}
        <FocusButton
          ref={signOutRef}
          label="Çıkış"
          onPress={() => onSignOut(false)}
          onFocus={() => { setZone("board"); scrollTo(0); }}
          nextFocusDown={picks.length ? primaryTag : null}
          style={styles.signOut}
        />
      </View>
    </Animated.View>
  );

  return (
    <View style={[styles.root, hidden && { display: "none" }]}>
      {loading && !rows.length && !picks.length ? (
        <>{topBar}<ActivityIndicator color={C.accent} style={{ marginTop: 80 }} /></>
      ) : error ? (
        <>
          {topBar}
          <View style={styles.errorBox}>
            <Text style={styles.error}>{error}</Text>
            <FocusButton label="Tekrar dene" onPress={load} primary hasTVPreferredFocus style={{ marginTop: 12 }} />
          </View>
        </>
      ) : (
        <ScrollView ref={scrollRef} style={styles.scroll} contentContainerStyle={{ paddingBottom: 320 }} showsVerticalScrollIndicator={false}>
          <View style={styles.boardSection}>
            {!!pick?.movie.poster && (
              <View style={StyleSheet.absoluteFill} pointerEvents="none">
                <Image source={{ uri: pick.movie.poster }} style={[StyleSheet.absoluteFill, { opacity: 0.32 }]} blurRadius={24} resizeMode="cover" />
                <LinearGradient colors={["rgba(20,18,26,0.35)", C.bg]} locations={[0.35, 1]} style={StyleSheet.absoluteFill} />
              </View>
            )}
            {topBar}
            {!!picks.length && (
              <View style={styles.boardWrap} onLayout={(e) => { boardY.current = e.nativeEvent.layout.y; }}>
                <SeansBoard
                  selections={picks}
                  index={pickIndex}
                  onIndexChange={setPickIndex}
                  onOpen={(m) => onOpen(m, "board")}
                  onWatch={onWatch}
                  onFocusBoard={onFocusBoard}
                  onInteract={() => setInteracted(true)}
                  status={boardStatus}
                  preferredFocus={boardPreferred}
                  trailer={currentTrailer}
                  phase={phase}
                  onTrailerReady={onTrailerReady}
                  onTrailerPlaying={onTrailerPlaying}
                  onTrailerEnded={onTrailerEnded}
                  onTrailerError={onTrailerError}
                  onStopTrailer={onStopTrailer}
                  upTag={signOutTag}
                  onPrimaryTag={onPrimaryTag}
                />
              </View>
            )}
          </View>

          {rows.map((row, rowIndex) => (
            <View key={row.key} style={styles.row} onLayout={(e) => { rowY.current[rowIndex] = e.nativeEvent.layout.y; }}>
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
                    onFocusMovie={(m) => onFocusPoster(m, rowIndex)}
                    onOpen={(m) => onOpen(m, row.key)}
                    hasTVPreferredFocus={preferred
                      ? (preferred.row === row.key && preferred.id === item.id)
                      : !picks.length && rowIndex === 0 && index === 0}
                  />
                )}
              />
            </View>
          ))}
        </ScrollView>
      )}

      {/* Satırlardayken üstte odaktaki afişin kısa tanıtımı (pano yukarı kaymış oluyor). */}
      <Animated.View pointerEvents="none" style={[styles.preview, { opacity: previewIn }]}>
        {!!preview?.poster && (
          <View style={styles.previewArt}>
            <Image source={{ uri: preview.poster }} style={[StyleSheet.absoluteFill, { opacity: 0.7 }]} blurRadius={6} resizeMode="cover" />
            <LinearGradient colors={[C.bg, "rgba(20,18,26,0.6)", "rgba(20,18,26,0)"]} locations={[0, 0.35, 1]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={StyleSheet.absoluteFill} />
            <LinearGradient colors={["rgba(20,18,26,0)", C.bg]} locations={[0.55, 1]} start={{ x: 0, y: 0 }} end={{ x: 0, y: 1 }} style={StyleSheet.absoluteFill} />
          </View>
        )}
        {!!preview && (
          <View style={styles.previewText}>
            <Text style={styles.previewMeta}>{upperTR(previewMeta)}</Text>
            <Text style={styles.previewTitle} numberOfLines={1}>{preview.title}</Text>
            {!!preview.overview && <Text style={styles.previewOverview} numberOfLines={2}>{preview.overview}</Text>}
            {!!previewPlatforms && <Text style={styles.previewPlatforms}>{previewPlatforms}</Text>}
          </View>
        )}
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },
  scroll: { flex: 1 },
  boardSection: { paddingBottom: 18 },
  boardWrap: { paddingHorizontal: SAFE_X, marginTop: 12 },
  topBar: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: SAFE_X, paddingTop: SAFE_Y },
  logo: { fontFamily: FONTS.logo, fontSize: 26, color: C.text },
  topRight: { flexDirection: "row", alignItems: "center", gap: 14 },
  user: { fontFamily: FONTS.monoMedium, color: C.dim, fontSize: 12, letterSpacing: 1.5 },
  signOut: { minHeight: 34, paddingHorizontal: 16 },
  row: { marginTop: 6 },
  rowTitle: { fontFamily: FONTS.monoMedium, color: C.dim, fontSize: 12, letterSpacing: 2, paddingHorizontal: SAFE_X, marginBottom: 2 },
  preview: { position: "absolute", top: 0, left: 0, right: 0, height: PREVIEW_H, backgroundColor: C.bg },
  previewArt: { position: "absolute", top: 0, right: 0, bottom: 0, width: "62%" },
  previewText: { paddingHorizontal: SAFE_X, paddingTop: SAFE_Y + 4, maxWidth: 600 },
  previewMeta: { fontFamily: FONTS.monoMedium, color: C.accent, fontSize: 12, letterSpacing: 1.5 },
  previewTitle: { fontFamily: FONTS.marquee, color: C.text, fontSize: 44, lineHeight: 48, marginTop: 4 },
  previewOverview: { color: C.text, opacity: 0.82, fontSize: 15, lineHeight: 21, marginTop: 4 },
  previewPlatforms: { fontFamily: FONTS.monoMedium, color: C.dim, fontSize: 12, letterSpacing: 1.5, marginTop: 8 },
  errorBox: { paddingHorizontal: SAFE_X, marginTop: 30, alignItems: "flex-start" },
  error: { color: C.danger, fontSize: 16 },
});
