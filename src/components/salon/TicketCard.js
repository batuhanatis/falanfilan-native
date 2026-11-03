import { t as translateUI } from "../../i18n/core";
import React from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { ChevronRight } from "lucide-react-native";
import { useAppTheme } from "../../context/ThemeContext";
import { FONTS } from "../../theme/fonts";

// Sinema bileti biçiminde bir giriş: solda ana bölüm, sağda kesik çizgiyle ayrılmış koçan.
// Kesik çizginin iki ucundaki yarım daire oyuklar, kartın oturduğu zeminin rengiyle çiziliyor
// (notchColor) — üstünde durduğu yüzey neyse onu vermek gerekiyor.
export default function TicketCard({ eyebrow, title, subtitle, onPress, notchColor, accessibilityLabel, style }) {
  const { c } = useAppTheme();
  const notch = notchColor || c.bg;
  return (
    <TouchableOpacity
      style={[styles.wrap, style]}
      onPress={onPress}
      activeOpacity={0.86}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel || title}
    >
      <View style={[styles.main, { backgroundColor: c.surface, borderColor: c.border }]}>
        {!!eyebrow && <Text style={[styles.eyebrow, { color: c.accent }]}>{eyebrow}</Text>}
        <Text style={[styles.title, { color: c.text }]} numberOfLines={1}>{title}</Text>
        {!!subtitle && <Text style={[styles.subtitle, { color: c.dim }]} numberOfLines={2}>{translateUI(subtitle)}</Text>}
      </View>
      <View style={[styles.stub, { backgroundColor: c.surface, borderColor: c.border }]}>
        <View style={[styles.perforation, { borderColor: c.border }]} />
        <ChevronRight size={20} color={c.accent} />
      </View>
      <View style={[styles.notch, styles.notchTop, { backgroundColor: notch, borderColor: c.border }]} />
      <View style={[styles.notch, styles.notchBottom, { backgroundColor: notch, borderColor: c.border }]} />
    </TouchableOpacity>
  );
}

const STUB = 62;
const NOTCH = 18;
const styles = StyleSheet.create({
  wrap: { flexDirection: "row", minHeight: 88, overflow: "hidden" },
  main: { flex: 1, borderWidth: 1, borderRightWidth: 0, borderTopLeftRadius: 14, borderBottomLeftRadius: 14, paddingHorizontal: 16, paddingVertical: 14, justifyContent: "center" },
  stub: { width: STUB, borderWidth: 1, borderLeftWidth: 0, borderTopRightRadius: 14, borderBottomRightRadius: 14, alignItems: "center", justifyContent: "center" },
  perforation: { position: "absolute", left: 0, top: 10, bottom: 10, borderLeftWidth: 1.5, borderStyle: "dashed" },
  notch: { position: "absolute", right: STUB - NOTCH / 2, width: NOTCH, height: NOTCH, borderRadius: NOTCH / 2, borderWidth: 1 },
  notchTop: { top: -NOTCH / 2 },
  notchBottom: { bottom: -NOTCH / 2 },
  eyebrow: { fontFamily: FONTS.monoMedium, fontSize: 10.5, letterSpacing: 1 },
  title: { fontFamily: FONTS.marquee, fontSize: 25, marginTop: 2 },
  subtitle: { fontSize: 12.5, lineHeight: 17, marginTop: 3 },
});
