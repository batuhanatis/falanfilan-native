import React, { useEffect, useState } from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Gamepad2, ChevronRight, Sparkles } from "lucide-react-native";
import { useAuth } from "../context/AuthContext";
import { playApi } from "../api/play";

export default function PlayHubCard({ navigation }) {
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
      style={styles.touch}
      activeOpacity={0.88}
      onPress={() => navigation.navigate("PellixPlay")}
    >
      <LinearGradient
        colors={["#6D28D9", "#2563EB", "#0891B2"]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.card}
      >
        <View style={styles.glowOne} />
        <View style={styles.glowTwo} />
        <Sparkles size={18} color="rgba(255,255,255,0.34)" style={styles.sparkle} />

        <View style={styles.iconWrap}>
          <Gamepad2 size={23} color="#fff" />
        </View>

        <View style={styles.copy}>
          <View style={styles.titleRow}>
            <Text style={styles.title}>pellix play</Text>
            <View style={styles.playBadge}><Text style={styles.playBadgeText}>OYNA</Text></View>
          </View>
          <Text style={styles.sub}>{enabledCount} mini oyun · zevkini keşfet, arkadaşlarını test et</Text>
        </View>

        <View style={styles.arrowWrap}>
          <ChevronRight size={19} color="#fff" />
        </View>
      </LinearGradient>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  // Yapay Zeka Köşesi ile Şu An Popüler arasında görsel olarak eşit nefes bırakır.
  touch: { marginTop: 18, marginBottom: 20, borderRadius: 20, overflow: "hidden" },
  card: {
    minHeight: 96, flexDirection: "row", alignItems: "center", gap: 13,
    borderRadius: 20, paddingHorizontal: 16, paddingVertical: 15,
    borderWidth: 1, borderColor: "rgba(255,255,255,0.16)", overflow: "hidden",
  },
  glowOne: {
    position: "absolute", width: 150, height: 150, borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.10)", top: -90, right: 34,
  },
  glowTwo: {
    position: "absolute", width: 100, height: 100, borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.07)", bottom: -60, left: 74,
  },
  sparkle: { position: "absolute", right: 54, top: 13 },
  iconWrap: {
    width: 50, height: 50, borderRadius: 16, alignItems: "center", justifyContent: "center",
    backgroundColor: "rgba(8,9,20,0.26)", borderWidth: 1, borderColor: "rgba(255,255,255,0.16)",
  },
  copy: { flex: 1 },
  titleRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  title: { fontFamily: "Baloo2_800ExtraBold", fontSize: 18, color: "#fff", letterSpacing: 0.1 },
  playBadge: { backgroundColor: "rgba(255,255,255,0.18)", borderRadius: 999, paddingHorizontal: 8, paddingVertical: 3 },
  playBadgeText: { color: "#fff", fontSize: 8.5, fontWeight: "900", letterSpacing: 0.8 },
  sub: { color: "rgba(255,255,255,0.82)", fontSize: 11.5, marginTop: 3, lineHeight: 16 },
  arrowWrap: {
    width: 34, height: 34, borderRadius: 999, alignItems: "center", justifyContent: "center",
    backgroundColor: "rgba(8,9,20,0.22)",
  },
});
