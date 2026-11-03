import React, { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from "react";
import { View, Text, Pressable, Animated, Easing, StyleSheet, BackHandler, AppState, Platform, findNodeHandle } from "react-native";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { api } from "../api";
import { BOARD, FONTS, HERO_H, HERO_W, HERO_MEDIA_W, upperTR } from "../theme";
import FocusButton from "./FocusButton";
import TrailerHost from "./TrailerHost";
import { primaryWatchLink, watchButtonLabel, watchAndDescribe, openTrailerInYouTube } from "../platforms";
import { useRemoteKeys, isKeyPress } from "../remoteKeys";

// Ana ekranın en üstü: telefondaki "Bu akşam senin için" seçkisi, seans panosu gibi.
// - Pano odaktayken sol/sağ doğrudan filmler arasında geçiyor; aşağı ya da OK düğmelere giriyor,
//   düğmelerden yukarı panoya dönüyor.
// - Solda başlık levhası, künye, konu, gerekçe ve düğmeler; sağda 16:9 alan: filmin yatay görseli,
//   3 saniye kumandaya dokunulmazsa aynı alanda fragman. Ekrandaki başka hiçbir şey kıpırdamıyor.
// - Fragman kendiliğinden başlamıyor: oynatıcı arkada hazırlanıyor, görsel kalkıp oynatıcı tamamen
//   görününce oynatma başlıyor; oynatıcının önüne hiçbir şey çizilmiyor (YouTube kuralları).
// - Kumandaya hiç dokunulmazsa en fazla 3 fragman oynayıp 10 kez sıradakine geçiyor, sonra duruyor
//   (kimse bakmazken TV ekran koruyucusuna geçebilsin).

const DWELL_MS = 3000;
const LOAD_TIMEOUT_MS = 12000;
const AUTO_ADVANCE_MS = 9000;
const MAX_UNATTENDED_TRAILERS = 3;
const MAX_UNATTENDED_ADVANCES = 10;
const INFO_W = HERO_W - HERO_MEDIA_W;

const tagOf = (r) => (Platform.OS === "android" && r ? findNodeHandle(r) : null);
const focusView = (r) => { if (r?.requestTVFocus) r.requestTVFocus(); else r?.focus?.(); };
const plateTitle = (m) => (String(m?.originalLanguage || "").toLowerCase() === "tr" ? upperTR(m?.title) : String(m?.title || "").toUpperCase());
const metaLine = (m) => [m.genre, m.type, m.year, m.imdb ? `IMDb ${m.imdb}` : null].filter(Boolean).map((x) => upperTR(x)).join("  ·  ");

const Hero = forwardRef(function Hero({ picks, token, active, onOpen, upTag, onHeroFocus, onTags, preferredFocus }, ref) {
  const count = picks.length;
  const [index, setIndex] = useState(0);
  const [shown, setShown] = useState(0);
  const [media, setMedia] = useState({}); // id → { trailer, backdrop } (bakılmadıysa yok)
  const [phase, setPhase] = useState("idle"); // idle | waiting | loading | ready | playing | done
  const [status, setStatus] = useState(null);
  const [heroFocused, setHeroFocused] = useState(false);
  const [interacted, setInteracted] = useState(false);
  const [resting, setResting] = useState(false);
  const [appActive, setAppActive] = useState(AppState.currentState === "active" || AppState.currentState == null);
  const [tags, setTags] = useState({ catcher: null, primary: null, last: null });

  const catcherRef = useRef(null);
  const primaryRef = useRef(null);
  const trailerBtnRef = useRef(null);
  const detailRef = useRef(null);
  const trailerRef = useRef(null);
  const requested = useRef(new Set());
  const heroFocusedRef = useRef(false);
  const interactedRef = useRef(false);
  interactedRef.current = interacted;
  const phaseRef = useRef(phase);
  phaseRef.current = phase;
  const countRef = useRef(count);
  countRef.current = count;
  const unattended = useRef({ trailers: 0, advances: 0 });
  const flip = useRef(new Animated.Value(1)).current;
  const art = useRef(new Animated.Value(1)).current;

  useImperativeHandle(ref, () => ({ focus: () => focusView(catcherRef.current) }), []);

  // Yeni seçki gelince başa.
  useEffect(() => { setIndex(0); setShown(0); }, [picks]);

  useEffect(() => {
    const sub = AppState.addEventListener("change", (s) => { setAppActive(s === "active"); if (s === "active") setStatus(null); });
    return () => sub.remove();
  }, []);

  // Seçim değişince levha dönüyor (yalnız transform/opacity): yarıda yeni içerik yazılıyor.
  useEffect(() => {
    if (index === shown) return;
    Animated.timing(flip, { toValue: 0, duration: 110, easing: Easing.in(Easing.quad), useNativeDriver: true }).start(({ finished }) => {
      if (!finished) return; // art arda basıldı: en son seçimin animasyonu yazacak
      setShown(index);
      Animated.timing(flip, { toValue: 1, duration: 180, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start();
    });
  }, [index, shown, flip]);

  const pick = picks[Math.min(shown, Math.max(0, count - 1))];
  const movie = pick?.movie;
  const cur = movie ? media[movie.id] : undefined;
  const trailerKey = cur?.trailer?.key || null;

  // Görsel ve fragman: o anki ve bir sonraki seçim için önceden.
  useEffect(() => {
    if (!count) return;
    [picks[index], picks[(index + 1) % count]].forEach((p) => {
      const id = p?.movie?.id;
      if (id == null || requested.current.has(id)) return;
      requested.current.add(id);
      api.trailer(token, id)
        .then((r) => setMedia((m) => ({ ...m, [id]: { trailer: r.trailer?.key ? r.trailer : null, backdrop: r.backdrop || null } })))
        .catch(() => setMedia((m) => ({ ...m, [id]: { trailer: null, backdrop: null } })));
    });
  }, [picks, index, count, token]);

  // Oynatıcıyı ana ekran açıldıktan biraz sonra arkada hazırla: ilk fragman beklemesin.
  useEffect(() => {
    if (!active) return undefined;
    const t = setTimeout(() => trailerRef.current?.warm(), 1500);
    return () => clearTimeout(t);
  }, [active]);

  const canPlay = active && appActive;
  const stopTrailer = useCallback(() => trailerRef.current?.stop(), []);

  // Seçim değişince fragman durur, geri sayım baştan.
  useEffect(() => { setPhase("idle"); setStatus(null); stopTrailer(); }, [shown, stopTrailer]);

  const onTrailerError = useCallback(() => {
    if (movie) setMedia((m) => ({ ...m, [movie.id]: { ...(m[movie.id] || {}), trailer: null } }));
    stopTrailer();
    setPhase("done");
  }, [movie, stopTrailer]);

  // 3 saniye dokunulmazsa fragman (pano görünürken: odak panoda, detay kapalı, uygulama önde).
  useEffect(() => {
    if (!canPlay) {
      if (["waiting", "loading", "ready", "playing"].includes(phase)) { stopTrailer(); setPhase("idle"); }
      return undefined;
    }
    if (phase === "idle" && trailerKey && !resting) { setPhase("waiting"); return undefined; }
    if (phase === "waiting") {
      const t = setTimeout(() => {
        if (!interactedRef.current) unattended.current.trailers += 1;
        trailerRef.current?.cue(trailerKey);
        setPhase("loading");
      }, DWELL_MS);
      return () => clearTimeout(t);
    }
    if (phase === "loading" || phase === "ready") {
      const t = setTimeout(onTrailerError, LOAD_TIMEOUT_MS);
      return () => clearTimeout(t);
    }
    return undefined;
  }, [canPlay, phase, trailerKey, resting, stopTrailer, onTrailerError]);

  // Görsel katmanı: oynatıcı hazır olunca kalkıyor, tamamen kalkınca oynatma başlıyor; fragman
  // bitince/kesilince görsel geri geliyor, sonra oynatıcı durduruluyor.
  useEffect(() => {
    const showVideo = phase === "ready" || phase === "playing";
    Animated.timing(art, { toValue: showVideo ? 0 : 1, duration: showVideo ? 420 : 240, useNativeDriver: true })
      .start(({ finished }) => {
        if (!finished) return;
        if (phase === "ready" && phaseRef.current === "ready") trailerRef.current?.play();
      });
  }, [phase, art]);

  const onTrailerEvent = useCallback(({ type, value }) => {
    const key = typeof value === "string" ? value : value?.key;
    if (key && key !== trailerKey) return; // önceki filmden gecikmiş olay
    const p = phaseRef.current;
    if (type === "cued" && p === "loading") setPhase("ready");
    else if (type === "playing" && (p === "loading" || p === "ready")) setPhase("playing");
    else if (type === "ended") {
      setPhase("done");
      if (interactedRef.current || countRef.current < 2) return;
      if (unattended.current.trailers >= MAX_UNATTENDED_TRAILERS) { setResting(true); return; }
      unattended.current.advances += 1;
      setIndex((i) => (i + 1) % countRef.current);
    } else if (type === "error") onTrailerError();
  }, [trailerKey, onTrailerError]);

  // Dokunulmadıkça, fragmanı olmayan seçimde 9 saniyede bir sıradakine geç.
  useEffect(() => {
    if (interacted || resting || !canPlay || count < 2) return undefined;
    if (cur === undefined || (trailerKey && phase !== "done")) return undefined;
    const t = setTimeout(() => {
      if (unattended.current.advances >= MAX_UNATTENDED_ADVANCES) { setResting(true); return; }
      unattended.current.advances += 1;
      setIndex((i) => (i + 1) % count);
    }, AUTO_ADVANCE_MS);
    return () => clearTimeout(t);
  }, [interacted, resting, canPlay, count, shown, cur, trailerKey, phase]);

  // Kumanda: pano odaktayken sol/sağ film değiştirir. Başka tuşlar geri sayımı baştan başlatır;
  // fragman oynarken düğmeler arasında gezmek onu durdurmaz.
  const onKey = useCallback((evt) => {
    if (!isKeyPress(evt)) return;
    setInteracted(true);
    setResting(false);
    const type = evt.eventType;
    if (heroFocusedRef.current && (type === "left" || type === "right") && countRef.current > 1) {
      setIndex((i) => (i + (type === "right" ? 1 : -1) + countRef.current) % countRef.current);
      return;
    }
    const p = phaseRef.current;
    if (p === "waiting") setPhase("idle");
    else if (p === "loading" || p === "ready") { stopTrailer(); setPhase("idle"); }
  }, [stopTrailer]);
  useRemoteKeys(onKey);

  // Geri tuşu fragmanı durduruyor (oynamıyorsa sistemin varsayılanı).
  useEffect(() => {
    if (!active || !["loading", "ready", "playing"].includes(phase)) return undefined;
    const sub = BackHandler.addEventListener("hardwareBackPress", () => { stopTrailer(); setPhase("done"); return true; });
    return () => sub.remove();
  }, [active, phase, stopTrailer]);

  // Android odak yolları: pano odağı sol/sağda kendinde kalıyor (oynatıcıya kaçmasın), aşağı ilk
  // düğmeye, yukarı üst çubuğa; en sağdaki düğmeden sağa hiçbir yere.
  const link = movie ? primaryWatchLink(movie) : null;
  const buttonRefs = [primaryRef, ...(trailerKey ? [trailerBtnRef] : []), ...(link ? [detailRef] : [])];
  const lastRef = buttonRefs[buttonRefs.length - 1];
  useEffect(() => {
    const next = { catcher: tagOf(catcherRef.current), primary: tagOf(primaryRef.current), last: tagOf(lastRef.current) };
    if (next.catcher !== tags.catcher || next.primary !== tags.primary || next.last !== tags.last) {
      setTags(next);
      onTags?.(next);
    }
  });

  if (!movie) return null;
  const counter = `${String(shown + 1).padStart(2, "0")}/${String(count).padStart(2, "0")}`;
  const watch = () => { setInteracted(true); stopTrailer(); setPhase("done"); setStatus(watchAndDescribe(link)); };
  const openTrailer = () => { setInteracted(true); stopTrailer(); setPhase("done"); setStatus(openTrailerInYouTube(trailerKey)); };
  const plateScale = flip.interpolate({ inputRange: [0, 1], outputRange: [0.05, 1] });

  return (
    <View style={[styles.frame, heroFocused && styles.frameFocused]}>
      <View style={styles.hero}>
        <View style={styles.info}>
          <Text style={styles.label} numberOfLines={1}>
            {heroFocused && count > 1 ? "‹  " : ""}BU AKŞAM SENİN İÇİN  ·  {counter}{heroFocused && count > 1 ? "  ›" : ""}
          </Text>
          <Animated.View style={[styles.plate, { transform: [{ scaleY: plateScale }] }]}>
            <Text style={styles.plateText} numberOfLines={2} adjustsFontSizeToFit minimumFontScale={0.75}>{plateTitle(movie)}</Text>
            <View style={styles.seam} />
          </Animated.View>
          <Animated.View style={{ opacity: flip }}>
            <Text style={styles.meta} numberOfLines={1}>{metaLine(movie)}</Text>
            {!!movie.overview && <Text style={styles.overview} numberOfLines={2}>{movie.overview}</Text>}
            {status
              ? <Text style={[styles.reason, status.tone === "error" && { color: "#e58a93" }]} numberOfLines={1}>{status.text}</Text>
              : !!pick.reason && <Text style={styles.reason} numberOfLines={1}>{pick.reason}</Text>}
          </Animated.View>

          {/* Pano odağı: görünmez, bilgi alanının üst kısmını kaplıyor (oynatıcının önüne gelmiyor). */}
          <Pressable
            ref={catcherRef}
            hasTVPreferredFocus={preferredFocus}
            onFocus={() => { heroFocusedRef.current = true; setHeroFocused(true); onHeroFocus?.(); }}
            onBlur={() => { heroFocusedRef.current = false; setHeroFocused(false); }}
            onPress={() => focusView(primaryRef.current)}
            accessibilityRole="button"
            accessibilityLabel={`${movie.title}. Sağ ve sol tuşlarla diğer öneriler, aşağı ile düğmeler.`}
            style={styles.catcher}
            {...(tags.catcher ? { nextFocusLeft: tags.catcher, nextFocusRight: tags.catcher } : null)}
            {...(tags.primary ? { nextFocusDown: tags.primary } : null)}
            {...(upTag ? { nextFocusUp: upTag } : null)}
          />

          {/* Düğmeler sabit anahtarlı: içerik değişince odaktaki düğme yeniden kurulmasın. */}
          <View style={styles.actions}>
            <FocusButton
              key="primary"
              ref={primaryRef}
              label={link ? `▶ ${watchButtonLabel(link)}` : "Detayı aç"}
              primary
              compact
              onFocus={onHeroFocus}
              onPress={link ? watch : () => onOpen(movie)}
              nextFocusUp={tags.catcher}
              nextFocusRight={lastRef === primaryRef ? tags.last : null}
              style={styles.btn}
            />
            {!!trailerKey && (
              <FocusButton
                key="trailer"
                ref={trailerBtnRef}
                label="Fragman"
                compact
                onFocus={onHeroFocus}
                onPress={openTrailer}
                nextFocusUp={tags.catcher}
                nextFocusRight={lastRef === trailerBtnRef ? tags.last : null}
                style={styles.btn}
              />
            )}
            {!!link && (
              <FocusButton
                key="detail"
                ref={detailRef}
                label="Detay"
                compact
                onFocus={onHeroFocus}
                onPress={() => onOpen(movie)}
                nextFocusUp={tags.catcher}
                nextFocusRight={tags.last}
                style={styles.btn}
              />
            )}
          </View>
        </View>

        <View style={styles.media}>
          <TrailerHost ref={trailerRef} onEvent={onTrailerEvent} />
          <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.art, { opacity: art }]}>
            {cur?.backdrop
              ? <Image source={cur.backdrop} style={StyleSheet.absoluteFill} contentFit="cover" transition={250} cachePolicy="memory-disk" />
              : !!movie.poster && <Image source={movie.poster} style={StyleSheet.absoluteFill} contentFit="contain" transition={250} cachePolicy="memory-disk" />}
            <LinearGradient colors={[BOARD.bg, "rgba(13,11,10,0)"]} start={{ x: 0, y: 0 }} end={{ x: 0.35, y: 0 }} style={StyleSheet.absoluteFill} />
          </Animated.View>
        </View>
      </View>
    </View>
  );
});

export default Hero;

const styles = StyleSheet.create({
  frame: { width: HERO_W + 6, height: HERO_H + 6, padding: 2, borderRadius: 22, borderWidth: 1, borderColor: "transparent", marginLeft: -3 },
  frameFocused: { borderColor: BOARD.gold },
  hero: { width: HERO_W, height: HERO_H, borderRadius: 18, overflow: "hidden", backgroundColor: BOARD.bg, flexDirection: "row" },
  info: { width: INFO_W, height: HERO_H, paddingLeft: 24, paddingRight: 20, paddingTop: 18 },
  label: { fontFamily: FONTS.monoMedium, fontSize: 11.5, color: BOARD.gold, letterSpacing: 1.4 },
  plate: {
    height: 84, marginTop: 10, borderRadius: 6, backgroundColor: BOARD.plate, justifyContent: "center", paddingHorizontal: 12,
    borderWidth: 1, borderColor: BOARD.border,
  },
  plateText: { fontFamily: FONTS.marquee, fontSize: 31, lineHeight: 34, color: BOARD.ink, letterSpacing: 0.6 },
  seam: { position: "absolute", left: 0, right: 0, top: 41, height: 1, backgroundColor: BOARD.seam, opacity: 0.85 },
  meta: { fontFamily: FONTS.mono, fontSize: 11.5, color: BOARD.dim, letterSpacing: 0.4, marginTop: 10 },
  overview: { color: BOARD.ink, opacity: 0.86, fontSize: 14, lineHeight: 19, marginTop: 5 },
  reason: { color: BOARD.gold, fontSize: 13, lineHeight: 17, marginTop: 5 },
  catcher: { position: "absolute", left: 0, top: 0, right: 0, height: HERO_H - 70 },
  actions: { position: "absolute", left: 24, right: 12, bottom: 18, flexDirection: "row" },
  btn: { marginRight: 8 },
  media: { width: HERO_MEDIA_W, height: HERO_H, backgroundColor: "#000" },
  art: { backgroundColor: BOARD.bg },
});
