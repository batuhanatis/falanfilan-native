import { t as translateUI } from "../i18n/core";
import React, { useState, useEffect, useRef, useMemo } from "react";
import { View, Text, Image, Pressable, StyleSheet, ScrollView, ActivityIndicator, Animated, Easing, Share, useWindowDimensions } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Heart, X } from "lucide-react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAppTheme } from "../context/ThemeContext";
import { useAuth } from "../context/AuthContext";
import { api } from "../api/client";
import { hapticSuccess, hapticLight } from "../utils/haptics";
import { getStoreLink } from "../utils/appLinks";
import { peekPendingLink } from "../utils/deferredLink";
import { FONTS } from "../theme/fonts";
import SwipeableCard from "../components/SwipeableCard";
import { Curtain, Spotlight } from "../components/salon/OneSheet";
import { useCurtainWipe } from "../components/salon/CurtainWipe";

// Hesap açıldıktan sonraki tanışma: üç perde, aralarında kadife perde geçişi.
//  1. Makara — afişleri kaydırarak 5 beğeni (sağ beğen, sol geç). Uygulamanın asıl hareketini
//     öğretiyor; beğenilen afiş üstteki film şeridine uçup kareye oturuyor.
//  2. Künye — yalnızca gerçek beğenilerden çıkan türler ve sunucudan gelen ilk üç gerçek öneri.
//  3. Yan Koltuk — arkadaşını çağır (davet kodu, ikinize 7 gün Premium) ya da sonraya bırak.
// Linkle gelen kişi (bekleyen ertelenmiş link) 2. perdeden sonra doğrudan linkine geçiyor.
// Eski sekme turu artık gösterilmiyor: kaydırma burada öğretiliyor.

const GOLD = "#c9a44c";
const CREAM = "#f3ead8";
const DIM = "#8c8579";
const INK = "#14121a";
const NEED = 5;
const TR_UPPER = (s) => String(s || "").toLocaleUpperCase("tr-TR");

function genresOf(m) {
  if (Array.isArray(m?.genres) && m.genres.length) return m.genres.map((g) => String(g).trim()).filter(Boolean);
  if (typeof m?.genre === "string") return m.genre.split(",").map((g) => g.trim()).filter(Boolean);
  return [];
}

// Aynı türün art arda gelmemesi için basit sıralama.
function diversify(items) {
  const pool = [...items];
  const out = [];
  let last = null;
  while (pool.length) {
    const i = pool.findIndex((m) => genresOf(m)[0] !== last);
    const pick = pool.splice(i === -1 ? 0 : i, 1)[0];
    last = genresOf(pick)[0] || null;
    out.push(pick);
  }
  return out;
}

function ActHeader({ act, label, title, sub, onSkip, styles }) {
  return (
    <View style={styles.actHeader}>
      <View style={styles.actTopRow}>
        <Text style={styles.actEyebrow}>{translateUI("PERDE {0}/3 · {1}", { 0: act, 1: label })}</Text>
        {!!onSkip && (
          <Pressable onPress={onSkip} hitSlop={10} accessibilityRole="button">
            <Text style={styles.skip}>{translateUI("Atla")}</Text>
          </Pressable>
        )}
      </View>
      <Text style={styles.actTitle}>{title}</Text>
      {!!sub && <Text style={styles.actSub}>{sub}</Text>}
    </View>
  );
}

// ---------------------------------------------------------------------------
// 1. MAKARA
// ---------------------------------------------------------------------------
function Makara({ auth, styles, onDone, onSkip }) {
  const { width } = useWindowDimensions();
  const [deck, setDeck] = useState([]);
  const [index, setIndex] = useState(0);
  const [liked, setLiked] = useState([]);
  const [passed, setPassed] = useState(0);
  const [loading, setLoading] = useState(true);
  const pageRef = useRef(1);
  const seen = useRef(new Set());
  const cardRef = useRef(null);
  const cardBox = useRef(null);
  const frameRefs = useRef([]);
  const frameBoxes = useRef([]);
  const cardWrapRef = useRef(null);
  const ctaIn = useRef(new Animated.Value(0)).current;
  const pops = useRef(Array.from({ length: NEED }, () => new Animated.Value(0))).current;

  async function loadMore() {
    const page = pageRef.current;
    pageRef.current += 2;
    const responses = await Promise.all([page, page + 1].flatMap((p) => [
      api.movies(auth.token, "movie", p, "popular").catch(() => ({ results: [] })),
      api.movies(auth.token, "tv", p, "popular").catch(() => ({ results: [] })),
    ]));
    const fresh = responses.flatMap((r) => r.results || []).filter((m) => m?.poster && !seen.current.has(m.id));
    fresh.forEach((m) => seen.current.add(m.id));
    setDeck((d) => [...d, ...diversify(fresh)]);
  }

  useEffect(() => { loadMore().finally(() => setLoading(false)); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (!loading && deck.length - index < 4) loadMore(); }, [index, loading]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (liked.length >= NEED) Animated.spring(ctaIn, { toValue: 1, friction: 7, tension: 90, useNativeDriver: true }).start();
  }, [liked.length >= NEED]); // eslint-disable-line react-hooks/exhaustive-deps

  const current = deck[index];
  const next = deck[index + 1];

  function measure() {
    cardWrapRef.current?.measureInWindow((x, y, w, h) => { cardBox.current = { cx: x + w / 2, cy: y + h / 2 }; });
    frameRefs.current.forEach((r, i) => r?.measureInWindow((x, y, w, h) => { frameBoxes.current[i] = { cx: x + w / 2, cy: y + h / 2 }; }));
  }

  function advance() { setIndex((i) => i + 1); }

  function onLike() {
    if (!current) return;
    const slot = liked.length;
    api.recordInteraction(auth.token, current.id, "like").catch(() => {});
    setLiked((l) => [...l, current]);
    if (slot < NEED) {
      Animated.sequence([
        Animated.timing(pops[slot], { toValue: 1.15, duration: 160, easing: Easing.out(Easing.back(2)), useNativeDriver: true }),
        Animated.timing(pops[slot], { toValue: 1, duration: 120, useNativeDriver: true }),
      ]).start();
      if (slot === NEED - 1) hapticSuccess(); else hapticLight();
    }
    advance();
  }
  function onPass() {
    if (!current) return;
    api.recordInteraction(auth.token, current.id, "skip").catch(() => {});
    setPassed((p) => p + 1);
    advance();
  }

  const frameW = Math.floor((width - 40 - 4 * 8) / NEED);
  const cardW = Math.min(width - 96, 300);
  const done = liked.length >= NEED;

  return (
    <View style={{ flex: 1 }}>
      <ActHeader
        act={1}
        label={translateUI("MAKARA")}
        title={auth?.name ? translateUI("{0}, makaranı dolduralım", { 0: auth.name.split(" ")[0] }) : translateUI("Makaranı dolduralım")}
        sub={translateUI("Sağa kaydır: beğendim. Sola: geç. {0} beğeni yeter.", { 0: NEED })}
        onSkip={onSkip}
        styles={styles}
      />

      {/* Film şeridi: beğenilen afişler sırayla karelere oturuyor */}
      <View style={styles.strip} onLayout={() => setTimeout(measure, 50)}>
        <View style={styles.sprockets}>{Array.from({ length: 14 }, (_, i) => <View key={i} style={styles.hole} />)}</View>
        <View style={styles.frames}>
          {Array.from({ length: NEED }, (_, i) => {
            const m = liked[i];
            return (
              <View key={i} ref={(r) => { frameRefs.current[i] = r; }} style={[styles.frame, { width: frameW, height: Math.round(frameW * 1.5) }]}>
                {m ? (
                  <Animated.Image source={{ uri: m.poster }} style={[StyleSheet.absoluteFill, { borderRadius: 5, transform: [{ scale: pops[i] }] }]} />
                ) : (
                  <Text style={styles.frameNo}>{i + 1}</Text>
                )}
              </View>
            );
          })}
        </View>
        <View style={styles.sprockets}>{Array.from({ length: 14 }, (_, i) => <View key={i} style={styles.hole} />)}</View>
      </View>

      <View style={styles.stage}>
        {loading || !current ? (
          <ActivityIndicator color={GOLD} />
        ) : (
          <View ref={cardWrapRef} onLayout={() => setTimeout(measure, 50)} style={{ width: cardW, aspectRatio: 2 / 3 }}>
            {!!next && (
              <View style={[StyleSheet.absoluteFill, styles.card, { transform: [{ scale: 0.94 }, { translateY: 14 }], opacity: 0.6 }]}>
                <Image source={{ uri: next.poster }} style={StyleSheet.absoluteFill} />
              </View>
            )}
            <SwipeableCard
              key={current.id}
              ref={cardRef}
              style={[StyleSheet.absoluteFill, styles.card]}
              onSwipeLeft={onPass}
              onSwipeRight={onLike}
              rightExitTarget={() => {
                const slot = liked.length;
                const f = frameBoxes.current[slot];
                const cb = cardBox.current;
                if (slot >= NEED || !f || !cb) return null;
                return { x: f.cx - cb.cx, y: f.cy - cb.cy, scale: frameW / cardW };
              }}
            >
              {(pan) => {
                const likeOpacity = pan.x.interpolate({ inputRange: [20, 110], outputRange: [0, 1], extrapolate: "clamp" });
                const passOpacity = pan.x.interpolate({ inputRange: [-110, -20], outputRange: [1, 0], extrapolate: "clamp" });
                return (
                  <>
                    <Image source={{ uri: current.poster }} style={StyleSheet.absoluteFill} />
                    <LinearGradient colors={["rgba(0,0,0,0)", "rgba(0,0,0,0.85)"]} style={[StyleSheet.absoluteFill, { top: "55%" }]} pointerEvents="none" />
                    <View style={styles.cardMeta} pointerEvents="none">
                      <Text style={styles.cardTitle} numberOfLines={2}>{current.title}</Text>
                      <Text style={styles.cardSub} numberOfLines={1}>{[current.year, current.type, genresOf(current)[0]].filter(Boolean).join(" · ")}</Text>
                    </View>
                    <Animated.View style={[styles.stamp, styles.stampLike, { opacity: likeOpacity }]} pointerEvents="none">
                      <Text style={styles.stampLikeText}>{translateUI("BEĞENDİM")}</Text>
                    </Animated.View>
                    <Animated.View style={[styles.stamp, styles.stampPass, { opacity: passOpacity }]} pointerEvents="none">
                      <Text style={styles.stampPassText}>{translateUI("GEÇ")}</Text>
                    </Animated.View>
                  </>
                );
              }}
            </SwipeableCard>
          </View>
        )}
      </View>

      {/* 5 beğeniden sonra kontroller çekiliyor, yerine "Devam" geliyor (kaydırmak yine serbest) */}
      <Animated.View style={[styles.controls, { opacity: ctaIn.interpolate({ inputRange: [0, 1], outputRange: [1, 0] }) }]} pointerEvents={done ? "none" : "auto"}>
        <Pressable style={styles.roundBtn} onPress={() => cardRef.current?.swipeLeft()} accessibilityLabel={translateUI("Geç")}>
          <X size={22} color={DIM} />
        </Pressable>
        <Pressable onPress={() => advance()} hitSlop={8} accessibilityRole="button">
          <Text style={styles.unknown}>{translateUI("İzlemedim")}</Text>
        </Pressable>
        <Pressable style={[styles.roundBtn, styles.roundGold]} onPress={() => cardRef.current?.swipeRight()} accessibilityLabel={translateUI("Beğen")}>
          <Heart size={22} color="#1a150c" fill="#1a150c" />
        </Pressable>
      </Animated.View>

      <Animated.View style={[styles.ctaWrap, { opacity: ctaIn, transform: [{ translateY: ctaIn.interpolate({ inputRange: [0, 1], outputRange: [30, 0] }) }] }]} pointerEvents={done ? "auto" : "none"}>
        <Pressable style={styles.cta} onPress={() => onDone({ liked, passed })} accessibilityRole="button">
          <Text style={styles.ctaText}>{translateUI("Makara doldu · Devam")}</Text>
        </Pressable>
      </Animated.View>
    </View>
  );
}

// ---------------------------------------------------------------------------
// 2. KÜNYE
// ---------------------------------------------------------------------------
function Kunye({ auth, styles, result, onDone }) {
  const [recs, setRecs] = useState(null);
  const firstName = (auth?.name || "").split(" ")[0];
  const topGenres = useMemo(() => {
    const counts = {};
    (result?.liked || []).forEach((m) => genresOf(m).forEach((g) => { counts[g] = (counts[g] || 0) + 1; }));
    return Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([g]) => g);
  }, [result]);

  useEffect(() => {
    if (topGenres.length) api.updatePreferredGenres(auth.token, topGenres).catch(() => {});
    const likedIds = new Set((result?.liked || []).map((m) => m.id));
    // Beğeniler sunucuya yeni yazıldı; öneri motoru bunları görsün diye kısa bir bekleme.
    const t = setTimeout(() => {
      api.recommendations(auth.token, null, 12)
        .then((data) => setRecs((data?.results || []).filter((m) => m?.poster && !likedIds.has(m.id)).slice(0, 3)))
        .catch(() => setRecs([]));
    }, 600);
    return () => clearTimeout(t);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <ScrollView contentContainerStyle={{ paddingBottom: 120 }} showsVerticalScrollIndicator={false}>
      <ActHeader act={2} label={translateUI("KÜNYE")} title={translateUI("Perde senin için açıldı")} styles={styles} />
      {/* Afiş: perde önünde isim ve künye */}
      <View style={styles.sheet}>
        <View style={styles.sheetStage}>
          <Curtain />
          <Spotlight id="kunyeSpot" />
          <Text style={styles.sheetPresents}>{translateUI("PELLIX SUNAR")}</Text>
          <Text style={styles.sheetName} numberOfLines={1} adjustsFontSizeToFit>{TR_UPPER(firstName || "Sen")}</Text>
          <Text style={styles.sheetTag}>{translateUI("İLK SEANS")}</Text>
        </View>
        <View style={styles.credits}>
          <View style={styles.creditRow}>
            <Text style={styles.creditKey}>{translateUI("TÜRLER")}</Text>
            <Text style={styles.creditVal}>{topGenres.length ? topGenres.map((g) => translateUI(g)).join(" · ") : translateUI("Daha net görmek için biraz daha kaydır")}</Text>
          </View>
          <View style={styles.creditRow}>
            <Text style={styles.creditKey}>{translateUI("MAKARA")}</Text>
            <Text style={styles.creditVal}>{translateUI("{0} beğeni · {1} geçildi", { 0: result?.liked?.length || 0, 1: result?.passed || 0 })}</Text>
          </View>
          <View style={styles.likedRow}>
            {(result?.liked || []).slice(0, 6).map((m) => <Image key={m.id} source={{ uri: m.poster }} style={styles.likedThumb} />)}
          </View>
        </View>
      </View>

      <Text style={styles.sectionLabel}>{translateUI("BU AKŞAM İÇİN İLK ÖNERİLERİN")}</Text>
      <View style={styles.recRow}>
        {recs === null ? (
          [0, 1, 2].map((i) => <View key={i} style={[styles.recPoster, styles.recSkeleton]} />)
        ) : recs.length ? (
          recs.map((m) => (
            <View key={m.id} style={{ flex: 1 }}>
              <Image source={{ uri: m.poster }} style={styles.recPoster} />
              <Text style={styles.recTitle} numberOfLines={2}>{m.title}</Text>
            </View>
          ))
        ) : (
          <Text style={styles.recEmpty}>{translateUI("Önerilerin ana sayfada hazırlanıyor.")}</Text>
        )}
      </View>

      <View style={{ paddingHorizontal: 20, marginTop: 24 }}>
        <Pressable style={styles.cta} onPress={onDone} accessibilityRole="button">
          <Text style={styles.ctaText}>{translateUI("Devam")}</Text>
        </Pressable>
      </View>
    </ScrollView>
  );
}

// ---------------------------------------------------------------------------
// 3. YAN KOLTUK
// ---------------------------------------------------------------------------
function Seat({ label, filled }) {
  return (
    <View style={{ alignItems: "center", gap: 8 }}>
      <View style={[styles2.seatBack, filled ? styles2.seatGold : styles2.seatEmpty]}>
        <Text style={[styles2.seatLabel, { color: filled ? "#1a150c" : GOLD }]}>{label}</Text>
      </View>
      <View style={[styles2.seatBase, filled ? styles2.seatGold : styles2.seatEmpty]} />
    </View>
  );
}

function YanKoltuk({ auth, styles, onDone }) {
  const [shared, setShared] = useState(false);
  async function invite() {
    const storeLink = getStoreLink("onboarding_invite");
    const message = translateUI("{0} seni Pellix'e davet ediyor 🎬 Birlikte ne izleyeceğimize saniyede karar verelim. Kayıt olurken davet kodu: {1} (ikimize 7 gün Premium).", { 0: auth?.name || "", 1: auth?.username || "" });
    try {
      const r = await Share.share({ message: `${message}\n${storeLink}` });
      if (r?.action !== Share.dismissedAction) setShared(true);
    } catch { /* vazgeçildi */ }
  }
  return (
    <ScrollView contentContainerStyle={{ paddingBottom: 40 }} showsVerticalScrollIndicator={false}>
      <ActHeader act={3} label={translateUI("YAN KOLTUK")} title={translateUI("Yan koltuk boş")} sub={translateUI("Pellix ikiyle güzel: MatchParty'de birlikte seçin, Blend'de uyumunuzu görün.")} styles={styles} />
      <View style={styles.seats}>
        <Seat label={translateUI("SEN")} filled />
        <Seat label="?" />
      </View>
      <View style={styles.inviteCard}>
        <Text style={styles.inviteKey}>{translateUI("DAVET KODUN")}</Text>
        <Text style={styles.inviteCode}>@{auth?.username}</Text>
        <Text style={styles.inviteText}>{translateUI("Arkadaşın bu kodla katılıp 10 içeriği değerlendirince ikinize 7 gün Premium.")}</Text>
      </View>
      <View style={{ paddingHorizontal: 20, gap: 10, marginTop: 22 }}>
        <Pressable style={styles.cta} onPress={shared ? onDone : invite} accessibilityRole="button">
          <Text style={styles.ctaText}>{shared ? translateUI("Salona gir") : translateUI("Arkadaşını çağır")}</Text>
        </Pressable>
        {!shared && (
          <Pressable style={styles.ghost} onPress={onDone} accessibilityRole="button">
            <Text style={styles.ghostText}>{translateUI("Şimdilik geç")}</Text>
          </Pressable>
        )}
      </View>
    </ScrollView>
  );
}

export default function OnboardingScreen() {
  const { c } = useAppTheme();
  const { auth, markOnboardingComplete, markTutorialSeen } = useAuth();
  const insets = useSafeAreaInsets();
  const styles = makeStyles(c);
  const curtain = useCurtainWipe();
  const [act, setAct] = useState(1);
  const [result, setResult] = useState(null);
  const finishing = useRef(false);

  async function finish() {
    if (finishing.current) return;
    finishing.current = true;
    // Eski sekme turu gösterilmesin: önce onu kapat, sonra tanışmayı bitir.
    await markTutorialSeen();
    await markOnboardingComplete();
  }

  async function afterKunye() {
    // Linkle gelen kişiyi oyalama: doğrudan linkine (App.js tanışma bitince açıyor).
    if (await peekPendingLink()) { finish(); return; }
    curtain.run(() => setAct(3));
  }

  return (
    <View style={{ flex: 1, backgroundColor: "#100e10", paddingTop: insets.top + 8, paddingBottom: insets.bottom }}>
      {act === 1 && (
        <Makara
          auth={auth}
          styles={styles}
          onSkip={finish}
          onDone={(r) => { setResult(r); curtain.run(() => setAct(2)); }}
        />
      )}
      {act === 2 && <Kunye auth={auth} styles={styles} result={result} onDone={afterKunye} />}
      {act === 3 && <YanKoltuk auth={auth} styles={styles} onDone={finish} />}
      {curtain.overlay}
    </View>
  );
}

const styles2 = StyleSheet.create({
  seatBack: { width: 92, height: 74, borderTopLeftRadius: 26, borderTopRightRadius: 26, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  seatBase: { width: 108, height: 22, borderRadius: 8 },
  seatGold: { backgroundColor: GOLD },
  seatEmpty: { borderWidth: 1.5, borderStyle: "dashed", borderColor: "rgba(201,164,76,0.7)" },
  seatLabel: { fontFamily: FONTS.marquee, fontSize: 28 },
});

function makeStyles(c) {
  return StyleSheet.create({
    actHeader: { paddingHorizontal: 20, paddingTop: 6, paddingBottom: 10 },
    actTopRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
    actEyebrow: { color: GOLD, fontFamily: FONTS.monoMedium, fontSize: 10.5, letterSpacing: 1.6 },
    skip: { color: DIM, fontSize: 13, fontWeight: "700" },
    actTitle: { color: CREAM, fontFamily: FONTS.marquee, fontSize: 36, lineHeight: 38, marginTop: 6 },
    actSub: { color: DIM, fontSize: 13.5, lineHeight: 19, marginTop: 6 },

    strip: { marginHorizontal: 12, marginTop: 4, backgroundColor: "#0b0a0c", borderRadius: 8, paddingVertical: 4, borderWidth: 1, borderColor: "rgba(201,164,76,0.18)" },
    sprockets: { flexDirection: "row", justifyContent: "space-between", paddingHorizontal: 10 },
    hole: { width: 8, height: 5, borderRadius: 1.5, backgroundColor: "rgba(243,234,216,0.16)" },
    frames: { flexDirection: "row", gap: 8, paddingHorizontal: 8, paddingVertical: 5, justifyContent: "center" },
    frame: { borderRadius: 6, backgroundColor: "#1c1a24", borderWidth: 1, borderColor: "rgba(201,164,76,0.3)", alignItems: "center", justifyContent: "center", overflow: "hidden" },
    frameNo: { color: "rgba(201,164,76,0.5)", fontFamily: FONTS.marquee, fontSize: 18 },

    stage: { flex: 1, alignItems: "center", justifyContent: "center", paddingVertical: 10 },
    card: { borderRadius: 18, overflow: "hidden", backgroundColor: "#1c1a24", borderWidth: 1, borderColor: "rgba(201,164,76,0.3)" },
    cardMeta: { position: "absolute", left: 14, right: 14, bottom: 14 },
    cardTitle: { color: CREAM, fontFamily: FONTS.marquee, fontSize: 28, lineHeight: 30 },
    cardSub: { color: "rgba(243,234,216,0.75)", fontFamily: FONTS.monoMedium, fontSize: 11, marginTop: 4, letterSpacing: 0.4 },
    stamp: { position: "absolute", top: 18, borderWidth: 2, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4 },
    stampLike: { left: 16, borderColor: GOLD, transform: [{ rotate: "-12deg" }], backgroundColor: "rgba(20,18,26,0.55)" },
    stampPass: { right: 16, borderColor: CREAM, transform: [{ rotate: "12deg" }], backgroundColor: "rgba(20,18,26,0.55)" },
    stampLikeText: { color: GOLD, fontFamily: FONTS.marquee, fontSize: 24, letterSpacing: 1 },
    stampPassText: { color: CREAM, fontFamily: FONTS.marquee, fontSize: 24, letterSpacing: 1 },

    controls: { flexDirection: "row", alignItems: "center", justifyContent: "space-evenly", paddingHorizontal: 30, paddingBottom: 12 },
    roundBtn: { width: 58, height: 58, borderRadius: 29, alignItems: "center", justifyContent: "center", backgroundColor: c.surface, borderWidth: 1, borderColor: c.border },
    roundGold: { backgroundColor: GOLD, borderColor: GOLD },
    unknown: { color: DIM, fontSize: 13.5, fontWeight: "700" },
    ctaWrap: { position: "absolute", left: 20, right: 20, bottom: 14 },
    cta: { backgroundColor: GOLD, borderRadius: 999, paddingVertical: 16, alignItems: "center" },
    ctaText: { color: "#1a150c", fontWeight: "800", fontSize: 15.5 },
    ghost: { borderRadius: 999, paddingVertical: 15, alignItems: "center", borderWidth: 1, borderColor: "rgba(243,234,216,0.22)" },
    ghostText: { color: CREAM, fontWeight: "700", fontSize: 14.5 },

    sheet: { marginHorizontal: 20, marginTop: 8, borderRadius: 20, overflow: "hidden", borderWidth: 1, borderColor: "rgba(201,164,76,0.38)", backgroundColor: c.surface },
    sheetStage: { height: 190, alignItems: "center", justifyContent: "center", overflow: "hidden" },
    sheetPresents: { color: GOLD, fontFamily: FONTS.monoMedium, fontSize: 10.5, letterSpacing: 2.4 },
    sheetName: { color: CREAM, fontFamily: FONTS.marquee, fontSize: 64, lineHeight: 66, marginTop: 4, paddingHorizontal: 16 },
    sheetTag: { color: "rgba(243,234,216,0.75)", fontFamily: FONTS.monoMedium, fontSize: 10.5, letterSpacing: 2 },
    credits: { padding: 16, gap: 10 },
    creditRow: { flexDirection: "row", gap: 12, alignItems: "baseline" },
    creditKey: { width: 66, color: DIM, fontFamily: FONTS.monoMedium, fontSize: 10, letterSpacing: 1.2 },
    creditVal: { flex: 1, color: CREAM, fontSize: 14, fontWeight: "700" },
    likedRow: { flexDirection: "row", gap: 6, marginTop: 2 },
    likedThumb: { width: 38, height: 57, borderRadius: 5, borderWidth: 1, borderColor: "rgba(201,164,76,0.3)" },

    sectionLabel: { color: GOLD, fontFamily: FONTS.monoMedium, fontSize: 10.5, letterSpacing: 1.6, marginHorizontal: 20, marginTop: 24, marginBottom: 10 },
    recRow: { flexDirection: "row", gap: 10, paddingHorizontal: 20 },
    recPoster: { width: "100%", aspectRatio: 2 / 3, borderRadius: 10, borderWidth: 1, borderColor: "rgba(201,164,76,0.3)" },
    recSkeleton: { flex: 1, backgroundColor: "#1c1a24" },
    recTitle: { color: CREAM, fontFamily: FONTS.marquee, fontSize: 16, lineHeight: 17, marginTop: 6 },
    recEmpty: { color: DIM, fontSize: 13 },

    seats: { flexDirection: "row", justifyContent: "center", gap: 18, marginTop: 18 },
    inviteCard: { marginHorizontal: 20, marginTop: 26, borderRadius: 18, borderWidth: 1, borderColor: "rgba(201,164,76,0.45)", padding: 18, backgroundColor: INK },
    inviteKey: { color: DIM, fontFamily: FONTS.monoMedium, fontSize: 10.5, letterSpacing: 1.6 },
    inviteCode: { color: GOLD, fontFamily: FONTS.marquee, fontSize: 34, marginTop: 4 },
    inviteText: { color: CREAM, fontSize: 13, lineHeight: 19, marginTop: 6 },
  });
}
