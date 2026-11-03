import React, { useEffect, useRef } from "react";
import { View, Text, Animated, Easing, StyleSheet, AccessibilityInfo, useWindowDimensions } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { FONTS } from "../theme";

// "Perde": açılış. Kadife perde kapalı, ortada ampullü bir sinema tabelası: "pellix". Ampuller
// tabelanın çevresinde sırayla yanıyor, sonra perde iki yana açılıp uygulama görünüyor. Toplam
// ~1,7 sn; yalnızca transform/opacity (yerel sürücü). "Hareketi azalt" açıksa hemen geçiyor.
// Bu sürede ana ekran arkada yükleniyor; açılış beklemeyi gizliyor.

const VELVET = ["#2a0a10", "#4e1420", "#2a0a10", "#5a1824", "#300b12", "#4a1320", "#2a0a10"];
const SIGN_W = 320;
const SIGN_H = 132;
const BULBS = (() => {
  // Tabela kenarı boyunca eşit aralıklı ampuller (saat yönünde).
  const per = { top: 9, side: 3 };
  const pts = [];
  for (let i = 0; i < per.top; i++) pts.push([12 + (i * (SIGN_W - 24)) / (per.top - 1), 0]);
  for (let i = 1; i <= per.side; i++) pts.push([SIGN_W, (i * SIGN_H) / (per.side + 1)]);
  for (let i = per.top - 1; i >= 0; i--) pts.push([12 + (i * (SIGN_W - 24)) / (per.top - 1), SIGN_H]);
  for (let i = per.side; i >= 1; i--) pts.push([0, (i * SIGN_H) / (per.side + 1)]);
  return pts;
})();

function CurtainHalf({ side, width, open }) {
  const dir = side === "left" ? -1 : 1;
  const x = open.interpolate({ inputRange: [0, 1], outputRange: [0, dir * (width + 40)] });
  return (
    <Animated.View style={[styles.half, { width: width + 30, [side]: -15, transform: [{ translateX: x }] }]}>
      <LinearGradient colors={VELVET} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={StyleSheet.absoluteFill} />
      <LinearGradient colors={["rgba(0,0,0,0.55)", "rgba(0,0,0,0)", "rgba(0,0,0,0.6)"]} locations={[0, 0.35, 1]} style={StyleSheet.absoluteFill} />
      <View style={[styles.hem, side === "left" ? { right: 0 } : { left: 0 }]} />
    </Animated.View>
  );
}

export default function Curtain({ onDone }) {
  const { width } = useWindowDimensions();
  const half = width / 2;
  const chase = useRef(new Animated.Value(0)).current;
  const open = useRef(new Animated.Value(0)).current;
  const sign = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    let cancelled = false;
    const loop = Animated.loop(Animated.timing(chase, { toValue: 1, duration: 900, easing: Easing.linear, useNativeDriver: true }));
    AccessibilityInfo.isReduceMotionEnabled?.().then((reduce) => {
      if (cancelled) return;
      if (reduce) { onDone(); return; }
      loop.start();
      Animated.sequence([
        Animated.timing(sign, { toValue: 1, duration: 260, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
        Animated.delay(520),
        Animated.parallel([
          Animated.timing(open, { toValue: 1, duration: 900, easing: Easing.inOut(Easing.cubic), useNativeDriver: true }),
          Animated.timing(sign, { toValue: 2, duration: 520, delay: 220, easing: Easing.in(Easing.quad), useNativeDriver: true }),
        ]),
      ]).start(() => { loop.stop(); if (!cancelled) onDone(); });
    }).catch(() => onDone());
    return () => { cancelled = true; loop.stop(); };
  }, [chase, open, sign, onDone]);

  const n = BULBS.length;
  const signOpacity = sign.interpolate({ inputRange: [0, 1, 2], outputRange: [0, 1, 0] });
  const signScale = sign.interpolate({ inputRange: [0, 1, 2], outputRange: [0.94, 1, 1.08] });
  const curtainFade = open.interpolate({ inputRange: [0, 0.85, 1], outputRange: [1, 1, 0] });

  return (
    <View style={styles.root} pointerEvents="none">
      <Animated.View style={[StyleSheet.absoluteFill, { opacity: curtainFade }]}>
        <CurtainHalf side="left" width={half} open={open} />
        <CurtainHalf side="right" width={half} open={open} />
        <View style={styles.valance} />
      </Animated.View>
      <Animated.View style={[styles.sign, { opacity: signOpacity, transform: [{ scale: signScale }] }]}>
        {BULBS.map(([bx, by], i) => {
          const p = i / n;
          const glow = chase.interpolate({
            inputRange: [0, Math.max(0, p - 0.12), p, Math.min(1, p + 0.12), 1],
            outputRange: [0.35, 0.35, 1, 0.35, 0.35],
          });
          return <Animated.View key={i} style={[styles.bulb, { left: bx - 5, top: by - 5, opacity: glow }]} />;
        })}
        <Text style={styles.logo}>pellix</Text>
        <Text style={styles.tag}>SEANS BAŞLIYOR</Text>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { ...StyleSheet.absoluteFillObject, alignItems: "center", justifyContent: "center", zIndex: 100 },
  half: { position: "absolute", top: 0, bottom: 0 },
  hem: { position: "absolute", top: 0, bottom: 0, width: 3, backgroundColor: "rgba(212,169,74,0.35)" },
  valance: { position: "absolute", left: 0, right: 0, top: 0, height: 34, backgroundColor: "#1f070c", borderBottomWidth: 2, borderBottomColor: "rgba(212,169,74,0.55)" },
  sign: {
    width: SIGN_W, height: SIGN_H, borderRadius: 18, borderWidth: 2, borderColor: "#d4a94a",
    backgroundColor: "rgba(13,11,10,0.92)", alignItems: "center", justifyContent: "center",
  },
  bulb: { position: "absolute", width: 10, height: 10, borderRadius: 5, backgroundColor: "#ffd98a" },
  logo: { fontFamily: FONTS.logo, fontSize: 64, lineHeight: 72, color: "#f2ede2" },
  tag: { fontFamily: FONTS.monoMedium, fontSize: 11, color: "#d4a94a", letterSpacing: 3, marginTop: -2 },
});
