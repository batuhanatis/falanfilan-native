import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useAppTheme } from "../../context/ThemeContext";
import { FONTS } from "../../theme/fonts";

// Salon dilinin küçük ortak parçaları. Renkli gradyanlı "kahraman" kartların yerine: koyu
// yüzey, ince altın çerçeve, üstten yumuşak altın ışık, DM Mono künye, Big Shoulders başlık.
export const SALON = {
  gold: "#c9a44c",
  cream: "#f3ead8",
  dim: "#8c8579",
  ink: "#14121a",
  night: "#100e10",
  onGold: "#1a150c",
  goldLine: "rgba(201,164,76,0.34)",
  goldTint: "rgba(201,164,76,0.12)",
};

// Kartın üstünden süzülen yumuşak altın ışık (projektör huzmesi gibi). Kartın içine, ilk çocuk
// olarak konur; kartın overflow: "hidden" olması gerekir.
export function GoldWash({ height = 160, strength = 0.16, style }) {
  return (
    <LinearGradient
      colors={[`rgba(201,164,76,${strength})`, "rgba(201,164,76,0)"]}
      style={[{ position: "absolute", left: 0, right: 0, top: 0, height }, style]}
      pointerEvents="none"
    />
  );
}

// Altın halkalı simge (lobi kapısı dilindeki gibi).
export function GoldRing({ icon: Icon, size = 46, iconSize = 21, style }) {
  const { c } = useAppTheme();
  return (
    <View style={[{ width: size, height: size, borderRadius: size / 2, borderWidth: 1.5, borderColor: c.accent, backgroundColor: c.bg, alignItems: "center", justifyContent: "center" }, style]}>
      {!!Icon && <Icon size={iconSize} color={c.accent} />}
    </View>
  );
}

// Renkli gradyan kahraman kartın Salon karşılığı.
export function SalonHero({ eyebrow, title, subtitle, icon, align = "left", children, style, titleSize = 30 }) {
  const { c } = useAppTheme();
  const center = align === "center";
  return (
    <View style={[styles.hero, { backgroundColor: c.surface }, center && { alignItems: "center" }, style]}>
      <GoldWash />
      {!!icon && <GoldRing icon={icon} style={{ marginBottom: 12 }} />}
      {!!eyebrow && <Text style={[styles.eyebrow, { color: c.accent }, center && { textAlign: "center" }]}>{eyebrow}</Text>}
      {!!title && <Text style={[styles.title, { color: c.text, fontSize: titleSize, lineHeight: Math.round(titleSize * 1.08) }, center && { textAlign: "center" }]}>{title}</Text>}
      {!!subtitle && <Text style={[styles.subtitle, { color: c.dim }, center && { textAlign: "center" }]}>{subtitle}</Text>}
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  hero: { borderRadius: 18, borderWidth: 1, borderColor: SALON.goldLine, padding: 20, overflow: "hidden" },
  eyebrow: { fontFamily: FONTS.monoMedium, fontSize: 10, letterSpacing: 1.4 },
  title: { fontFamily: FONTS.marquee, marginTop: 4 },
  subtitle: { fontSize: 12.5, lineHeight: 18, marginTop: 6 },
});
