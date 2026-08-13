import React, { useState, useEffect } from "react";
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator, ScrollView } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { ChevronLeft, Crown, Users } from "lucide-react-native";
import { useAppTheme } from "../context/ThemeContext";
import { useAuth } from "../context/AuthContext";
import { api } from "../api/client";
import { avatarOr } from "../utils/avatar";
import { verdictFor } from "../utils/blendVerdict";
import RetryImage from "../components/RetryImage";
import EmptyState from "../components/EmptyState";

// BL4 — "en çok uyumlu olduğun kişi" sıralaması. Blend'in tek-tek hesapladığı zevk uyumunu
// tüm arkadaş listesi genelinde tek bir ekranda görünür kılıyor — düşük efor, viral bir keşif
// hook'u (kiminle en uyumlu olduğunu görmek merak uyandırır).
export default function BlendLeaderboardScreen({ navigation }) {
  const { c } = useAppTheme();
  const { auth } = useAuth();
  const styles = makeStyles(c);
  const [results, setResults] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.friendMatchRanking(auth.token).then((data) => setResults(data.results || [])).catch(() => setResults([])).finally(() => setLoading(false));
  }, []);

  const medalColors = ["#FFD700", "#C0C0C0", "#CD7F32"];

  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={{ padding: 2 }}>
          <ChevronLeft size={20} color={c.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Zevk Uyumu Sıralaması</Text>
      </View>

      {loading ? (
        <ActivityIndicator style={{ marginTop: 40 }} color={c.accent} />
      ) : (
        <ScrollView contentContainerStyle={{ padding: 16 }}>
          {!results || results.length === 0 ? (
            <EmptyState
              icon={Users}
              title="Henüz bir sıralama yok"
              text="Arkadaşlarınla ve sen yeterince film/dizi beğendikçe burada bir sıralama oluşacak."
            />
          ) : (
            results.map((r, i) => (
              <TouchableOpacity
                key={r.id}
                style={styles.row}
                onPress={() => navigation.navigate("Blend", { friendId: r.id, friendName: r.name, friendAvatar: r.avatarUrl })}
                activeOpacity={0.85}
              >
                {i < 3 ? (
                  <View style={[styles.medal, { backgroundColor: medalColors[i] }]}>
                    <Crown size={12} color="#1a1a1a" fill="#1a1a1a" />
                  </View>
                ) : (
                  <Text style={styles.rank}>{i + 1}</Text>
                )}
                <RetryImage source={{ uri: avatarOr(r.avatarUrl, r.id) }} style={styles.avatar} />
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={styles.name} numberOfLines={1}>{r.name}</Text>
                  <Text style={styles.verdict} numberOfLines={1}>{verdictFor(r.matchPercent)}</Text>
                </View>
                <LinearGradient colors={["#0EA5E9", "#6366F1", "#8B5CF6"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.pctPill}>
                  <Text style={styles.pctText}>%{r.matchPercent}</Text>
                </LinearGradient>
              </TouchableOpacity>
            ))
          )}
        </ScrollView>
      )}
    </View>
  );
}

function makeStyles(c) {
  return StyleSheet.create({
    header: {
      flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 16, paddingTop: 54, paddingBottom: 12,
      borderBottomWidth: 1, borderBottomColor: c.border,
    },
    headerTitle: { fontSize: 14, fontWeight: "700", color: c.text },
    row: {
      flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: c.surface,
      borderWidth: 1, borderColor: c.border, borderRadius: 14, padding: 10, marginBottom: 8,
    },
    medal: { width: 22, height: 22, borderRadius: 999, alignItems: "center", justifyContent: "center" },
    rank: { width: 22, textAlign: "center", fontSize: 12.5, fontWeight: "800", color: c.dim },
    avatar: { width: 40, height: 40, borderRadius: 999, backgroundColor: c.surface2 },
    name: { fontSize: 13, fontWeight: "700", color: c.text },
    verdict: { fontSize: 11, color: c.dim, marginTop: 1 },
    pctPill: { borderRadius: 999, paddingHorizontal: 10, paddingVertical: 5 },
    pctText: { fontSize: 12, fontWeight: "800", color: "#fff" },
  });
}
