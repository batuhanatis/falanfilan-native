import React from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { ChevronLeft } from "lucide-react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAppTheme } from "../context/ThemeContext";

// Pushed ekranlarda aynı header dilini kullanmak için ortak bileşen.
// Sabit paddingTop değerleri yerine gerçek safe-area inset'ini kullanır; küçük/büyük iPhone,
// Dynamic Island ve Android status bar farklarında başlık hizası bozulmaz.
export default function ScreenHeader({ title, onBack, right = null, subtitle = null }) {
  const { c } = useAppTheme();
  const insets = useSafeAreaInsets();
  const styles = makeStyles(c);

  return (
    <View style={[styles.header, { paddingTop: Math.max(insets.top, 12) + 6 }]}>
      <View style={styles.side}>
        {!!onBack && (
          <TouchableOpacity
            style={styles.backBtn}
            onPress={onBack}
            activeOpacity={0.78}
            accessibilityRole="button"
            accessibilityLabel="Geri dön"
          >
            <ChevronLeft size={20} color={c.text} />
          </TouchableOpacity>
        )}
      </View>

      <View style={styles.center} pointerEvents="none">
        <Text style={styles.title} numberOfLines={1}>{title}</Text>
        {!!subtitle && <Text style={styles.subtitle} numberOfLines={1}>{subtitle}</Text>}
      </View>

      <View style={[styles.side, styles.right]}>{right}</View>
    </View>
  );
}

function makeStyles(c) {
  return StyleSheet.create({
    header: {
      flexDirection: "row",
      alignItems: "center",
      paddingHorizontal: 14,
      paddingBottom: 10,
      borderBottomWidth: 1,
      borderBottomColor: c.border,
      backgroundColor: c.bg,
    },
    side: { flex: 1, flexDirection: "row", alignItems: "center" },
    right: { justifyContent: "flex-end" },
    center: { flex: 1.7, alignItems: "center", justifyContent: "center" },
    backBtn: {
      width: 36,
      height: 36,
      borderRadius: 999,
      backgroundColor: c.surface2,
      borderWidth: 1,
      borderColor: c.border,
      alignItems: "center",
      justifyContent: "center",
    },
    title: { color: c.text, fontSize: 15, fontWeight: "800", textAlign: "center" },
    subtitle: { color: c.dim, fontSize: 10, marginTop: 1, textAlign: "center" },
  });
}
