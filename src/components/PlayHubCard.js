import React, { useEffect, useState } from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { Gamepad2, ChevronRight } from "lucide-react-native";
import { useAppTheme } from "../context/ThemeContext";
import { useAuth } from "../context/AuthContext";
import { playApi } from "../api/play";

export default function PlayHubCard({ navigation }) {
  const { c } = useAppTheme();
  const { auth } = useAuth();
  const [features, setFeatures] = useState(null);

  useEffect(() => {
    let cancelled = false;

    const loadFeatures = () => {
      playApi.features(auth.token)
        .then((d) => { if (!cancelled) setFeatures(d.features || {}); })
        .catch(() => { if (!cancelled) setFeatures(null); });
    };

    loadFeatures();
    const unsub = navigation.addListener("focus", loadFeatures);
    return () => {
      cancelled = true;
      unsub();
    };
  }, [auth.token, navigation]);

  if (!features || !Object.values(features).some(Boolean)) return null;
  const enabledCount = Object.values(features).filter(Boolean).length;

  return (
    <TouchableOpacity
      style={[styles.card, { backgroundColor: c.surface, borderColor: c.border }]}
      activeOpacity={0.8}
      onPress={() => navigation.navigate("PellixPlay")}
    >
      <View style={[styles.iconWrap, { backgroundColor: `${c.accent}1f` }]}>
        <Gamepad2 size={20} color={c.accent} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={[styles.title, { color: c.text }]}>Pellix Play</Text>
        <Text style={[styles.sub, { color: c.dim }]}>{enabledCount} mini oyun · zevkini keşfet, arkadaşlarını test et</Text>
      </View>
      <ChevronRight size={18} color={c.dim} />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: { flexDirection: "row", alignItems: "center", gap: 12, borderWidth: 1, borderRadius: 14, padding: 13, marginTop: 12 },
  iconWrap: { width: 40, height: 40, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  title: { fontSize: 14, fontWeight: "800" },
  sub: { fontSize: 11, marginTop: 2, lineHeight: 15 },
});
