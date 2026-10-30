import React, { useCallback, useEffect, useState } from "react";
import { View, Text, Pressable, StyleSheet } from "react-native";
import Svg, { Path } from "react-native-svg";
import Animated, { useSharedValue, useAnimatedProps, useAnimatedStyle, withSpring, runOnJS } from "react-native-reanimated";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAppTheme } from "../context/ThemeContext";
import { hapticSelection } from "../utils/haptics";

// Seçili sekme, çubuğun üst kenarındaki bir "çukur"un içinde altın bir dairede durur. Sekme
// değişince çukur yaylanarak kayar; hızlı giderken uzar ve dibi biraz geriden gelir (sıvı hissi).
// Hız için ayrı bir kare döngüsü kurmuyoruz: önde giden (x) ve daha yumuşak yaylı arkadan gelen
// (tail) iki değer var, aradaki fark hızla orantılı — çukurun uzaması bu farktan hesaplanıyor.
// Çukur parmakla da sürüklenebiliyor; sürüklerken sadece görsel seçim değişiyor, ekran parmak
// kalkınca değişiyor (her sekmenin üzerinden geçerken ekranları art arda açmamak için).

const AnimatedPath = Animated.createAnimatedComponent(Path);

const TOP = 14; // çubuğun üst kenarı, kapsayıcının tepesinden
const BAR_H = 64; // güvenli alan hariç çubuk yüksekliği
const DEPTH = 30; // çukur derinliği
const FLUID = 0.6; // uzama miktarı (0 = katı, 1 = çok akışkan)
const BUBBLE = 56;
const LEAD = { stiffness: 260, damping: 20, mass: 1 };
const TRAIL = { stiffness: 150, damping: 18, mass: 1 };

export default function LiquidTabBar({ state, descriptors, navigation }) {
  const { c } = useAppTheme();
  const insets = useSafeAreaInsets();
  const n = state.routes.length;
  const [width, setWidth] = useState(0);
  const [shown, setShown] = useState(state.index); // sürüklerken parmağın altındaki, yoksa açık sekme

  const W = useSharedValue(0);
  const x = useSharedValue(0);
  const tail = useSharedValue(0);
  const dragging = useSharedValue(false);
  const hover = useSharedValue(state.index);

  const height = TOP + BAR_H + insets.bottom;

  useEffect(() => {
    if (!width || dragging.value) return;
    const cx = (width / n) * (state.index + 0.5);
    x.value = withSpring(cx, LEAD);
    tail.value = withSpring(cx, TRAIL);
    hover.value = state.index;
    setShown(state.index);
  }, [state.index, width, n]);

  const onLayout = useCallback((e) => {
    const w = e.nativeEvent.layout.width;
    W.value = w;
    const cx = (w / n) * (state.index + 0.5);
    x.value = cx;
    tail.value = cx;
    setWidth(w);
  }, [n, state.index]);

  // Varsayılan sekme çubuğuyla aynı olaylar: Sohbet sekmesinin tabPress dinleyicisi (sohbet
  // listesine dönüş) gibi davranışlar bozulmasın.
  const select = useCallback((i) => {
    const route = state.routes[i];
    if (!route) return;
    const focused = state.index === i;
    const event = navigation.emit({ type: "tabPress", target: route.key, canPreventDefault: true });
    if (!focused && !event.defaultPrevented) {
      hapticSelection();
      navigation.navigate(route.name, route.params);
    }
  }, [state, navigation]);

  const onHover = useCallback((i) => { setShown(i); hapticSelection(); }, []);
  const onDragEnd = useCallback((i) => {
    if (i === state.index) { setShown(i); return; }
    const route = state.routes[i];
    const event = navigation.emit({ type: "tabPress", target: route.key, canPreventDefault: true });
    if (!event.defaultPrevented) navigation.navigate(route.name, route.params);
    else setShown(state.index);
  }, [state, navigation]);

  const pan = Gesture.Pan()
    .activeOffsetX([-10, 10])
    .failOffsetY([-20, 20])
    .onStart(() => { dragging.value = true; })
    .onUpdate((e) => {
      const slot = W.value / n;
      const cx = Math.min(Math.max(e.x, slot / 2), W.value - slot / 2);
      x.value = cx;
      tail.value = withSpring(cx, TRAIL);
      const i = Math.min(n - 1, Math.max(0, Math.floor(cx / slot)));
      if (i !== hover.value) { hover.value = i; runOnJS(onHover)(i); }
    })
    .onFinalize(() => {
      if (!dragging.value) return;
      dragging.value = false;
      const cx = (W.value / n) * (hover.value + 0.5);
      x.value = withSpring(cx, LEAD);
      tail.value = withSpring(cx, TRAIL);
      runOnJS(onDragEnd)(hover.value);
    });

  const pathProps = useAnimatedProps(() => {
    const w = W.value;
    const speed = Math.min(Math.abs(x.value - tail.value) / 28, 1);
    const hw = 38 + FLUID * 34 * speed;
    const s = 24 + FLUID * 14 * speed;
    const cx = x.value, bx = tail.value, h = TOP + BAR_H + 200;
    const x0 = cx - hw - s, x1 = cx + hw + s;
    return {
      d: `M0 ${TOP} L${x0} ${TOP} C${x0 + s * 0.75} ${TOP} ${bx - hw * 0.9} ${TOP + DEPTH} ${bx} ${TOP + DEPTH} `
        + `C${bx + hw * 0.9} ${TOP + DEPTH} ${x1 - s * 0.75} ${TOP} ${x1} ${TOP} L${w} ${TOP} L${w} ${h} L0 ${h} Z`,
    };
  });

  const bubbleStyle = useAnimatedStyle(() => {
    const speed = Math.min(Math.abs(x.value - tail.value) / 28, 1);
    return {
      transform: [
        { translateX: (x.value + tail.value) / 2 - BUBBLE / 2 },
        { translateY: TOP + DEPTH - 36 - BUBBLE / 2 },
        { scaleX: 1 + FLUID * 0.38 * speed },
        { scaleY: 1 - FLUID * 0.16 * speed },
      ],
    };
  });

  // Sohbet içindeki konuşma ekranı çubuğu tabBarStyle: { display: "none" } ile gizliyor.
  const focusedOptions = descriptors[state.routes[state.index].key].options;
  if (focusedOptions.tabBarStyle?.display === "none") return null;

  const shownOptions = descriptors[state.routes[shown]?.key]?.options || {};
  const shownBadge = shownOptions.tabBarBadge;

  return (
    <GestureDetector gesture={pan}>
      <View style={[styles.wrap, { height, backgroundColor: c.bg }]} onLayout={onLayout}>
        {width > 0 && (
          <Svg width={width} height={height} style={StyleSheet.absoluteFill} pointerEvents="none">
            <AnimatedPath animatedProps={pathProps} fill={c.surface2} stroke={c.border} strokeWidth={1} />
          </Svg>
        )}

        <View style={[styles.row, { top: TOP + 8 }]}>
          {state.routes.map((route, i) => {
            const options = descriptors[route.key].options;
            const label = options.title ?? route.name;
            const active = i === shown;
            const badge = options.tabBarBadge;
            return (
              <Pressable
                key={route.key}
                style={styles.tab}
                onPress={() => select(i)}
                onLongPress={() => navigation.emit({ type: "tabLongPress", target: route.key })}
                accessibilityRole="tab"
                accessibilityState={{ selected: state.index === i }}
                accessibilityLabel={options.tabBarAccessibilityLabel ?? (badge ? `${label}, ${badge} okunmamış` : label)}
              >
                <View style={[styles.iconBox, { opacity: active ? 0 : 1 }]}>
                  {options.tabBarIcon?.({ focused: false, color: c.dim, size: 23 })}
                  {badge != null && (
                    <View style={[styles.badge, { backgroundColor: c.danger }, options.tabBarBadgeStyle]}>
                      <Text style={styles.badgeText}>{badge}</Text>
                    </View>
                  )}
                </View>
                <Text style={[styles.label, { color: active ? c.accent : c.dim, transform: [{ translateY: active ? 6 : 0 }] }]} numberOfLines={1}>
                  {label}
                </Text>
              </Pressable>
            );
          })}
        </View>

        <Animated.View pointerEvents="none" style={[styles.bubble, { backgroundColor: c.accent, shadowColor: c.accent }, bubbleStyle]}>
          {shownOptions.tabBarIcon?.({ focused: true, color: c.bg, size: 24 })}
          {shownBadge != null && (
            <View style={[styles.badge, styles.bubbleBadge, { backgroundColor: c.danger, borderColor: c.accent }, shownOptions.tabBarBadgeStyle]}>
              <Text style={styles.badgeText}>{shownBadge}</Text>
            </View>
          )}
        </Animated.View>
      </View>
    </GestureDetector>
  );
}

const styles = StyleSheet.create({
  wrap: { width: "100%", overflow: "visible" },
  row: { position: "absolute", left: 0, right: 0, flexDirection: "row" },
  tab: { flex: 1, alignItems: "center", paddingTop: 2, paddingBottom: 6 },
  iconBox: { height: 26, justifyContent: "center", alignItems: "center" },
  label: { fontSize: 11, fontWeight: "600", marginTop: 3 },
  badge: { position: "absolute", top: -4, left: 14, minWidth: 18, height: 18, borderRadius: 9, paddingHorizontal: 5, alignItems: "center", justifyContent: "center" },
  bubbleBadge: { top: 2, left: 34, borderWidth: 2 },
  badgeText: { color: "#fff", fontSize: 10, fontWeight: "800" },
  bubble: {
    position: "absolute", left: 0, top: 0, width: BUBBLE, height: BUBBLE, borderRadius: BUBBLE / 2,
    alignItems: "center", justifyContent: "center",
    shadowOpacity: 0.35, shadowRadius: 12, shadowOffset: { width: 0, height: 6 }, elevation: 8,
  },
});
