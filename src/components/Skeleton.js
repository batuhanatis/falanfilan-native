import React, { useEffect, useRef } from "react";
import { Animated, View } from "react-native";
import { useAppTheme } from "../context/ThemeContext";

// Ekran açılırken (ya da bir bölüm yüklenirken) tek bir dönen spinner yerine, gerçek içeriğin
// KABA HATLARINI taklit eden nabız gibi (pulse) atan gri bloklar — "az önce neredeydim" hissini
// kesmiyor, içeriğin nereye geleceğini önceden gösteriyor. Tüm skeleton bileşenleri bunun
// üzerine kuruluyor (bkz. ActivitySkeleton, ProfileSkeleton, ChatListSkeleton, comment/cast
// satırları DetailScreen içinde).
export function SkeletonBlock({ width, height, radius = 8, style }) {
  const { c } = useAppTheme();
  const opacity = useRef(new Animated.Value(0.45)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 1, duration: 650, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0.45, duration: 650, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [opacity]);

  return (
    <Animated.View
      style={[
        { width, height, borderRadius: radius, backgroundColor: c.surface2, opacity },
        style,
      ]}
    />
  );
}
