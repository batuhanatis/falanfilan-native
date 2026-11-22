import React, { useEffect, useRef, useState } from "react";
import { View, Animated, Easing } from "react-native";

// Düello ekranlarının ortak süre göstergeleri (birebir düello, grup düellosu).
// Süre sunucunun son tarihinden (deadline) ve saat farkından (offsetRef) hesaplanır.

export function useRemaining(deadline, offsetRef) {
  const calc = () => (deadline ? Math.max(0, deadline - (Date.now() + offsetRef.current)) : 0);
  const [left, setLeft] = useState(calc);
  useEffect(() => {
    setLeft(calc());
    if (!deadline) return;
    const t = setInterval(() => setLeft(calc()), 250);
    return () => clearInterval(t);
  }, [deadline]);
  return left;
}

// Fitil: süre çubuğu yanan bir fitil gibi soldan sağa kısalıyor, ucunda bir kıvılcım; son
// üçte birde kırmızıya dönüyor. Süreyi sunucunun son tarihinden hesaplıyor.
export function Fitil({ deadline, total, offsetRef, c }) {
  const anim = useRef(new Animated.Value(1)).current;
  const [width, setWidth] = useState(0);
  useEffect(() => {
    if (!deadline) return;
    const left = Math.max(0, deadline - (Date.now() + offsetRef.current));
    anim.setValue(Math.min(1, left / total));
    const a = Animated.timing(anim, { toValue: 0, duration: left, easing: Easing.linear, useNativeDriver: true });
    a.start();
    return () => a.stop();
  }, [deadline, total]);
  const danger = anim.interpolate({ inputRange: [0, 0.3, 0.31, 1], outputRange: [1, 1, 0, 0] });
  const sparkX = anim.interpolate({ inputRange: [0, 1], outputRange: [0, Math.max(0, width - 10)] });
  return (
    <View style={{ height: 14, justifyContent: "center" }} onLayout={(e) => setWidth(e.nativeEvent.layout.width)} accessibilityRole="progressbar">
      <View style={{ height: 4, borderRadius: 2, backgroundColor: c.surface2, overflow: "hidden" }}>
        <Animated.View style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: "100%", backgroundColor: c.accent, transformOrigin: "left", transform: [{ scaleX: anim }] }} />
        <Animated.View style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: "100%", backgroundColor: c.danger, opacity: danger, transformOrigin: "left", transform: [{ scaleX: anim }] }} />
      </View>
      {width > 0 && (
        <Animated.View style={{ position: "absolute", left: 0, width: 10, height: 10, borderRadius: 5, backgroundColor: "#ffe7a8", shadowColor: c.accent, shadowOpacity: 0.9, shadowRadius: 6, shadowOffset: { width: 0, height: 0 }, elevation: 4, transform: [{ translateX: sparkX }] }} />
      )}
    </View>
  );
}
