import React, { useEffect, useMemo, useState } from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Gamepad2, ChevronRight, Sparkles, CalendarDays } from "lucide-react-native";
import { useAuth } from "../context/AuthContext";
import { playApi } from "../api/play";

const GAME_COPY = {
  taste_battle: { title: "Taste Battle", line: "Hızlı seçimlerle zevk profilini netleştir" },
  friend_quiz: { title: "Arkadaşını Tanıyor musun?", line: "Bir arkadaşının ne seçeceğini tahmin et" },
  blind_pick: { title: "Blind Pick", line: "Poster yok; yalnızca ipuçlarına güven" },
  who_said_it: { title: "Who Said It?", line: "İkonik anın karakterini bul" },
  character_quiz: { title: "Hangi Karaktersin?", line: "Kısa testle ekran karakterini keşfet" },
};

function localDayNumber() {
  const now = new Date();
  return Math.floor(new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime() / 86400000);
}

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

  const enabledKeys = useMemo(
    () => features ? Object.keys(GAME_COPY).filter((key) => features[key]) : [],
    [features]
  );

  if (enabledKeys.length === 0) return null;

  // Her kullanıcı aynı gün aynı "günün oyunu"nu görür. Yeni backend state'i gerektirmeden
  // Play'i statik bir feature vitrini olmaktan çıkarıp günlük geri dönüş yüzeyine dönüştürüyor.
  const dailyKey = enabledKeys[Math.abs(localDayNumber()) % enabledKeys.length];
  const daily = GAME_COPY[dailyKey];

  return (
    <TouchableOpacity
      style={styles.touch}
      activeOpacity={0.88}
      onPress={() => navigation.navigate("PellixPlay", { initialGame: dailyKey })}
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
          <View style={styles.eyebrowRow}>
            <CalendarDays size={10} color="rgba(255,255,255,0.78)" />
            <Text style={styles.eyebrow}>BUGÜNÜN OYUNU</Text>
          </View>
          <View style={styles.titleRow}>
            <Text style={styles.title}>{daily.title}</Text>
            <View style={styles.playBadge}><Text style={styles.playBadgeText}>OYNA</Text></View>
          </View>
          <Text style={styles.sub}>{daily.line}</Text>
          {enabledKeys.length > 1 && <Text style={styles.moreGames}>+ {enabledKeys.length - 1} mini oyun daha Pellix Play'de</Text>}
        </View>

        <View style={styles.arrowWrap}>
          <ChevronRight size={19} color="#fff" />
        </View>
      </LinearGradient>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  touch: { marginTop: 16, marginBottom: 18, borderRadius: 20, overflow: "hidden" },
  card: {
    minHeight: 112, flexDirection: "row", alignItems: "center", gap: 13,
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
  eyebrowRow: { flexDirection: "row", alignItems: "center", gap: 4, marginBottom: 2 },
  eyebrow: { color: "rgba(255,255,255,0.76)", fontSize: 8.5, fontWeight: "900", letterSpacing: 0.8 },
  titleRow: { flexDirection: "row", alignItems: "center", gap: 7 },
  title: { fontFamily: "Baloo2_800ExtraBold", fontSize: 17, color: "#fff", letterSpacing: 0.1, flexShrink: 1 },
  playBadge: { backgroundColor: "rgba(255,255,255,0.18)", borderRadius: 999, paddingHorizontal: 7, paddingVertical: 3 },
  playBadgeText: { color: "#fff", fontSize: 8, fontWeight: "900", letterSpacing: 0.7 },
  sub: { color: "rgba(255,255,255,0.82)", fontSize: 10.8, marginTop: 2, lineHeight: 15 },
  moreGames: { color: "rgba(255,255,255,0.56)", fontSize: 9.2, marginTop: 4, fontWeight: "700" },
  arrowWrap: {
    width: 34, height: 34, borderRadius: 999, alignItems: "center", justifyContent: "center",
    backgroundColor: "rgba(8,9,20,0.22)",
  },
});
