import React, { useEffect, useRef } from "react";
import { View, Text, Animated, Easing, StyleSheet, AccessibilityInfo } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { C, BOARD, FONTS, SAFE_X, SAFE_Y, HERO_H, HERO_W, HERO_MEDIA_W } from "../theme";

// "Huzme": yükleme ekranı. Ana ekranın iskeleti (pano + iki satır afiş yeri) ve üstünden
// projektör ışığı gibi geçen yumuşak bir huzme; "SEANS HAZIRLANIYOR" yazısının noktaları sırayla
// yanıyor. Tek bir katman, yalnızca transform/opacity (yerel sürücü) ile hareket ediyor.
// compact: yalnızca huzme + yazı (detay/arama gibi küçük alanlar için).
export default function Huzme({ label = "SEANS HAZIRLANIYOR", compact = false }) {
  const beam = useRef(new Animated.Value(0)).current;
  const dots = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    let loops = [];
    AccessibilityInfo.isReduceMotionEnabled?.().then((reduce) => {
      if (reduce) { dots.setValue(1); return; }
      loops = [
        Animated.loop(Animated.timing(beam, { toValue: 1, duration: 1800, easing: Easing.inOut(Easing.quad), useNativeDriver: true })),
        Animated.loop(Animated.timing(dots, { toValue: 1, duration: 1200, easing: Easing.linear, useNativeDriver: true })),
      ];
      loops.forEach((l) => l.start());
    }).catch(() => {});
    return () => loops.forEach((l) => l.stop());
  }, [beam, dots]);

  const beamX = beam.interpolate({ inputRange: [0, 1], outputRange: [-360, 1100] });
  const dot = (i) => dots.interpolate({ inputRange: [0, (i + 0.5) / 4, (i + 1) / 4, 1], outputRange: [0.2, 1, 0.2, 0.2], extrapolate: "clamp" });

  return (
    <View style={compact ? styles.compactRoot : styles.root} accessibilityLiveRegion="polite" accessibilityLabel="Yükleniyor">
      {!compact && (
        <>
          <View style={styles.hero}>
            <View style={styles.info}>
              <View style={[styles.bar, { width: 150, height: 10 }]} />
              <View style={[styles.plate]} />
              <View style={[styles.bar, { width: 220 }]} />
              <View style={[styles.bar, { width: 280 }]} />
              <View style={[styles.bar, { width: 240 }]} />
            </View>
            <View style={styles.media} />
          </View>
          {[0, 1].map((r) => (
            <View key={r} style={styles.row}>
              <View style={[styles.bar, { width: 160, height: 16, marginLeft: SAFE_X }]} />
              <View style={styles.posters}>
                {Array.from({ length: 7 }, (_, i) => <View key={i} style={styles.poster} />)}
              </View>
            </View>
          ))}
        </>
      )}
      <Animated.View pointerEvents="none" style={[styles.beam, { transform: [{ translateX: beamX }, { rotate: "12deg" }] }]}>
        <LinearGradient
          colors={["rgba(212,169,74,0)", "rgba(212,169,74,0.16)", "rgba(242,237,226,0.11)", "rgba(212,169,74,0)"]}
          start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
          style={StyleSheet.absoluteFill}
        />
      </Animated.View>
      <View style={compact ? styles.labelCompact : styles.labelWrap}>
        <Text style={styles.label}>{label}</Text>
        {[0, 1, 2].map((i) => <Animated.Text key={i} style={[styles.label, { opacity: dot(i) }]}>.</Animated.Text>)}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { ...StyleSheet.absoluteFillObject, backgroundColor: C.bg, paddingTop: SAFE_Y + 64, overflow: "hidden" },
  compactRoot: { height: 120, alignItems: "center", justifyContent: "center", overflow: "hidden" },
  hero: { width: HERO_W, height: HERO_H, marginLeft: SAFE_X, borderRadius: 18, backgroundColor: BOARD.bg, flexDirection: "row", overflow: "hidden" },
  info: { flex: 1, padding: 24, gap: 12 },
  plate: { height: 84, borderRadius: 6, backgroundColor: BOARD.plate, marginVertical: 4 },
  media: { width: HERO_MEDIA_W, backgroundColor: "#141210" },
  bar: { height: 12, borderRadius: 6, backgroundColor: C.surface2 },
  row: { marginTop: 22 },
  posters: { flexDirection: "row", paddingHorizontal: SAFE_X, marginTop: 12, gap: 16 },
  poster: { width: 112, height: 168, borderRadius: 8, backgroundColor: C.surface },
  beam: { position: "absolute", top: -120, bottom: -120, width: 320 },
  labelWrap: { position: "absolute", left: SAFE_X, top: SAFE_Y + 22, flexDirection: "row" },
  labelCompact: { flexDirection: "row" },
  label: { fontFamily: FONTS.monoMedium, fontSize: 12, color: BOARD.gold, letterSpacing: 2 },
});
