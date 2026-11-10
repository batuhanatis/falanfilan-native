import { t as translateUI } from "../i18n/core";
import React, { useEffect, useRef, useState } from "react";
import { View, Text, Pressable, StyleSheet, Animated, Easing, AccessibilityInfo } from "react-native";
import Svg, { Defs, LinearGradient as SvgGradient, Stop, Polygon } from "react-native-svg";
import { MessageSquareText, Wand2, ScanSearch } from "lucide-react-native";
import { useAppTheme } from "../context/ThemeContext";
import { FONTS } from "../theme/fonts";
import DescribeModal from "./DescribeModal";
import TasteRecommendModal from "./TasteRecommendModal";
import PhotoIdentifyModal from "./PhotoIdentifyModal";

// Yapay Zeka Köşesi — "Makine Dairesi". Salonun projeksiyon odası gibi: solda bir mercek,
// mercekten kartın üstüne yayılan soluk bir ışık huzmesi, altta bir film şeridi. Şeridin üç
// karesi üç araç; dokunulan kare ışığı alır (altın çerçeve) ve araç açık kaldıkça yanık durur.
// Eskiden mor/mavi gradyanlı, açılıp kapanan bir paneldi ve araçlar ancak açınca görünüyordu.
// "Bu Akşamı Planla" hemen üstteki bilet kartında olduğu için burada tekrar edilmiyor.
const FRAMES = [
  { key: "describe", no: "01", Icon: MessageSquareText, title: "Anlat, Bulalım", hint: "Ne istediğini yaz" },
  { key: "taste", no: "02", Icon: Wand2, title: "Bana Göre Öner", hint: "Beğenilerinden seçer" },
  { key: "photo", no: "03", Icon: ScanSearch, title: "Fotoğraftan Bul", hint: "Sahneden adını bulur" },
];
const HOLES = 16;

function SprocketRow({ color }) {
  return (
    <View style={sprocket.row} pointerEvents="none">
      {Array.from({ length: HOLES }, (_, i) => <View key={i} style={[sprocket.hole, { backgroundColor: color }]} />)}
    </View>
  );
}

export default function AIZone({ navigation, hasResults, onResults, onClear }) {
  const { c } = useAppTheme();
  const styles = makeStyles(c);
  const [open, setOpen] = useState(null); // "describe" | "taste" | "photo" | null
  const [size, setSize] = useState({ w: 0, h: 0 });

  // Huzme yavaşça nefes alıyor (3 sn). "Hareketi azalt" açıksa sabit duruyor.
  const glow = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    let loop;
    let alive = true;
    AccessibilityInfo.isReduceMotionEnabled?.()
      .catch(() => false)
      .then((reduce) => {
        if (!alive || reduce) return;
        loop = Animated.loop(
          Animated.sequence([
            Animated.timing(glow, { toValue: 0.55, duration: 1600, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
            Animated.timing(glow, { toValue: 1, duration: 1600, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
          ])
        );
        loop.start();
      });
    return () => { alive = false; loop?.stop(); };
  }, [glow]);

  const { w, h } = size;
  const lx = 33;
  const ly = 33;

  return (
    <View>
      <View
        style={styles.card}
        onLayout={(e) => {
          const { width, height } = e.nativeEvent.layout;
          if (Math.abs(width - w) > 1 || Math.abs(height - h) > 1) setSize({ w: width, h: height });
        }}
      >
        {w > 0 && (
          <Animated.View style={[StyleSheet.absoluteFillObject, { opacity: glow }]} pointerEvents="none">
            <Svg width={w} height={h}>
              <Defs>
                <SvgGradient id="aiBeam" x1={lx} y1={ly} x2={w} y2={ly} gradientUnits="userSpaceOnUse">
                  <Stop offset="0" stopColor={c.accent} stopOpacity={0.26} />
                  <Stop offset="0.55" stopColor={c.accent} stopOpacity={0.06} />
                  <Stop offset="1" stopColor={c.accent} stopOpacity={0} />
                </SvgGradient>
              </Defs>
              <Polygon points={`${lx},${ly - 5} ${w},${-18} ${w},${ly + 44} ${lx},${ly + 5}`} fill="url(#aiBeam)" />
            </Svg>
          </Animated.View>
        )}

        <View style={styles.header}>
          <View style={styles.lens}>
            <Animated.View style={[styles.lensCore, { opacity: glow }]} />
            <View style={styles.lensGlint} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.eyebrow}>{translateUI("PELLIX AI")}</Text>
            <Text style={styles.title} numberOfLines={1}>{translateUI("Yapay Zeka Köşesi")}</Text>
          </View>
        </View>

        <View style={styles.strip}>
          <SprocketRow color={c.surface2} />
          <View style={styles.frames}>
            {FRAMES.map(({ key, no, Icon, title, hint }) => {
              const lit = open === key;
              return (
                <Pressable
                  key={key}
                  onPress={() => setOpen(key)}
                  accessibilityRole="button"
                  accessibilityLabel={`${translateUI(title)}. ${translateUI(hint)}`}
                  style={({ pressed }) => [styles.frame, (pressed || lit) && styles.frameLit]}
                >
                  <View style={styles.frameTop}>
                    <Icon size={17} color={c.accent} />
                    <Text style={styles.frameNo}>{no}</Text>
                  </View>
                  <Text style={styles.frameTitle} numberOfLines={2}>{translateUI(title)}</Text>
                  <Text style={styles.frameHint} numberOfLines={2}>{translateUI(hint)}</Text>
                </Pressable>
              );
            })}
          </View>
          <SprocketRow color={c.surface2} />
        </View>
      </View>

      {open === "describe" && (
        <DescribeModal
          onClose={() => setOpen(null)}
          onResults={onResults}
          onClear={onClear}
          hasResults={hasResults}
          navigation={navigation}
        />
      )}
      {open === "taste" && (
        <TasteRecommendModal
          onClose={() => setOpen(null)}
          onResults={(results) => onResults(results, "Sana göre önerilerin")}
          navigation={navigation}
        />
      )}
      {open === "photo" && <PhotoIdentifyModal onClose={() => setOpen(null)} navigation={navigation} />}
    </View>
  );
}

const sprocket = StyleSheet.create({
  row: { flexDirection: "row", justifyContent: "space-between", paddingHorizontal: 5 },
  hole: { width: 8, height: 5, borderRadius: 1.5 },
});

function makeStyles(c) {
  return StyleSheet.create({
    card: {
      marginTop: 12, backgroundColor: c.surface, borderWidth: 1, borderColor: c.border, borderRadius: 14,
      paddingHorizontal: 14, paddingTop: 14, paddingBottom: 13, overflow: "hidden",
    },
    header: { flexDirection: "row", alignItems: "center", gap: 12 },
    lens: {
      width: 38, height: 38, borderRadius: 19, borderWidth: 1.5, borderColor: c.accent, backgroundColor: c.bg,
      alignItems: "center", justifyContent: "center",
    },
    lensCore: { width: 16, height: 16, borderRadius: 8, backgroundColor: c.accent },
    lensGlint: { position: "absolute", top: 12, left: 13, width: 4, height: 4, borderRadius: 2, backgroundColor: "rgba(255,255,255,0.75)" },
    eyebrow: { fontFamily: FONTS.monoMedium, fontSize: 10.5, letterSpacing: 1, color: c.accent },
    title: { fontFamily: FONTS.marquee, fontSize: 24, color: c.text, marginTop: 1 },

    strip: { marginTop: 13, backgroundColor: c.bg, borderRadius: 8, paddingVertical: 6, gap: 6 },
    frames: { flexDirection: "row", gap: 5, paddingHorizontal: 5 },
    frame: {
      flex: 1, backgroundColor: c.surface, borderWidth: 1, borderColor: c.border, borderRadius: 5,
      paddingHorizontal: 9, paddingTop: 9, paddingBottom: 10,
    },
    frameLit: { borderColor: c.accent, backgroundColor: c.surface2 },
    frameTop: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
    frameNo: { fontFamily: FONTS.monoMedium, fontSize: 9, letterSpacing: 0.6, color: c.dim },
    frameTitle: { marginTop: 9, fontSize: 12.5, lineHeight: 15.5, fontWeight: "800", color: c.text },
    frameHint: { marginTop: 3, fontSize: 10, lineHeight: 13, color: c.dim },
  });
}
