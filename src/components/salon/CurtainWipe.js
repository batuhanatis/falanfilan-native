import React, { useCallback, useEffect, useRef, useState } from "react";
import { View, Animated, Easing, StyleSheet, AccessibilityInfo, useWindowDimensions } from "react-native";
import { LinearGradient } from "expo-linear-gradient";

// Perde geçişi: iki kadife perde kenarlardan ortaya kapanıyor, perde kapalıyken sahne değişiyor,
// sonra perde açılıyor. Tanışma adımları arasında kullanılıyor ("bir sonraki perde").
// Kapanış 260 ms, açılış 340 ms; hareketi azalt açıksa kısa bir karartma.
const FOLDS = 5;

function CurtainHalf({ side }) {
  return (
    <View style={[StyleSheet.absoluteFill, { flexDirection: "row" }]}>
      {Array.from({ length: FOLDS }, (_, i) => (
        <LinearGradient key={i} colors={["#2e0c0e", "#6e2024", "#3a1012"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={{ flex: 1 }} />
      ))}
      <LinearGradient colors={["rgba(0,0,0,0)", "rgba(8,2,3,0.6)"]} style={StyleSheet.absoluteFill} />
      {/* perdenin ortadaki kenarında ince altın saçak */}
      <View style={[styles.fringe, side === "left" ? { right: 0 } : { left: 0 }]} />
    </View>
  );
}

export function useCurtainWipe() {
  const { width } = useWindowDimensions();
  const progress = useRef(new Animated.Value(0)).current; // 0 açık, 1 kapalı
  const [visible, setVisible] = useState(false);
  const reduce = useRef(false);
  const busy = useRef(false);

  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled?.().then((r) => { reduce.current = !!r; }).catch(() => {});
  }, []);

  // swap: perde kapalıyken çağrılır (adımı değiştir). Yeni sahne bir kare çizilsin diye kısa bekleme.
  const run = useCallback((swap) => {
    if (busy.current) return;
    busy.current = true;
    setVisible(true);
    const closeMs = reduce.current ? 120 : 260;
    const openMs = reduce.current ? 160 : 340;
    Animated.timing(progress, { toValue: 1, duration: closeMs, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start(() => {
      swap?.();
      setTimeout(() => {
        Animated.timing(progress, { toValue: 0, duration: openMs, delay: 60, easing: Easing.inOut(Easing.cubic), useNativeDriver: true }).start(() => {
          setVisible(false);
          busy.current = false;
        });
      }, 40);
    });
  }, [progress]);

  const half = width / 2 + 2;
  const overlay = visible ? (
    <View style={StyleSheet.absoluteFill} pointerEvents="auto">
      {reduce.current ? (
        <Animated.View style={[StyleSheet.absoluteFill, { backgroundColor: "#100e10", opacity: progress }]} />
      ) : (
        <>
          <Animated.View style={[styles.half, { left: 0, width: half, transform: [{ translateX: progress.interpolate({ inputRange: [0, 1], outputRange: [-half, 0] }) }] }]}>
            <CurtainHalf side="left" />
          </Animated.View>
          <Animated.View style={[styles.half, { right: 0, width: half, transform: [{ translateX: progress.interpolate({ inputRange: [0, 1], outputRange: [half, 0] }) }] }]}>
            <CurtainHalf side="right" />
          </Animated.View>
        </>
      )}
    </View>
  ) : null;

  return { run, overlay };
}

const styles = StyleSheet.create({
  half: { position: "absolute", top: 0, bottom: 0, overflow: "hidden" },
  fringe: { position: "absolute", top: 0, bottom: 0, width: 3, backgroundColor: "rgba(201,164,76,0.55)" },
});
