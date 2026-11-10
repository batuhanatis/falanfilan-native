import { t as translateUI } from "../../i18n/core";
import React, { useEffect, useRef, useState } from "react";
import { View, Text, Image, Pressable, StyleSheet, Animated, Easing, AccessibilityInfo, useWindowDimensions } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Heart, Ticket } from "lucide-react-native";
import { FONTS } from "../../theme/fonts";
import { Spotlight } from "../../components/salon/OneSheet";
import { api } from "../../api/client";

// "Fuaye": hesap açılmadan önceki ilk ekran. Sinema fuayesinde dönen üç sahnelik bir fragman
// gibi: (1) kararsız bir afiş yığınından tek bir öneri yükselir, (2) iki kişinin ortak beğenisi
// eşleşir, (3) uyum yüzdesi sayarak yükselir. Sahneler kendiliğinden ilerler (hikâye çubukları),
// ekranın sağına/soluna dokununca ileri/geri gider. Altta "Bilet al" (kayıt) ve "Zaten üyeyim".
// Afişler gerçek: giriş gerektirmeyen /api/public/movies'in en bilinen yapımlarından rastgele
// seçiliyor. Yüklenene kadar (ya da bağlantı yoksa) yerlerinde adsız, soyut kartlar duruyor.

const GOLD = "#c9a44c";
const CREAM = "#f3ead8";
const DIM = "#8c8579";
const INK = "#14121a";
const SCENE_MS = 4800;

const SCENES = [
  { eyebrow: "1 · NE İZLESEK?", title: "Ne izleyeceğine saniyede karar ver", sub: "Pellix beğenilerini öğrenir, sana tek bir isabetli öneri çıkarır." },
  { eyebrow: "2 · BİRLİKTE SEÇİN", title: "Arkadaşınla kaydır, ortak filmi bul", sub: "MatchParty'de ikiniz de beğenince eşleşme anında düşer." },
  { eyebrow: "3 · UYUMUNUZ", title: "Kiminle aynı frekanstasın?", sub: "Blend, arkadaşlarınla izleme uyumunu yüzdeyle gösterir." },
];

// Afiş yüklenene kadar duran adsız kart renkleri
const PLACEHOLDERS = [
  { colors: ["#1b2a4a", "#0d1424"], sun: "#7fb4ff" },
  { colors: ["#3b2a4e", "#16101f"], sun: "#ffcf7a" },
  { colors: ["#6b3d1a", "#24140a"], sun: "#ffe0a0" },
];

function shuffle(list) {
  const a = [...list];
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}

// Gerçek afiş; yüklenince adsız kartın üstüne yumuşakça geliyor.
function MiniPoster({ uri, slot = 0, width = 92, style, glow }) {
  const height = Math.round(width * 1.5);
  const ph = PLACEHOLDERS[slot % PLACEHOLDERS.length];
  const shown = useRef(new Animated.Value(0)).current;
  return (
    <View style={[{ width, height, borderRadius: 10, overflow: "hidden", borderWidth: 1, borderColor: glow ? GOLD : "rgba(201,164,76,0.3)", backgroundColor: INK }, style]}>
      <LinearGradient colors={ph.colors} style={StyleSheet.absoluteFill} />
      <View style={{ position: "absolute", top: height * 0.2, alignSelf: "center", width: width * 0.42, height: width * 0.42, borderRadius: width, backgroundColor: ph.sun, opacity: 0.35 }} />
      {!!uri && (
        <Animated.Image
          source={{ uri }}
          style={[StyleSheet.absoluteFill, { opacity: shown }]}
          onLoad={() => Animated.timing(shown, { toValue: 1, duration: 260, useNativeDriver: true }).start()}
        />
      )}
    </View>
  );
}

function Ring({ letter, size = 64 }) {
  return (
    <View style={{ width: size, height: size, borderRadius: size / 2, borderWidth: 2, borderColor: GOLD, backgroundColor: INK, alignItems: "center", justifyContent: "center" }}>
      <Text style={{ color: GOLD, fontFamily: FONTS.marquee, fontSize: size * 0.46 }}>{letter}</Text>
    </View>
  );
}

// Sahne 1: üç afiş yelpaze gibi duruyor; ortadaki öne çıkıp büyüyor, altın çerçeve ve rozet.
function SceneOne({ t, posters }) {
  const lift = t.interpolate({ inputRange: [0.25, 0.6], outputRange: [0, 1], extrapolate: "clamp" });
  const side = t.interpolate({ inputRange: [0.25, 0.6], outputRange: [1, 0.45], extrapolate: "clamp" });
  const badge = t.interpolate({ inputRange: [0.6, 0.75], outputRange: [0, 1], extrapolate: "clamp" });
  return (
    <View style={styles.stageInner}>
      <Animated.View style={{ position: "absolute", opacity: side, transform: [{ translateX: -78 }, { rotate: "-12deg" }, { translateY: 12 }] }}>
        <MiniPoster uri={posters[0]} slot={0} />
      </Animated.View>
      <Animated.View style={{ position: "absolute", opacity: side, transform: [{ translateX: 78 }, { rotate: "12deg" }, { translateY: 12 }] }}>
        <MiniPoster uri={posters[2]} slot={2} />
      </Animated.View>
      <Animated.View style={{ transform: [{ translateY: lift.interpolate({ inputRange: [0, 1], outputRange: [0, -14] }) }, { scale: lift.interpolate({ inputRange: [0, 1], outputRange: [1, 1.22] }) }] }}>
        <MiniPoster uri={posters[1]} slot={1} width={104} glow />
      </Animated.View>
      <Animated.View style={[styles.pill, { position: "absolute", bottom: 6, opacity: badge, transform: [{ scale: badge.interpolate({ inputRange: [0, 1], outputRange: [0.7, 1] }) }] }]}>
        <Text style={styles.pillText}>{translateUI("BU AKŞAM BU")}</Text>
      </Animated.View>
    </View>
  );
}

// Sahne 2: iki koltuk (D ve E), ortadaki afiş sağa kayıyor, iki tarafta kalp, sonra "EŞLEŞME".
function SceneTwo({ t, posters }) {
  const swipe = t.interpolate({ inputRange: [0.15, 0.45], outputRange: [0, 1], extrapolate: "clamp" });
  const heartA = t.interpolate({ inputRange: [0.3, 0.42], outputRange: [0, 1], extrapolate: "clamp" });
  const heartB = t.interpolate({ inputRange: [0.48, 0.6], outputRange: [0, 1], extrapolate: "clamp" });
  const match = t.interpolate({ inputRange: [0.62, 0.76], outputRange: [0, 1], extrapolate: "clamp" });
  const heart = (v, x) => (
    <Animated.View style={{ position: "absolute", top: 4, left: x, opacity: v, transform: [{ scale: v.interpolate({ inputRange: [0, 1], outputRange: [0.4, 1] }) }] }}>
      <Heart size={18} color={GOLD} fill={GOLD} />
    </Animated.View>
  );
  return (
    <View style={styles.stageInner}>
      <View style={{ position: "absolute", left: 18, top: 24 }}><Ring letter="D" /></View>
      <View style={{ position: "absolute", right: 18, top: 24 }}><Ring letter="E" /></View>
      {heart(heartA, 66)}
      <Animated.View style={{ position: "absolute", top: 4, right: 66, opacity: heartB, transform: [{ scale: heartB.interpolate({ inputRange: [0, 1], outputRange: [0.4, 1] }) }] }}>
        <Heart size={18} color={GOLD} fill={GOLD} />
      </Animated.View>
      <Animated.View style={{ transform: [
        { translateX: swipe.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0, 26, 0] }) },
        { rotate: swipe.interpolate({ inputRange: [0, 0.5, 1], outputRange: ["0deg", "7deg", "0deg"] }) },
        { scale: match.interpolate({ inputRange: [0, 1], outputRange: [1, 1.08] }) },
      ] }}>
        <MiniPoster uri={posters[3]} slot={2} width={100} glow={false} />
      </Animated.View>
      <Animated.View style={[styles.pill, { position: "absolute", bottom: 6, opacity: match, transform: [{ scale: match.interpolate({ inputRange: [0, 1], outputRange: [0.7, 1] }) }] }]}>
        <Text style={styles.pillText}>{translateUI("EŞLEŞME")}</Text>
      </Animated.View>
    </View>
  );
}

// Sahne 3: iki koltuk yaklaşıyor, ortada yüzde sayarak yükseliyor.
function SceneThree({ t, posters }) {
  const [pct, setPct] = useState(0);
  useEffect(() => {
    const id = t.addListener(({ value }) => setPct(Math.round(87 * Math.min(1, Math.max(0, (value - 0.15) / 0.5)))));
    return () => t.removeListener(id);
  }, [t]);
  const close = t.interpolate({ inputRange: [0, 0.4], outputRange: [0, 1], extrapolate: "clamp" });
  const shared = t.interpolate({ inputRange: [0.62, 0.85], outputRange: [0, 1], extrapolate: "clamp" });
  return (
    <View style={styles.stageInner}>
      <Animated.View style={{ position: "absolute", top: 18, transform: [{ translateX: close.interpolate({ inputRange: [0, 1], outputRange: [-120, -92] }) }] }}><Ring letter="D" size={58} /></Animated.View>
      <Animated.View style={{ position: "absolute", top: 18, transform: [{ translateX: close.interpolate({ inputRange: [0, 1], outputRange: [120, 92] }) }] }}><Ring letter="E" size={58} /></Animated.View>
      <Text style={styles.bigPct}>%{pct}</Text>
      <Text style={styles.bigPctLabel}>{translateUI("UYUM")}</Text>
      {/* uyumu doğuran ortak beğeniler */}
      <Animated.View style={{ flexDirection: "row", gap: 8, marginTop: 14, opacity: shared, transform: [{ translateY: shared.interpolate({ inputRange: [0, 1], outputRange: [10, 0] }) }] }}>
        {[4, 5, 0].map((i, k) => <MiniPoster key={i} uri={posters[i]} slot={k} width={42} />)}
      </Animated.View>
    </View>
  );
}

export default function Fuaye({ onSignup, onLogin, hasInvite }) {
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();
  const [scene, setScene] = useState(0);
  const t = useRef(new Animated.Value(0)).current;
  const bars = useRef(SCENES.map(() => new Animated.Value(0))).current;
  const fade = useRef(new Animated.Value(1)).current;
  const reduce = useRef(false);
  const timer = useRef(null);
  const [posters, setPosters] = useState([]);

  // En bilinen yapımlardan 6 afiş (her açılışta farklı karışım); küçük boy, önceden indiriliyor.
  useEffect(() => {
    let alive = true;
    api.publicMovies()
      .then((data) => {
        const urls = shuffle((data?.results || []).map((m) => m?.poster).filter(Boolean)).slice(0, 6)
          .map((u) => u.replace("/w500/", "/w342/"));
        urls.forEach((u) => Image.prefetch(u).catch(() => {}));
        if (alive) setPosters(urls);
      })
      .catch(() => {});
    return () => { alive = false; };
  }, []);

  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled?.().then((r) => { reduce.current = !!r; }).catch(() => {});
  }, []);

  useEffect(() => {
    // sahne başlarken: metin ve sahne yumuşakça gelir, çizim zamanlayıcısı ve çubuk dolar
    bars.forEach((b, i) => b.setValue(i < scene ? 1 : 0));
    t.setValue(reduce.current ? 1 : 0);
    fade.setValue(0);
    const anim = Animated.parallel([
      Animated.timing(fade, { toValue: 1, duration: 260, useNativeDriver: true }),
      Animated.timing(t, { toValue: 1, duration: reduce.current ? 0 : 2600, easing: Easing.inOut(Easing.cubic), useNativeDriver: false }),
      Animated.timing(bars[scene], { toValue: 1, duration: SCENE_MS, easing: Easing.linear, useNativeDriver: false }),
    ]);
    anim.start();
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setScene((s) => (s + 1) % SCENES.length), SCENE_MS);
    return () => { anim.stop(); clearTimeout(timer.current); };
  }, [scene]); // eslint-disable-line react-hooks/exhaustive-deps

  const s = SCENES[scene];
  // Sahne kalan boşluğu dolduruyor; çizimler 300x260 tasarlandı, uzun ekranlarda biraz büyütülüyor.
  const sceneScale = Math.max(0.8, Math.min(1.3, (height * 0.4) / 260));

  return (
    <View style={styles.root}>
      {/* sahne çerçevesi: iki yanda kadife perde, üstte spot */}
      <LinearGradient colors={["#5a1a1e", "#2a0b0d", "#100e10"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={[styles.drape, { left: 0 }]} />
      <LinearGradient colors={["#100e10", "#2a0b0d", "#5a1a1e"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={[styles.drape, { right: 0 }]} />
      <Spotlight id="fuayeSpot" />

      <View style={{ paddingTop: insets.top + 14, paddingHorizontal: 24 }}>
        <Text style={styles.wordmark}>PELLIX</Text>
        <View style={styles.bars}>
          {bars.map((b, i) => (
            <View key={i} style={styles.barTrack}>
              <Animated.View style={[styles.barFill, { width: b.interpolate({ inputRange: [0, 1], outputRange: ["0%", "100%"] }) }]} />
            </View>
          ))}
        </View>
      </View>

      {/* dokunma alanları: sol geri, sağ ileri */}
      <View style={styles.stage}>
        <Animated.View style={[StyleSheet.absoluteFill, { opacity: fade, alignItems: "center", justifyContent: "center", transform: [{ scale: sceneScale }] }]}>
          {scene === 0 ? <SceneOne t={t} posters={posters} /> : scene === 1 ? <SceneTwo t={t} posters={posters} /> : <SceneThree t={t} posters={posters} />}
        </Animated.View>
        <View style={[StyleSheet.absoluteFill, { flexDirection: "row" }]}>
          <Pressable style={{ flex: 1 }} onPress={() => setScene((x) => (x + SCENES.length - 1) % SCENES.length)} accessibilityLabel={translateUI("Önceki sahne")} />
          <Pressable style={{ flex: 1 }} onPress={() => setScene((x) => (x + 1) % SCENES.length)} accessibilityLabel={translateUI("Sonraki sahne")} />
        </View>
      </View>

      <Animated.View style={[styles.copy, { opacity: fade }]}>
        <Text style={styles.eyebrow}>{translateUI(s.eyebrow)}</Text>
        <Text style={styles.title}>{translateUI(s.title)}</Text>
        <Text style={styles.sub}>{translateUI(s.sub)}</Text>
      </Animated.View>

      <View style={[styles.actions, { paddingBottom: Math.max(20, insets.bottom + 12) }]}>
        {hasInvite && (
          <View style={styles.invite}>
            <Ticket size={14} color={GOLD} />
            <Text style={styles.inviteText}>{translateUI("Seni bir davet bekliyor: hesabını açınca oraya götüreceğiz.")}</Text>
          </View>
        )}
        <Pressable style={({ pressed }) => [styles.primary, pressed && { opacity: 0.88 }]} onPress={onSignup} accessibilityRole="button">
          <Text style={styles.primaryText}>{translateUI("Bilet al · Ücretsiz")}</Text>
        </Pressable>
        <Pressable style={({ pressed }) => [styles.secondary, pressed && { opacity: 0.8 }]} onPress={onLogin} accessibilityRole="button">
          <Text style={styles.secondaryText}>{translateUI("Zaten üyeyim")}</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#100e10" },
  drape: { position: "absolute", top: 0, bottom: 0, width: 26, opacity: 0.9 },
  wordmark: { color: GOLD, fontFamily: FONTS.marquee, fontSize: 22, letterSpacing: 7, textAlign: "center" },
  bars: { flexDirection: "row", gap: 6, marginTop: 14 },
  barTrack: { flex: 1, height: 3, borderRadius: 2, backgroundColor: "rgba(243,234,216,0.16)", overflow: "hidden" },
  barFill: { height: 3, backgroundColor: GOLD },
  stage: { flex: 1, marginTop: 10, marginHorizontal: 24, minHeight: 230 },
  stageInner: { width: 300, height: 260, alignItems: "center", justifyContent: "center" },
  pill: { backgroundColor: GOLD, borderRadius: 999, paddingHorizontal: 14, paddingVertical: 6 },
  pillText: { color: "#1a150c", fontFamily: FONTS.monoMedium, fontSize: 11, letterSpacing: 1.6 },
  bigPct: { color: GOLD, fontFamily: FONTS.marquee, fontSize: 96, lineHeight: 100, marginTop: 58 },
  bigPctLabel: { color: DIM, fontFamily: FONTS.monoMedium, fontSize: 12, letterSpacing: 4 },
  copy: { paddingHorizontal: 28, paddingTop: 6, paddingBottom: 22, minHeight: 190 },
  eyebrow: { color: GOLD, fontFamily: FONTS.monoMedium, fontSize: 11, letterSpacing: 1.8 },
  title: { color: CREAM, fontFamily: FONTS.marquee, fontSize: 40, lineHeight: 42, marginTop: 8 },
  sub: { color: DIM, fontSize: 14.5, lineHeight: 21, marginTop: 10 },
  actions: { paddingHorizontal: 24, gap: 10 },
  invite: { flexDirection: "row", alignItems: "center", gap: 8, borderWidth: 1, borderColor: "rgba(201,164,76,0.45)", borderRadius: 14, paddingHorizontal: 12, paddingVertical: 9 },
  inviteText: { flex: 1, color: CREAM, fontSize: 12.5, lineHeight: 17 },
  primary: { backgroundColor: GOLD, borderRadius: 999, paddingVertical: 16, alignItems: "center" },
  primaryText: { color: "#1a150c", fontWeight: "800", fontSize: 15.5 },
  secondary: { borderRadius: 999, paddingVertical: 15, alignItems: "center", borderWidth: 1, borderColor: "rgba(243,234,216,0.22)" },
  secondaryText: { color: CREAM, fontWeight: "700", fontSize: 14.5 },
});
