import React, { useEffect, useMemo, useState } from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Gamepad2, ChevronRight, Sparkles, CalendarDays, Eye, Swords } from "lucide-react-native";
import { useAuth } from "../context/AuthContext";
import { playApi } from "../api/play";
import { friendBattleApi } from "../api/friendBattle";

export default function PlayHubCard({ navigation }) {
  const { auth } = useAuth();
  const [features, setFeatures] = useState(null);
  const [battleInfo, setBattleInfo] = useState(null);

  useEffect(() => {
    let cancelled = false;

    const loadFeatures = () => {
      playApi.features(auth.token)
        .then((d) => { if (!cancelled) setFeatures(d.features || {}); })
        .catch(() => { if (!cancelled) setFeatures(null); });

      // Friend Battle ayrı backend rollout'una sahip. Endpoint mevcutsa satırı gösteriyoruz;
      // API henüz deploy edilmediyse Ana Sayfa'da hiçbir kırık CTA görünmüyor.
      friendBattleApi.inbox(auth.token)
        .then((d) => {
          if (cancelled) return;
          const battles = d.battles || [];
          setBattleInfo({
            total: battles.length,
            waitingForMe: battles.filter((b) => !b.mySubmitted && b.createdByMe === false && b.status !== "completed").length,
            resultReady: battles.filter((b) => b.status === "completed").length,
          });
        })
        .catch(() => { if (!cancelled) setBattleInfo(null); });
    };

    loadFeatures();
    const unsub = navigation.addListener("focus", loadFeatures);
    return () => {
      cancelled = true;
      unsub();
    };
  }, [auth.token, navigation]);

  const enabledCount = useMemo(
    () => features ? Object.values(features).filter(Boolean).length : 0,
    [features]
  );

  return (
    <View style={styles.wrap}>
      <TouchableOpacity activeOpacity={0.88} onPress={() => navigation.navigate("DailyPosterPuzzle")}>
        <LinearGradient
          colors={["#6D28D9", "#4F46E5", "#2563EB"]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.card}
        >
          <View style={styles.glowOne} />
          <View style={styles.glowTwo} />
          <Sparkles size={17} color="rgba(255,255,255,0.32)" style={styles.sparkle} />

          <View style={styles.iconWrap}>
            <Eye size={23} color="#fff" />
          </View>

          <View style={styles.copy}>
            <View style={styles.eyebrowRow}>
              <CalendarDays size={10} color="rgba(255,255,255,0.78)" />
              <Text style={styles.eyebrow}>BUGÜNÜN OYUNU</Text>
            </View>
            <View style={styles.titleRow}>
              <Text style={styles.title}>Poster Puzzle</Text>
              <View style={styles.playBadge}><Text style={styles.playBadgeText}>GÜNLÜK</Text></View>
            </View>
            <Text style={styles.sub}>Bulanık posteri mümkün olan en az ipucuyla bul</Text>
          </View>

          <View style={styles.arrowWrap}>
            <ChevronRight size={19} color="#fff" />
          </View>
        </LinearGradient>
      </TouchableOpacity>

      {battleInfo && (
        <TouchableOpacity style={styles.battleRow} onPress={() => navigation.navigate("FriendBattle")} activeOpacity={0.8}>
          <View style={styles.battleIcon}><Swords size={15} color="#FB7185" /></View>
          <View style={{ flex: 1 }}>
            <View style={styles.rowTitleLine}>
              <Text style={styles.battleTitle}>Friend Battle</Text>
              <View style={styles.newBadge}><Text style={styles.newBadgeText}>YENİ</Text></View>
            </View>
            <Text style={styles.battleSub}>
              {battleInfo.waitingForMe > 0
                ? `${battleInfo.waitingForMe} meydan okuma seni bekliyor`
                : battleInfo.resultReady > 0
                  ? `${battleInfo.resultReady} battle sonucu hazır`
                  : "Arkadaşınla aynı 8 seçimi ayrı zamanlarda yap"}
            </Text>
          </View>
          <ChevronRight size={16} color="rgba(255,255,255,0.54)" />
        </TouchableOpacity>
      )}

      {enabledCount > 0 && (
        <TouchableOpacity style={styles.allGamesRow} onPress={() => navigation.navigate("PellixPlay")} activeOpacity={0.78}>
          <View style={styles.allGamesIcon}><Gamepad2 size={14} color="#6366F1" /></View>
          <View style={{ flex: 1 }}>
            <Text style={styles.allGamesTitle}>Pellix Play</Text>
            <Text style={styles.allGamesSub}>{enabledCount} mini oyun daha</Text>
          </View>
          <ChevronRight size={16} color="rgba(255,255,255,0.54)" />
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    marginTop: 16, marginBottom: 18, borderRadius: 20, overflow: "hidden",
    backgroundColor: "rgba(99,102,241,0.08)", borderWidth: 1, borderColor: "rgba(99,102,241,0.18)",
  },
  card: {
    minHeight: 102, flexDirection: "row", alignItems: "center", gap: 13,
    paddingHorizontal: 16, paddingVertical: 15, overflow: "hidden",
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
  title: { fontFamily: "Baloo2_800ExtraBold", fontSize: 18, color: "#fff", letterSpacing: 0.1, flexShrink: 1 },
  playBadge: { backgroundColor: "rgba(255,255,255,0.18)", borderRadius: 999, paddingHorizontal: 7, paddingVertical: 3 },
  playBadgeText: { color: "#fff", fontSize: 7.8, fontWeight: "900", letterSpacing: 0.7 },
  sub: { color: "rgba(255,255,255,0.82)", fontSize: 10.8, marginTop: 2, lineHeight: 15 },
  arrowWrap: {
    width: 34, height: 34, borderRadius: 999, alignItems: "center", justifyContent: "center",
    backgroundColor: "rgba(8,9,20,0.22)",
  },
  battleRow: {
    flexDirection: "row", alignItems: "center", gap: 9, paddingHorizontal: 14, paddingVertical: 11,
    borderTopWidth: 1, borderTopColor: "rgba(236,72,153,0.16)", backgroundColor: "rgba(236,72,153,0.07)",
  },
  battleIcon: { width: 30, height: 30, borderRadius: 10, backgroundColor: "rgba(236,72,153,0.14)", alignItems: "center", justifyContent: "center" },
  rowTitleLine: { flexDirection: "row", alignItems: "center", gap: 6 },
  battleTitle: { color: "#f4f3ef", fontSize: 11.5, fontWeight: "800" },
  battleSub: { color: "rgba(244,243,239,0.58)", fontSize: 9.5, marginTop: 1 },
  newBadge: { borderRadius: 999, backgroundColor: "#DB2777", paddingHorizontal: 6, paddingVertical: 2 },
  newBadgeText: { color: "#fff", fontSize: 7.2, fontWeight: "900", letterSpacing: 0.5 },
  allGamesRow: {
    flexDirection: "row", alignItems: "center", gap: 9, paddingHorizontal: 14, paddingVertical: 10,
    borderTopWidth: 1, borderTopColor: "rgba(99,102,241,0.16)", backgroundColor: "rgba(13,13,16,0.62)",
  },
  allGamesIcon: { width: 28, height: 28, borderRadius: 9, backgroundColor: "rgba(99,102,241,0.14)", alignItems: "center", justifyContent: "center" },
  allGamesTitle: { color: "#f4f3ef", fontSize: 11.5, fontWeight: "800" },
  allGamesSub: { color: "rgba(244,243,239,0.54)", fontSize: 9.5, marginTop: 1 },
});
