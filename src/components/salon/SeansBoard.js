import { useIsFocused } from "@react-navigation/native";
import { t as translateUI, getLanguage } from "../../i18n/core";
import React, { memo, useEffect, useMemo, useRef, useState } from "react";
import { View, Text, Image, TouchableOpacity, Animated, ScrollView, StyleSheet, AccessibilityInfo, AppState } from "react-native";
import { Heart, ChevronRight, ChevronLeft } from "lucide-react-native";
import { FONTS, upperTR } from "../../theme/fonts";
import { platformName, platformLogo } from "../../utils/platform";
import { isDomestic } from "../../utils/origin";
import { hapticSelection } from "../../utils/haptics";

// Ana Sayfa'nın "bu akşam" seçkisi bir sinema/gar seans panosu gibi gösteriliyor: başlık harf
// kutucuklarına yazılıyor ve sıradaki seçime geçince her kutu birkaç rastgele harften geçip
// yenisine dönüyor. Pano fiziksel bir nesne olduğu için açık temada da koyu kalıyor.

const CHARS = "ABCÇDEFGĞHIİJKLMNOÖPRSŞTUÜVYZ0123456789";
// Başlık sığana kadar sırayla denenen pano boyutları (sütun × satır).
const LAYOUTS = [[11, 2], [14, 2], [14, 3], [18, 3]];
const GAP = 3;
const BOARD = { bg: "#0d0b0a", border: "#3a332b", top: "#2e2924", bottom: "#26221d", seam: "#070606", ink: "#f2ede2", gold: "#d4a94a", dim: "#a39684" };

function splitLines(words, cols) {
  const lines = [""];
  for (const w of words) {
    const cur = lines[lines.length - 1];
    const next = cur ? `${cur} ${w}` : w;
    if (next.length <= cols) lines[lines.length - 1] = next;
    else if (w.length <= cols) lines.push(w);
    else {
      // Panoya sığmayan tek kelime: satırı doldurup kalanı alta taşı.
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

const FlapCell = memo(function FlapCell({ char, delay, steps, size, reduceMotion, active }) {
  const [shown, setShown] = useState(char);
  const flip = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (!active || reduceMotion) { setShown(char); flip.setValue(1); return undefined; }
    const timers = [];
    let k = 0;
    const tick = () => {
      k += 1;
      const next = k >= steps ? char : CHARS[Math.floor(Math.random() * CHARS.length)];
      setShown(next);
      flip.setValue(0.12);
      Animated.timing(flip, { toValue: 1, duration: 70, useNativeDriver: true }).start();
      if (k < steps) timers.push(setTimeout(tick, 52));
    };
    timers.push(setTimeout(tick, delay));
    return () => { timers.forEach(clearTimeout); flip.stopAnimation(); };
  }, [char, active, reduceMotion]);

  return (
    <View style={[styles.cell, { width: size.w, height: size.h }]}>
      <View style={[styles.cellHalf, { height: size.h / 2, backgroundColor: BOARD.top }]} />
      <View style={[styles.cellHalf, { top: size.h / 2, height: size.h / 2, backgroundColor: BOARD.bottom }]} />
      <Animated.Text
        allowFontScaling={false}
        style={[styles.cellText, { fontSize: size.font, lineHeight: size.h, transform: [{ scaleY: flip }] }]}
      >
        {shown === " " ? "" : shown}
      </Animated.Text>
      <View style={[styles.seam, { top: size.h / 2 - 0.5 }]} />
    </View>
  );
});

function FlapGrid({ text, reduceMotion, active }) {
  const [width, setWidth] = useState(0);
  const layout = useMemo(() => boardLayout(text), [text]);
  const { cols, rows, lines } = layout;
  const w = width ? (width - GAP * (cols - 1)) / cols : 0;
  const size = { w, h: w / 0.66, font: w * 0.8 };
  return (
    <View onLayout={(e) => setWidth(e.nativeEvent.layout.width)} style={{ gap: GAP }}>
      {!!width && Array.from({ length: rows }, (_, r) => (
        <View key={`${cols}-${r}`} style={{ flexDirection: "row", gap: GAP }}>
          {Array.from({ length: cols }, (__, col) => (
            <FlapCell
              key={`${cols}-${r}-${col}`}
              char={(lines[r] || "")[col] || " "}
              delay={col * 26 + r * 70}
              steps={Math.floor(3 + col * 0.45 + ((col * 7 + r * 3) % 3))}
              size={size}
              reduceMotion={reduceMotion}
              active={active}
            />
          ))}
        </View>
      ))}
    </View>
  );
}

export function formatHeroRuntime(runtime) {
  if (getLanguage() !== "en" || runtime == null) return runtime;
  return String(runtime)
    .replace(/(\d+)\s*Sezon/gi, (_, n) => `${n} season${Number(n) === 1 ? "" : "s"}`)
    .replace(/(\d+)\s*Bölüm/gi, (_, n) => `${n} episode${Number(n) === 1 ? "" : "s"}`)
    .replace(/\b(dakika|dk)\b/gi, "min")
    .replace(/\bsaat\b/gi, "hr");
}

function metaLine(movie) {
  const genre = String(movie.genre || "").split(/[,/·|]/)[0]?.trim();
  return [translateUI(genre), formatHeroRuntime(movie.runtime), movie.year].filter(Boolean).map((part) => upperTR(part)).join(" · ");
}

export default function SeansBoard({ selections, index, onIndexChange, isLiked, onLike, onWhy, onOpen, paused = false, onSlidingChange }) {
  const focused = useIsFocused();
  const [interacting, setInteracting] = useState(false);
  const [appActive, setAppActive] = useState(AppState.currentState !== "background" && AppState.currentState !== "inactive");
  const [reduceMotion, setReduceMotion] = useState(true);
  const [pageWidth, setPageWidth] = useState(0);
  const [arrivedIndex, setArrivedIndex] = useState(index);
  const pager = useRef(null);
  const releaseTimer = useRef(null);
  const offset = useRef(0);
  const momentum = useRef(false);
  const dragging = useRef(false);
  const slidingCallback = useRef(onSlidingChange);
  slidingCallback.current = onSlidingChange;
  const count = selections.length;
  const safeIndex = Math.min(index, Math.max(0, count - 1));
  const movie = selections[safeIndex]?.movie;
  const ids = selections.map(item => item.movie.id).join(",");

  const release = () => {
    clearTimeout(releaseTimer.current);
    dragging.current = false;
    setInteracting(false);
    slidingCallback.current?.(false);
  };
  const releaseRef = useRef(release);
  releaseRef.current = release;
  useEffect(() => {
    let mounted = true;
    AccessibilityInfo.isReduceMotionEnabled().then(value => { if (mounted) setReduceMotion(value); }).catch(() => {});
    const motion = AccessibilityInfo.addEventListener?.("reduceMotionChanged", setReduceMotion);
    const app = AppState.addEventListener("change", state => {
      setAppActive(state === "active");
      if (state !== "active") releaseRef.current();
    });
    return () => {
      mounted = false;
      motion?.remove(); app.remove();
      clearTimeout(releaseTimer.current);
      slidingCallback.current?.(false);
    };
  }, []);

  // Native horizontal paging follows the finger; each page has the same width and height.
  useEffect(() => {
    if (!pageWidth || dragging.current) return;
    const target = safeIndex * pageWidth;
    if (Math.abs(offset.current - target) < 1) { setArrivedIndex(safeIndex); return; }
    setArrivedIndex(-1);
    pager.current?.scrollTo({ x: target, animated: !reduceMotion });
    if (reduceMotion) { offset.current = target; setArrivedIndex(safeIndex); }
  }, [safeIndex, pageWidth, reduceMotion, ids]);

  const goTo = (next, feedback = true) => {
    if (count < 2) return;
    if (feedback) hapticSelection();
    onIndexChange((next + count) % count);
  };
  const nextRef = useRef(null);
  nextRef.current = () => goTo(safeIndex + 1, false);
  useEffect(() => {
    if (paused || !focused || !appActive || interacting || reduceMotion || count < 2) return;
    const timer = setInterval(() => nextRef.current(), 7000);
    return () => clearInterval(timer);
  }, [paused, focused, appActive, interacting, reduceMotion, safeIndex, count]);
  useEffect(() => { if (!focused || paused) releaseRef.current(); }, [focused, paused]);

  const settle = () => {
    const next = pageWidth ? Math.max(0, Math.min(count - 1, Math.round(offset.current / pageWidth))) : safeIndex;
    release();
    setArrivedIndex(next);
    if (next !== safeIndex) { hapticSelection(); onIndexChange(next); }
  };
  const settleRef = useRef(settle); settleRef.current = settle;
  const titles = selections.map(item => isDomestic(item.movie)
    ? String(item.movie.title || "").replace(/i/g, "İ").replace(/ı/g, "I").toUpperCase()
    : String(item.movie.title || "").toUpperCase());
  const titleHeight = pageWidth ? Math.ceil(Math.max(...titles.map(title => {
    const { cols, rows } = boardLayout(title);
    return rows * ((pageWidth - GAP * (cols - 1)) / cols / 0.66) + GAP * (rows - 1);
  }))) : 110;
  if (!movie) return null;
  const liked = isLiked(movie.id);

  return (
    <View style={styles.board} onTouchStart={() => setInteracting(true)} onTouchEnd={() => { if (!dragging.current) setInteracting(false); }} onTouchCancel={() => release()}>
      <View style={styles.boardTop}>
        <Text style={styles.boardLabel}>{translateUI("BU AKŞAM SENİN İÇİN")}</Text>
        <Text style={styles.boardLabel}>{String(safeIndex + 1).padStart(2, "0")}{translateUI("/")}{String(count).padStart(2, "0")}</Text>
      </View>
      <View style={styles.pagerClip} onLayout={e => setPageWidth(e.nativeEvent.layout.width)}>
        {!!pageWidth && <ScrollView
          ref={pager}
          horizontal
          pagingEnabled
          directionalLockEnabled
          nestedScrollEnabled
          bounces={false}
          showsHorizontalScrollIndicator={false}
          decelerationRate="fast"
          scrollEnabled={count > 1}
          scrollEventThrottle={16}
          onScroll={e => { offset.current = e.nativeEvent.contentOffset.x; }}
          onScrollBeginDrag={() => {
            dragging.current = true; momentum.current = false;
            setArrivedIndex(-1);
            setInteracting(true); slidingCallback.current?.(true);
            clearTimeout(releaseTimer.current);
          }}
          onScrollEndDrag={() => {
            clearTimeout(releaseTimer.current);
            releaseTimer.current = setTimeout(() => { if (!momentum.current) settleRef.current(); }, 160);
          }}
          onMomentumScrollBegin={() => {
            momentum.current = true;
            clearTimeout(releaseTimer.current);
            releaseTimer.current = setTimeout(() => settleRef.current(), 1500);
          }}
          onMomentumScrollEnd={() => { momentum.current = false; settleRef.current(); }}
        >
          {selections.map((item, pageIndex) => {
            const pageMovie = item.movie;
            const reason = item.reasons?.find(r => r.personalized)?.short || item.reasons?.[0]?.short;
            const platform = (pageMovie.platforms || [])[0];
            const active = pageIndex === safeIndex;
            return (
              <View key={pageMovie.id} style={{ width: pageWidth }} accessibilityElementsHidden={!active} importantForAccessibility={active ? "auto" : "no-hide-descendants"}>
                <TouchableOpacity activeOpacity={0.9} onPress={() => onOpen(pageMovie)} accessibilityRole="button" accessibilityLabel={translateUI("{0}, detayı aç", {0: pageMovie.title})}>
                  <View style={{ height: titleHeight, justifyContent: "center" }}>
                    <FlapGrid text={titles[pageIndex]} reduceMotion={reduceMotion} active={pageIndex === arrivedIndex} />
                  </View>
                </TouchableOpacity>
                <TouchableOpacity style={styles.row} activeOpacity={0.85} onPress={() => onOpen(pageMovie)} accessible={false}>
                  {pageMovie.poster ? <Image source={{ uri: pageMovie.poster }} style={styles.poster} /> : <View style={[styles.poster, { backgroundColor: BOARD.top }]} />}
                  <View style={styles.meta}>
                    <Text style={styles.metaLine} numberOfLines={1}>{metaLine(pageMovie)}</Text>
                    {!!pageMovie.imdb && <Text style={styles.metaLine}>IMDb {pageMovie.imdb}</Text>}
                    {!!platform && <View style={styles.platformRow}>
                      {!!platformLogo(platform) && <Image source={{ uri: platformLogo(platform) }} style={styles.platformLogo} />}
                      <Text style={styles.platformText} numberOfLines={1}>{platformName(platform)}</Text>
                    </View>}
                    {!!reason && <Text style={styles.reason} numberOfLines={2}>{translateUI(reason)}</Text>}
                  </View>
                </TouchableOpacity>
              </View>
            );
          })}
        </ScrollView>}
      </View>
      {count > 1 && <View style={styles.sliderControls}>
        <TouchableOpacity style={styles.arrow} onPress={() => goTo(safeIndex - 1)} accessibilityRole="button" accessibilityLabel={translateUI("Önceki seçim")}><ChevronLeft size={18} color={BOARD.ink} /></TouchableOpacity>
        <View style={styles.dots}>{selections.map((item, i) => <TouchableOpacity key={item.movie.id} style={styles.dotHit} onPress={() => goTo(i)} accessibilityRole="button" accessibilityLabel={translateUI("Seçim {0} / {1}", {0:i+1,1:count})} accessibilityState={{ selected:i===safeIndex }}><View style={[styles.dot,i===safeIndex&&styles.dotActive]} /></TouchableOpacity>)}</View>
        <TouchableOpacity style={styles.arrow} onPress={() => goTo(safeIndex + 1)} accessibilityRole="button" accessibilityLabel={translateUI("Sıradaki seçim")}><ChevronRight size={18} color={BOARD.ink} /></TouchableOpacity>
      </View>}
      <View style={styles.actions}>
        <TouchableOpacity style={styles.whyBtn} onPress={onWhy} activeOpacity={0.85} accessibilityRole="button"><Text style={styles.whyText}>{translateUI("Neden bu?")}</Text></TouchableOpacity>
        <TouchableOpacity style={[styles.likeBtn,liked&&styles.likeBtnOn]} onPress={()=>onLike(movie)} activeOpacity={0.85} accessibilityRole="button" accessibilityLabel={liked?translateUI("Beğenildi"):translateUI("Beğen")} accessibilityState={{selected:liked}}><Heart size={18} color={liked?"#fff":BOARD.ink} fill={liked?"#fff":"none"}/></TouchableOpacity>
        <TouchableOpacity style={styles.nextBtn} onPress={()=>goTo(safeIndex+1)} activeOpacity={0.85} accessibilityRole="button" accessibilityLabel={translateUI("Sıradaki seçim")}><Text style={styles.nextText}>{translateUI("Sıradaki")}</Text><ChevronRight size={16} color={BOARD.ink}/></TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  board: {
    backgroundColor: BOARD.bg, borderRadius: 18, borderWidth: 1, borderColor: BOARD.border, padding: 12, paddingTop: 13,
    shadowColor: "#000", shadowOpacity: 0.35, shadowRadius: 18, shadowOffset: { width: 0, height: 12 }, elevation: 6,
  },
  pagerClip: { overflow: "hidden" },
  sliderControls: { flexDirection: "row", alignItems: "center", justifyContent: "center", marginTop: 10, gap: 6 },
  arrow: { width: 32, height: 36, alignItems: "center", justifyContent: "center" },
  dots: { flexDirection: "row", alignItems: "center", flexShrink: 1 },
  dotHit: { width: 16, height: 36, alignItems: "center", justifyContent: "center" },
  dot: { width: 5, height: 5, borderRadius: 3, backgroundColor: BOARD.border },
  dotActive: { width: 14, backgroundColor: BOARD.gold },
  boardTop: { flexDirection: "row", justifyContent: "space-between", marginBottom: 10 },
  boardLabel: { fontFamily: FONTS.monoMedium, fontSize: 10.5, color: BOARD.gold, letterSpacing: 0.8 },
  cell: { borderRadius: 3, overflow: "hidden", alignItems: "center", justifyContent: "center" },
  cellHalf: { position: "absolute", left: 0, right: 0, top: 0 },
  cellText: { fontFamily: FONTS.marqueeBold, color: BOARD.ink, textAlign: "center", includeFontPadding: false },
  seam: { position: "absolute", left: 0, right: 0, height: 1, backgroundColor: BOARD.seam },
  row: { flexDirection: "row", gap: 12, marginTop: 14, height: 128 },
  poster: { width: 66, height: 99, borderRadius: 6 },
  meta: { flex: 1, minWidth: 0, gap: 4 },
  metaLine: { fontFamily: FONTS.mono, fontSize: 11, color: BOARD.dim, letterSpacing: 0.3 },
  platformRow: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 1 },
  platformLogo: { width: 18, height: 18, borderRadius: 4, backgroundColor: "#fff" },
  platformText: { color: BOARD.ink, fontSize: 13.5, fontWeight: "600", flexShrink: 1 },
  reason: { color: BOARD.dim, fontSize: 12.5, lineHeight: 17, marginTop: 2 },
  actions: { flexDirection: "row", gap: 8, marginTop: 14 },
  whyBtn: { flex: 1, height: 46, borderRadius: 23, backgroundColor: BOARD.gold, alignItems: "center", justifyContent: "center" },
  whyText: { color: "#1a140b", fontSize: 14, fontWeight: "800" },
  likeBtn: { width: 46, height: 46, borderRadius: 23, borderWidth: 1, borderColor: BOARD.border, alignItems: "center", justifyContent: "center" },
  likeBtnOn: { backgroundColor: "#d9636f", borderColor: "#d9636f" },
  nextBtn: { height: 46, paddingHorizontal: 16, borderRadius: 23, borderWidth: 1, borderColor: BOARD.border, flexDirection: "row", alignItems: "center", gap: 4 },
  nextText: { color: BOARD.ink, fontSize: 14, fontWeight: "600" },
});
