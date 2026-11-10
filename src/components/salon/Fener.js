import { t as translateUI } from "../../i18n/core";
import React, { useEffect, useRef, useState } from "react";
import {
  Modal, View, Text, Pressable, Animated, Easing, StyleSheet, ScrollView, AccessibilityInfo, useWindowDimensions,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Svg, { Defs, LinearGradient as SvgLinearGradient, Stop, Polygon, RadialGradient, Circle } from "react-native-svg";
import { Filter, Flashlight } from "lucide-react-native";
import { useAppTheme } from "../../context/ThemeContext";
import { FONTS } from "../../theme/fonts";
import { GoldWash } from "./SalonKit";
import { hapticLight } from "../../utils/haptics";

// "Fener": filtre düğmesi ve panosu.
// Dokununca huni 180° dönüp el fenerine dönüşüyor (hunin geniş ağzı fenerin başı oluyor), fener
// yanıyor, başından aşağı altın bir ışık konisi uzanıyor ve pano o ışığın ucunda yukarıdan aşağı
// açılarak beliriyor; içerik en son geliyor. Kapatınca tersi: içerik söner, pano ışığa geri
// çekilir, ışık fenere döner, fener huniye. Pano açıkken arka plan çok koyu: fenerin aydınlattığı
// yer pano. Hareketi azalt açıksa yalnızca solma.
//
// Zaman çizelgesi (ms) — açılış: 0-300 dönüş · 230-490 ışık · 400-720 pano · 600-820 içerik.
// Kapanış: 0-110 içerik · 80-300 pano · 250-450 ışık · 380-640 dönüş ve karartma.

const GOLD = "#c9a44c";
const INK = "#14121a";
const ON_GOLD = "#1a150c";
const BEAM = 56;      // fenerin başından panoya kadar ışığın boyu
const SIDE = 16;      // panonun ekran kenarına uzaklığı

// Düğmenin içindeki simge: huni ↔ fener. `turn` 0 → huni, 1 → fener (180° dönmüş).
function Glyph({ turn, size = 16, funnelColor, lightColor }) {
  const rotate = turn.interpolate({ inputRange: [0, 1], outputRange: ["0deg", "180deg"] });
  const funnelOpacity = turn.interpolate({ inputRange: [0, 0.42, 0.58], outputRange: [1, 1, 0], extrapolate: "clamp" });
  const lightOpacity = turn.interpolate({ inputRange: [0.42, 0.58], outputRange: [0, 1], extrapolate: "clamp" });
  return (
    <Animated.View style={{ width: size + 2, height: size + 2, alignItems: "center", justifyContent: "center", transform: [{ rotate }] }}>
      <Animated.View style={{ position: "absolute", opacity: funnelOpacity }}>
        <Filter size={size} color={funnelColor} />
      </Animated.View>
      <Animated.View style={{ position: "absolute", opacity: lightOpacity }}>
        <Flashlight size={size + 1} color={lightColor} />
      </Animated.View>
    </Animated.View>
  );
}

export default function Fener({ style, active, title, subtitle, children, accessibilityLabel, doneLabel }) {
  const { c } = useAppTheme();
  const insets = useSafeAreaInsets();
  const { width: W, height: H } = useWindowDimensions();
  const styles = makeStyles(c);
  const triggerRef = useRef(null);
  const [anchor, setAnchor] = useState(null);

  const turn = useRef(new Animated.Value(0)).current;    // huni → fener
  const beam = useRef(new Animated.Value(0)).current;    // ışık konisi
  const panel = useRef(new Animated.Value(0)).current;   // pano açılışı
  const content = useRef(new Animated.Value(0)).current; // pano içeriği
  const dim = useRef(new Animated.Value(0)).current;     // arka plan karartması
  const running = useRef(null);
  const closing = useRef(false);
  const reduce = useRef(false);

  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled?.().then((r) => { reduce.current = !!r; }).catch(() => {});
    return () => running.current?.stop();
  }, []);

  const d = (ms) => (reduce.current ? 0 : ms);

  function open() {
    if (anchor) return;
    hapticLight();
    triggerRef.current?.measureInWindow((x, y, w, h) => {
      [turn, beam, panel, content, dim].forEach((v) => v.setValue(0));
      closing.current = false;
      setAnchor({ x, y, w, h });
      const anim = reduce.current
        ? Animated.parallel([turn, beam, panel, content, dim].map((v) => Animated.timing(v, { toValue: 1, duration: 180, useNativeDriver: true })))
        : Animated.parallel([
          Animated.timing(dim, { toValue: 1, duration: 320, easing: Easing.out(Easing.quad), useNativeDriver: true }),
          Animated.timing(turn, { toValue: 1, duration: 300, easing: Easing.out(Easing.back(1.3)), useNativeDriver: true }),
          Animated.timing(beam, { toValue: 1, duration: 260, delay: 230, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
          Animated.timing(panel, { toValue: 1, duration: 320, delay: 400, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
          Animated.timing(content, { toValue: 1, duration: 220, delay: 600, useNativeDriver: true }),
        ]);
      running.current = anim;
      anim.start();
    });
  }

  function close() {
    if (!anchor || closing.current) return;
    closing.current = true;
    running.current?.stop();
    hapticLight();
    const anim = reduce.current
      ? Animated.parallel([turn, beam, panel, content, dim].map((v) => Animated.timing(v, { toValue: 0, duration: 160, useNativeDriver: true })))
      : Animated.parallel([
        Animated.timing(content, { toValue: 0, duration: 110, useNativeDriver: true }),
        Animated.timing(panel, { toValue: 0, duration: 220, delay: 80, easing: Easing.in(Easing.cubic), useNativeDriver: true }),
        Animated.timing(beam, { toValue: 0, duration: 200, delay: 250, easing: Easing.in(Easing.cubic), useNativeDriver: true }),
        Animated.timing(turn, { toValue: 0, duration: 260, delay: 380, easing: Easing.inOut(Easing.cubic), useNativeDriver: true }),
        Animated.timing(dim, { toValue: 0, duration: 260, delay: 380, useNativeDriver: true }),
      ]);
    running.current = anim;
    anim.start(({ finished }) => {
      if (!finished) return;
      setAnchor(null);
      closing.current = false;
    });
  }

  // Tetikleyici düğmenin kendi görünümü (sekme satırında)
  const idleFunnel = active ? c.bg : c.text;

  // Işık ve pano yerleşimi
  const cx = anchor ? anchor.x + anchor.w / 2 : 0;
  const beamTop = anchor ? anchor.y + anchor.h - 8 : 0;
  const panelTop = anchor ? anchor.y + anchor.h + BEAM : 0;
  const panelMax = Math.max(220, H - panelTop - insets.bottom - 18);
  const left = SIDE, right = W - SIDE;

  return (
    <>
      <Pressable
        ref={triggerRef}
        style={({ pressed }) => [style, pressed && { opacity: 0.75 }]}
        onPress={open}
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel}
        accessibilityState={{ expanded: !!anchor }}
      >
        <Glyph turn={turn} funnelColor={idleFunnel} lightColor={GOLD} />
        {active && <View style={styles.dot} />}
      </Pressable>

      <Modal visible={!!anchor} transparent animationType="none" statusBarTranslucent onRequestClose={close}>
        {!!anchor && (
          <View style={StyleSheet.absoluteFill}>
            {/* Karartma: fenerin aydınlattığı yer dışında her şey karanlıkta */}
            <Animated.View style={[StyleSheet.absoluteFill, styles.dark, { opacity: dim }]}>
              <Pressable style={StyleSheet.absoluteFill} onPress={close} accessibilityLabel={translateUI("Filtreyi kapat")} />
            </Animated.View>

            {/* Işık konisi: fenerin başından panonun genişliğine açılıyor */}
            <Animated.View
              pointerEvents="none"
              style={{
                position: "absolute", left: 0, top: beamTop, width: W, height: BEAM + 14,
                opacity: beam.interpolate({ inputRange: [0, 0.15, 1], outputRange: [0, 1, 1] }),
                transform: [{ scaleY: beam.interpolate({ inputRange: [0, 1], outputRange: [0.02, 1] }) }],
                transformOrigin: "top",
              }}
            >
              <Svg width={W} height={BEAM + 14}>
                <Defs>
                  <SvgLinearGradient id="fenerBeam" x1="0" y1="0" x2="0" y2="1">
                    <Stop offset="0" stopColor={GOLD} stopOpacity="0.62" />
                    <Stop offset="1" stopColor={GOLD} stopOpacity="0.16" />
                  </SvgLinearGradient>
                  <SvgLinearGradient id="fenerHalo" x1="0" y1="0" x2="0" y2="1">
                    <Stop offset="0" stopColor={GOLD} stopOpacity="0.18" />
                    <Stop offset="1" stopColor={GOLD} stopOpacity="0.04" />
                  </SvgLinearGradient>
                </Defs>
                {/* geniş, sönük hale + parlak çekirdek */}
                <Polygon points={`${cx - 14},0 ${cx + 14},0 ${right + 10},${BEAM + 14} ${left - 10},${BEAM + 14}`} fill="url(#fenerHalo)" />
                <Polygon points={`${cx - 7},0 ${cx + 7},0 ${right},${BEAM + 14} ${left},${BEAM + 14}`} fill="url(#fenerBeam)" />
              </Svg>
            </Animated.View>

            {/* Pano: ışığın ucunda yukarıdan aşağı açılıyor */}
            <Animated.View
              style={[styles.panel, {
                top: panelTop, left, right: SIDE, maxHeight: panelMax,
                opacity: panel.interpolate({ inputRange: [0, 0.25, 1], outputRange: [0, 1, 1] }),
                transform: [{ scaleY: panel.interpolate({ inputRange: [0, 1], outputRange: [0.03, 1] }) }],
                transformOrigin: "top",
              }]}
            >
              <GoldWash height={190} strength={0.26} />
              <Animated.View style={{ opacity: content, flexShrink: 1 }}>
                <View style={styles.header}>
                  <Text style={styles.eyebrow}>{translateUI("FİLTRE")}</Text>
                  {!!title && <Text style={styles.title}>{title}</Text>}
                  {!!subtitle && <Text style={styles.subtitle}>{subtitle}</Text>}
                </View>
                <ScrollView
                  style={{ flexShrink: 1 }}
                  contentContainerStyle={styles.body}
                  showsVerticalScrollIndicator={false}
                  keyboardShouldPersistTaps="handled"
                >
                  {children}
                </ScrollView>
                <View style={styles.footer}>
                  <Pressable style={({ pressed }) => [styles.doneBtn, pressed && { opacity: 0.85 }]} onPress={close} accessibilityRole="button">
                    <Text style={styles.doneText}>{doneLabel || translateUI("Tamam")}</Text>
                  </Pressable>
                </View>
              </Animated.View>
              {/* Pano önce ışıkla dolu; içerik geldikçe ışık çekiliyor (kapanışta tersi) */}
              <Animated.View
                pointerEvents="none"
                style={[StyleSheet.absoluteFill, { backgroundColor: GOLD, opacity: content.interpolate({ inputRange: [0, 1], outputRange: [0.24, 0] }) }]}
              />
            </Animated.View>

            {/* Düğmenin kopyası, karartmanın üstünde: huni burada fenere dönüyor */}
            <Pressable
              onPress={close}
              accessibilityRole="button"
              accessibilityLabel={translateUI("Filtreyi kapat")}
              style={{ position: "absolute", left: anchor.x, top: anchor.y, width: anchor.w, height: anchor.h }}
            >
              <View style={[StyleSheet.absoluteFill, style, { margin: 0, marginLeft: 0, marginRight: 0, marginBottom: 0 }]} />
              <Animated.View style={[StyleSheet.absoluteFill, styles.lit, { borderRadius: anchor.h / 2, opacity: turn }]} />
              {/* fenerin başındaki parıltı */}
              <Animated.View pointerEvents="none" style={[styles.headGlow, { left: anchor.w / 2 - 22, top: anchor.h - 26, opacity: beam }]}>
                <Svg width={44} height={44}>
                  <Defs>
                    <RadialGradient id="fenerHead" cx="50%" cy="50%" r="50%">
                      <Stop offset="0" stopColor={GOLD} stopOpacity="0.85" />
                      <Stop offset="1" stopColor={GOLD} stopOpacity="0" />
                    </RadialGradient>
                  </Defs>
                  <Circle cx={22} cy={22} r={22} fill="url(#fenerHead)" />
                </Svg>
              </Animated.View>
              <View style={[StyleSheet.absoluteFill, { alignItems: "center", justifyContent: "center" }]}>
                <Glyph turn={turn} funnelColor={idleFunnel} lightColor={GOLD} />
              </View>
            </Pressable>
          </View>
        )}
      </Modal>
    </>
  );
}

function makeStyles(c) {
  return StyleSheet.create({
    dot: { position: "absolute", top: 3, right: 3, width: 7, height: 7, borderRadius: 999, backgroundColor: c.accent2, borderWidth: 1, borderColor: c.bg },
    dark: { backgroundColor: "rgba(4,3,6,0.9)" },
    lit: { backgroundColor: INK, borderWidth: 1.5, borderColor: GOLD },
    headGlow: { position: "absolute", width: 44, height: 44 },
    panel: {
      position: "absolute", borderRadius: 20, overflow: "hidden",
      backgroundColor: c.surface, borderWidth: 1, borderColor: "rgba(201,164,76,0.42)",
    },
    header: { paddingHorizontal: 18, paddingTop: 18, paddingBottom: 4 },
    eyebrow: { color: GOLD, fontFamily: FONTS.monoMedium, fontSize: 10, letterSpacing: 1.6 },
    title: { color: c.text, fontFamily: FONTS.marquee, fontSize: 28, lineHeight: 30, marginTop: 4 },
    subtitle: { color: c.dim, fontSize: 12.5, marginTop: 2 },
    body: { paddingHorizontal: 18, paddingBottom: 10 },
    footer: { paddingHorizontal: 18, paddingTop: 8, paddingBottom: 16, borderTopWidth: 1, borderTopColor: "rgba(201,164,76,0.18)" },
    doneBtn: { borderRadius: 999, paddingVertical: 13, alignItems: "center", backgroundColor: GOLD },
    doneText: { color: ON_GOLD, fontWeight: "800", fontSize: 14 },
  });
}
