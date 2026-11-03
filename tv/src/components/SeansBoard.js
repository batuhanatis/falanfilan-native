import React, { memo, useEffect, useMemo, useRef, useState } from "react";
import { View, Text, Image, Pressable, Animated, Easing, StyleSheet, AccessibilityInfo, Platform, findNodeHandle } from "react-native";
import { FONTS, upperTR } from "../theme";
import FocusButton from "./FocusButton";
import TrailerPlayer from "./TrailerPlayer";
import { primaryWatchLink, watchButtonLabel } from "../platforms";

// Telefondaki "Bu akşam senin için" panosunun TV hali (bkz. falanfilan-native
// src/components/salon/SeansBoard.js). Gar/sinema seans panosu: başlık harf kutucuklarına
// yazılıyor, sıradaki seçime geçince her kutu birkaç rastgele harften geçip yenisine dönüyor.
// Sağda panoya gömülü bir "ekran" afişi gösteriyor; içerikte 3 saniye kumandaya dokunulmazsa
// ekranın alt kenarındaki çizgi doluyor ve fragman panonun TAMAMINDA başlıyor: pano videoya göre
// 16:9'a uzuyor (kırpma yok). Fragman oynarken herhangi bir tuş onu kesip panoyu geri getiriyor. İçerik telefondakiyle aynı günlük seçki
// (API /api/me/home-hero). Pano fiziksel bir nesne, hep koyu.

const CHARS = "ABCÇDEFGĞHIİJKLMNOÖPRSŞTUÜVYZ0123456789";
// Başlık sığana kadar sırayla denenen pano boyutları (sütun × satır), telefonla aynı.
const LAYOUTS = [[11, 2], [14, 2], [14, 3], [18, 3]];
const GAP = 4;
const TITLE_W = 368;
const SCREEN_W = 416;
const SCREEN_H = 234; // 16:9
export const TRAILER_DWELL_MS = 3000;
const BOARD = { bg: "#0d0b0a", border: "#3a332b", top: "#2e2924", bottom: "#26221d", seam: "#070606", ink: "#f2ede2", gold: "#d4a94a", dim: "#a39684" };

function splitLines(words, cols) {
  const lines = [""];
  for (const w of words) {
    const cur = lines[lines.length - 1];
    const next = cur ? `${cur} ${w}` : w;
    if (next.length <= cols) lines[lines.length - 1] = next;
    else if (w.length <= cols) lines.push(w);
    else {
      let rest = cur ? `${cur} ${w}` : w;
      lines[lines.length - 1] = rest.slice(0, cols);
      rest = rest.slice(cols);
      while (rest.length) { lines.push(rest.slice(0, cols)); rest = rest.slice(cols); }
    }
  }
  return lines;
}

function boardLayout(title) {
  const words = title.split(/\s+/).filter(Boolean);
  for (const [cols, rows] of LAYOUTS) {
    const lines = splitLines(words, cols);
    if (lines.length <= rows) return { cols, rows, lines };
  }
  const [cols, rows] = LAYOUTS[LAYOUTS.length - 1];
  const lines = splitLines(words, cols).slice(0, rows);
  lines[rows - 1] = `${lines[rows - 1].slice(0, cols - 1)}…`;
  return { cols, rows, lines };
}

const cellSize = (cols) => {
  const w = (TITLE_W - GAP * (cols - 1)) / cols;
  return { w, h: w / 0.66, font: w * 0.8 };
};
const gridHeight = ({ cols, rows }) => rows * cellSize(cols).h + GAP * (rows - 1);

// Yerli içerikte Türkçe büyük harf (i → İ), yabancıda düz büyük harf.
const boardTitle = (movie) => (String(movie?.originalLanguage || "").toLowerCase() === "tr"
  ? upperTR(movie?.title)
  : String(movie?.title || "").toUpperCase());

const tagOf = (r) => (Platform.OS === "android" && r ? findNodeHandle(r) : null);

const FlapCell = memo(function FlapCell({ char, delay, steps, size, reduceMotion, cycle }) {
  const [shown, setShown] = useState(char);
  const flip = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (reduceMotion) { setShown(char); flip.setValue(1); return undefined; }
    const timers = [];
    let k = 0;
    const tick = () => {
      k += 1;
      const next = k >= steps ? char : CHARS[Math.floor(Math.random() * CHARS.length)];
      setShown(next);
      flip.setValue(0.12);
      Animated.timing(flip, { toValue: 1, duration: 70, useNativeDriver: true }).start();
      if (k < steps) timers.push(setTimeout(tick, 55));
    };
    timers.push(setTimeout(tick, delay));
    return () => { timers.forEach(clearTimeout); flip.stopAnimation(); };
  }, [char, cycle, reduceMotion]);

  return (
    <View style={[styles.cell, { width: size.w, height: size.h }]}>
      <View style={[styles.cellHalf, { height: size.h / 2, backgroundColor: BOARD.top }]} />
      <View style={[styles.cellHalf, { top: size.h / 2, height: size.h / 2, backgroundColor: BOARD.bottom }]} />
      <Animated.Text allowFontScaling={false} style={[styles.cellText, { fontSize: size.font, lineHeight: size.h, transform: [{ scaleY: flip }] }]}>
        {shown === " " ? "" : shown}
      </Animated.Text>
      <View style={[styles.seam, { top: size.h / 2 - 0.5 }]} />
    </View>
  );
});

function FlapGrid({ text, reduceMotion, cycle }) {
  const { cols, rows, lines } = useMemo(() => boardLayout(text), [text]);
  const size = cellSize(cols);
  return (
    <View style={{ gap: GAP, width: TITLE_W }} accessible accessibilityLabel={text}>
      {Array.from({ length: rows }, (_, r) => (
        <View key={`${cols}-${r}`} style={{ flexDirection: "row", gap: GAP }}>
          {Array.from({ length: cols }, (__, col) => (
            <FlapCell
              key={`${cols}-${r}-${col}`}
              char={(lines[r] || "")[col] || " "}
              delay={col * 26 + r * 70}
              steps={Math.floor(3 + col * 0.45 + ((col * 7 + r * 3) % 3))}
              size={size}
              reduceMotion={reduceMotion}
              cycle={cycle}
            />
          ))}
        </View>
      ))}
    </View>
  );
}

function metaLine(movie) {
  const genre = String(movie.genre || "").split(/[,/·|]/)[0]?.trim();
  return [genre, movie.type, movie.runtime, movie.year, movie.imdb ? `IMDb ${movie.imdb}` : null]
    .filter(Boolean).map((part) => upperTR(part)).join("  ·  ");
}

// Panodaki ekran: bulanık zeminin üstünde afiş. phase: idle → waiting (alt çizgi 3 sn'de doluyor)
// → loading (oynatıcı panonun arkasında açılıyor) → playing (pano kalkıyor, fragman tüm alanda)
// → done. Fragman yoksa yalnızca afiş.
function Screen({ movie, trailer, phase }) {
  const caption = !trailer?.key ? "" : phase === "waiting" ? "FRAGMAN BİRAZDAN" : phase === "loading" ? "FRAGMAN YÜKLENİYOR" : "";
  const warm = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (phase === "waiting") {
      warm.setValue(0);
      Animated.timing(warm, { toValue: 1, duration: TRAILER_DWELL_MS, easing: Easing.linear, useNativeDriver: true }).start();
    } else if (phase === "loading" || phase === "playing") {
      warm.stopAnimation(); warm.setValue(1);
    } else {
      warm.stopAnimation(); warm.setValue(0);
    }
  }, [phase, warm]);

  return (
    <View style={styles.screen} pointerEvents="none">
      {movie.poster ? (
        <>
          <Image source={{ uri: movie.poster }} style={[StyleSheet.absoluteFill, { opacity: 0.55 }]} blurRadius={18} resizeMode="cover" />
          <Image source={{ uri: movie.poster }} style={styles.screenPoster} />
        </>
      ) : <View style={[StyleSheet.absoluteFill, { backgroundColor: BOARD.top }]} />}
      {!!caption && (
        <View style={styles.captionBox}>
          <Text style={styles.caption} numberOfLines={1}>{caption}</Text>
        </View>
      )}
      {!!trailer?.key && <Animated.View style={[styles.warm, { transform: [{ scaleX: warm }] }]} />}
    </View>
  );
}

const focusView = (r) => { if (r?.requestTVFocus) r.requestTVFocus(); else r?.focus?.(); };

// selections: [{ movie, reason }]. onWatch(movie, link) platformu açar; onOpen(movie) detaya gider.
// onFocusBoard: odak panoya gelince (liste en üste kaysın). status: izle düğmesinin sonucu.
// trailer: undefined (bakılıyor) | null (yok) | { key }. upTag: yukarı tuşunun gideceği düğme (Çıkış).
export default function SeansBoard({
  selections, index, onIndexChange, onOpen, onWatch, onFocusBoard, onInteract, status, preferredFocus,
  trailer, phase, onTrailerPlaying, onTrailerEnded, onTrailerError, onStopTrailer, upTag, onPrimaryTag,
}) {
  const [reduceMotion, setReduceMotion] = useState(true);
  const [nextTag, setNextTag] = useState(null);
  const [catcherTag, setCatcherTag] = useState(null);
  const primaryRef = useRef(null);
  const detailRef = useRef(null);
  const nextRef = useRef(null);
  const catcherRef = useRef(null);
  const lastFocused = useRef("primary");
  const content = useRef(new Animated.Value(1)).current;
  // Pano yüksekliği: normalde içeriğin kendi yüksekliği, fragman oynarken genişliğin 16:9'u.
  const [boardW, setBoardW] = useState(0);
  const [innerH, setInnerH] = useState(0);
  const height = useRef(new Animated.Value(0)).current;
  const heightReady = useRef(false);
  const prevPhase = useRef(phase);
  const count = selections.length;
  const safeIndex = Math.min(index, Math.max(0, count - 1));
  const item = selections[safeIndex];
  const movie = item?.movie;

  useEffect(() => {
    let mounted = true;
    AccessibilityInfo.isReduceMotionEnabled?.().then((v) => { if (mounted) setReduceMotion(v); }).catch(() => setReduceMotion(false));
    return () => { mounted = false; };
  }, []);

  // Odak yolları (Android): düğmelerden yukarı Çıkış'a, en sağdaki düğmeden sağa hiçbir yere
  // (fragman oynatıcısı bir WebView; odak içine kaçarsa kumanda takılır).
  useEffect(() => {
    onPrimaryTag?.(tagOf(primaryRef.current));
    const t = tagOf(nextRef.current);
    if (t !== nextTag) setNextTag(t);
    const c = tagOf(catcherRef.current);
    if (c !== catcherTag) setCatcherTag(c);
  });

  // Fragman oynamaya başlayınca pano içeriği kalkıyor ve pano 16:9'a uzuyor (video kırpılmadan
  // tamamen görünsün); bitince/kesilince içerik geri geliyor, pano eski boyuna dönüyor.
  const videoH = boardW ? Math.round((boardW - 2) * 9 / 16) + 2 : 0; // 1 px kenarlık iki yanda
  useEffect(() => {
    if (!innerH) return;
    const target = phase === "playing" && videoH ? videoH : innerH;
    Animated.timing(height, {
      toValue: target, duration: reduceMotion ? 0 : phase === "playing" ? 450 : 300,
      easing: Easing.out(Easing.cubic), useNativeDriver: false,
    }).start();
  }, [phase, innerH, videoH, height, reduceMotion]);

  useEffect(() => {
    const playing = phase === "playing";
    Animated.timing(content, { toValue: playing ? 0 : 1, duration: reduceMotion ? 0 : playing ? 500 : 250, useNativeDriver: true }).start();
    // Fragman bitince/kesilince odak, yakalayıcıdan en son odaklanan düğmeye geri dönüyor.
    if (prevPhase.current === "playing" && !playing) {
      const refs = { primary: primaryRef, detail: detailRef, next: nextRef };
      requestAnimationFrame(() => focusView((refs[lastFocused.current] || primaryRef).current || primaryRef.current));
    }
    prevPhase.current = phase;
  }, [phase, content, reduceMotion]);

  // Pano yüksekliği seçkideki en uzun başlığa göre sabit: seçim değişince düzen zıplamasın.
  const titleHeight = useMemo(
    () => Math.ceil(Math.max(...selections.map((s) => gridHeight(boardLayout(boardTitle(s.movie)))))),
    [selections],
  );

  if (!movie) return null;
  const link = primaryWatchLink(movie);
  const focus = (name) => () => { lastFocused.current = name; onFocusBoard?.(); };
  const playing = phase === "playing";
  const showPlayer = !!trailer?.key && (phase === "loading" || playing);
  const press = (fn) => () => { onInteract?.(); fn(); };

  return (
    <Animated.View
      style={[styles.board, innerH ? { height } : null]}
      onLayout={(e) => { const w = Math.round(e.nativeEvent.layout.width); if (w !== boardW) setBoardW(w); }}
    >
      {showPlayer && <TrailerPlayer videoKey={trailer.key} onPlaying={onTrailerPlaying} onEnded={onTrailerEnded} onError={onTrailerError} />}
      <Animated.View
        style={[styles.boardInner, { opacity: content }]}
        onLayout={(e) => {
          const h = Math.round(e.nativeEvent.layout.height);
          // İlk ölçümde yüksekliği hemen ver (bir kare bile 0 yükseklikte kalmasın).
          if (!heightReady.current) { height.setValue(h); heightReady.current = true; }
          if (h !== innerH) setInnerH(h);
        }}
      >
      <View style={styles.boardTop}>
        <Text style={styles.boardLabel}>BU AKŞAM SENİN İÇİN</Text>
        <Text style={styles.boardLabel}>{String(safeIndex + 1).padStart(2, "0")}/{String(count).padStart(2, "0")}</Text>
      </View>
      <View style={styles.body}>
        <View style={styles.left}>
          <View style={{ height: titleHeight, justifyContent: "center" }}>
            <FlapGrid text={boardTitle(movie)} reduceMotion={reduceMotion} cycle={safeIndex} />
          </View>
          <Text style={styles.meta} numberOfLines={1}>{metaLine(movie)}</Text>
          {!!movie.overview && <Text style={styles.overview} numberOfLines={3}>{movie.overview}</Text>}
          {status
            ? <Text style={[styles.reason, status.tone === "error" && { color: "#e58a93" }]} numberOfLines={1}>{status.text}</Text>
            : !!item.reason && <Text style={styles.reason} numberOfLines={1}>{item.reason}</Text>}
        </View>
        <Screen movie={movie} trailer={trailer} phase={phase} />
      </View>
      {/* Düğmeler sabit anahtarlı: pano kendi kendine sıradakine geçince odaktaki düğme
          yeniden kurulmasın (TV'de odak kaybolurdu), yalnızca yazısı değişsin. */}
      <View style={styles.actions}>
        <FocusButton
          key="primary"
          ref={primaryRef}
          label={link ? `▶  ${watchButtonLabel(link)}` : "Detayı aç"}
          primary
          hasTVPreferredFocus={preferredFocus}
          onFocus={focus("primary")}
          onPress={press(() => (link ? onWatch(movie, link) : onOpen(movie)))}
          nextFocusUp={upTag}
          style={styles.btn}
        />
        {!!link && <FocusButton key="detail" ref={detailRef} label="Detay" onFocus={focus("detail")} onPress={press(() => onOpen(movie))} nextFocusUp={upTag} style={styles.btn} />}
        {count > 1 && (
          <FocusButton
            key="next"
            ref={nextRef}
            label="Sıradaki  ›"
            onFocus={focus("next")}
            onPress={press(() => onIndexChange((safeIndex + 1) % count))}
            nextFocusUp={upTag}
            nextFocusRight={nextTag}
            style={styles.btn}
          />
        )}
      </View>
      </Animated.View>

      {/* Fragman oynarken odak bu görünmez katmanda: ilk tuş hiçbir düğmeyi tetiklemeden ya da
          odağı kaydırmadan yalnızca fragmanı kesiyor (yön tuşları kendine dönüyor). */}
      {playing && (
        <Pressable
          ref={catcherRef}
          hasTVPreferredFocus
          onPress={onStopTrailer}
          accessibilityRole="button"
          accessibilityLabel="Fragmanı durdur"
          style={StyleSheet.absoluteFill}
          {...(catcherTag ? { nextFocusUp: catcherTag, nextFocusDown: catcherTag, nextFocusLeft: catcherTag, nextFocusRight: catcherTag } : null)}
        />
      )}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  board: { backgroundColor: "#000", borderRadius: 22, borderWidth: 1, borderColor: BOARD.border, overflow: "hidden" },
  boardInner: { backgroundColor: BOARD.bg, paddingHorizontal: 26, paddingTop: 18, paddingBottom: 20 },
  boardTop: { flexDirection: "row", justifyContent: "space-between", marginBottom: 12 },
  boardLabel: { fontFamily: FONTS.monoMedium, fontSize: 12, color: BOARD.gold, letterSpacing: 1.6 },
  body: { flexDirection: "row", gap: 28 },
  left: { flex: 1, minWidth: 0 },
  cell: { borderRadius: 4, overflow: "hidden", alignItems: "center", justifyContent: "center" },
  cellHalf: { position: "absolute", left: 0, right: 0, top: 0 },
  cellText: { fontFamily: FONTS.marqueeBold, color: BOARD.ink, textAlign: "center", includeFontPadding: false },
  seam: { position: "absolute", left: 0, right: 0, height: 1, backgroundColor: BOARD.seam },
  meta: { fontFamily: FONTS.mono, fontSize: 12.5, color: BOARD.dim, letterSpacing: 0.6, marginTop: 12 },
  overview: { color: BOARD.ink, opacity: 0.86, fontSize: 15, lineHeight: 20, marginTop: 7 },
  reason: { color: BOARD.gold, fontSize: 14, lineHeight: 19, marginTop: 7 },
  actions: { flexDirection: "row", marginTop: 16 },
  btn: { marginRight: 12 },
  screen: { width: SCREEN_W, height: SCREEN_H, borderRadius: 12, overflow: "hidden", backgroundColor: "#000", borderWidth: 1, borderColor: BOARD.border },
  screenPoster: { position: "absolute", top: 0, bottom: 0, left: (SCREEN_W - SCREEN_H * (2 / 3)) / 2, width: SCREEN_H * (2 / 3) },
  warm: { position: "absolute", left: 0, right: 0, bottom: 0, height: 3, backgroundColor: BOARD.gold, transformOrigin: "left" },
  captionBox: { position: "absolute", left: 0, right: 0, bottom: 0, paddingHorizontal: 12, paddingVertical: 8, backgroundColor: "rgba(13,11,10,0.78)" },
  caption: { fontFamily: FONTS.monoMedium, fontSize: 11, color: BOARD.gold, letterSpacing: 1.4 },
});
