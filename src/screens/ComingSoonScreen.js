import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { useAppTheme } from "../context/ThemeContext";

// Web uygulamasında bu ekranlar var ve backend zaten hazır — sadece native tarafı henüz yazılmadı.
export default function ComingSoonScreen({ route }) {
  const { c } = useAppTheme();
  const label = route?.params?.label || "Bu ekran";
  return (
    <View style={[styles.container, { backgroundColor: c.bg }]}>
      <Text style={[styles.title, { color: c.text }]}>{label} yakında burada</Text>
      <Text style={[styles.subtitle, { color: c.dim }]}>
        Bu ekran web uygulamasında zaten çalışıyor, native tarafa taşınması sıradaki adımlarda yapılacak.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: "center", justifyContent: "center", padding: 30 },
  title: { fontSize: 17, fontWeight: "700", textAlign: "center" },
  subtitle: { fontSize: 12, textAlign: "center", marginTop: 8, lineHeight: 18 },
});
