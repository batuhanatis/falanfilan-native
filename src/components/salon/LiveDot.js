import React, { useEffect, useRef } from "react";
import { Animated, AccessibilityInfo } from "react-native";

// Canlı odaların yanındaki yavaşça yanıp sönen nokta. Hareket azaltma açıkken sabit durur.
export default function LiveDot({ color, size = 7 }) {
  const opacity = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    let loop = null;
    let cancelled = false;
    AccessibilityInfo.isReduceMotionEnabled().then((reduce) => {
      if (reduce || cancelled) return;
      loop = Animated.loop(Animated.sequence([
        Animated.timing(opacity, { toValue: 0.25, duration: 700, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 1, duration: 700, useNativeDriver: true }),
      ]));
      loop.start();
    }).catch(() => {});
    return () => { cancelled = true; loop?.stop(); };
  }, [opacity]);
  return <Animated.View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: color, opacity }} />;
}
