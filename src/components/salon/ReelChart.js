import React, { useCallback, useMemo, useRef, useState } from "react";
import { View, Text, TouchableOpacity, Animated, Easing, StyleSheet, AccessibilityInfo } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import Svg, { Circle, G, Path } from "react-native-svg";
import { useAppTheme } from "../../context/ThemeContext";
import { FONTS } from "../../theme/fonts";

// Profildeki tür dağılımı bir film makarası: sarılı filmin halkası türlere göre bölünüyor,
// ortada makaranın göbeği ve üç boşluğu var. Ekran her açıldığında makara dönerek yerine
// oturuyor; bir türe dokununca o tür öne çıkıyor, diğerleri soluyor.
const COLORS = ["#c9a44c", "#c2604f", "#6f9fb0", "#7fa27a", "#a88ab0"];
const OTHER = "#8a8170";
const SIZE = 150;
const R = 74;
const STROKE = 34;
const CIRC = 2 * Math.PI * R;

function holePath(angle) {
  const a = (Math.PI / 180) * 70;
  const ox = Math.sin(a) * 50, oy = -Math.cos(a) * 50, ix = Math.sin(a) * 22, iy = -Math.cos(a) * 22;
  return { d: `M0 -50 A50 50 0 0 1 ${ox} ${oy} L${ix} ${iy} A22 22 0 0 0 0 -22 Z`, rotation: angle - 35 };
}
const HOLES = [0, 120, 240].map(holePath);

export default function ReelChart({ genres }) {
  const { c } = useAppTheme();
  const [selected, setSelected] = useState(-1);
  const spin = useRef(new Animated.Value(1)).current;

  const segments = useMemo(() => {
    const top = (genres || []).slice(0, 5).map((g, i) => ({ name: g.name, percent: Math.max(0, Math.round(Number(g.percent) || 0)), color: COLORS[i] }));
    const sum = top.reduce((acc, g) => acc + g.percent, 0);
    if (sum > 0 && sum < 100) top.push({ name: "Diğer", percent: 100 - sum, color: OTHER });
    const total = Math.max(100, sum);
    let offset = 0;
    return top.map((g) => {
      const len = (g.percent / total) * CIRC;
      const seg = { ...g, len, offset };
      offset += len;
      return seg;
    });
  }, [genres]);

  useFocusEffect(useCallback(() => {
    let cancelled = false;
    AccessibilityInfo.isReduceMotionEnabled().then((reduce) => {
      if (cancelled || reduce) return;
      spin.setValue(0);
      Animated.timing(spin, { toValue: 1, duration: 1200, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start();
    }).catch(() => {});
    return () => { cancelled = true; };
  }, [spin]));

  const rotate = spin.interpolate({ inputRange: [0, 1], outputRange: ["-200deg", "0deg"] });
  const toggle = (i) => setSelected((cur) => (cur === i ? -1 : i));

  return (
    <View style={styles.wrap}>
      <Animated.View style={{ width: SIZE, height: SIZE, transform: [{ rotate }] }} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
        <Svg width={SIZE} height={SIZE} viewBox="0 0 220 220">
          <Circle cx={110} cy={110} r={104} fill={c.surface2} stroke={c.border} strokeWidth={4} />
          <G transform="rotate(-90 110 110)">
            {segments.map((seg, i) => (
              <Circle
                key={seg.name}
                cx={110}
                cy={110}
                r={R}
                fill="none"
                stroke={seg.color}
                strokeWidth={selected === i ? STROKE + 6 : STROKE}
                strokeDasharray={`${Math.max(0, seg.len - 1.5)} ${CIRC}`}
                strokeDashoffset={-seg.offset}
                opacity={selected < 0 || selected === i ? 1 : 0.22}
                onPress={() => toggle(i)}
              />
            ))}
          </G>
          <Circle cx={110} cy={110} r={56} fill={c.border} />
          {HOLES.map((h, i) => (
            <Path key={i} d={h.d} fill={c.surface} transform={`translate(110 110) rotate(${h.rotation})`} />
          ))}
          <Circle cx={110} cy={110} r={12} fill={c.surface2} />
          <Circle cx={110} cy={110} r={5} fill={c.surface} />
        </Svg>
      </Animated.View>

      <View style={styles.legend}>
        {segments.map((seg, i) => (
          <TouchableOpacity
            key={seg.name}
            style={[styles.legendRow, selected === i && { backgroundColor: c.surface2 }]}
            onPress={() => toggle(i)}
            activeOpacity={0.8}
            accessibilityRole="button"
            accessibilityLabel={`${seg.name}, yüzde ${seg.percent}`}
            accessibilityState={{ selected: selected === i }}
          >
            <View style={[styles.swatch, { backgroundColor: seg.color }]} />
            <Text style={[styles.legendName, { color: c.text }]} numberOfLines={1}>{seg.name}</Text>
            <Text style={[styles.legendPercent, { color: c.dim }]}>%{seg.percent}</Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flexDirection: "row", alignItems: "center", gap: 14, marginTop: 14 },
  legend: { flex: 1, minWidth: 0 },
  legendRow: { minHeight: 32, flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 6, borderRadius: 8 },
  swatch: { width: 10, height: 10, borderRadius: 2 },
  legendName: { flex: 1, fontSize: 13, fontWeight: "500" },
  legendPercent: { fontFamily: FONTS.mono, fontSize: 12 },
});
