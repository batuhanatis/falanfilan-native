import React, { useState, useEffect, useCallback } from "react";
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, ActivityIndicator, Alert } from "react-native";
import { ChevronLeft, Check, Gift, Trophy } from "lucide-react-native";
import { useAppTheme } from "../context/ThemeContext";
import { useAuth } from "../context/AuthContext";
import { api } from "../api/client";

export default function WeeklyQuestsScreen({ navigation }) {
  const { c } = useAppTheme();
  const { auth } = useAuth();
  const styles = makeStyles(c);

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [claiming, setClaiming] = useState(false);

  const load = useCallback(() => {
    api.quests(auth.token).then(setData).catch(() => {}).finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  async function claim() {
    setClaiming(true);
    try {
      const res = await api.claimQuestReward(auth.token);
      await load();
      Alert.alert("Tebrikler! 🎁", `${res.rewardDays} günlük Premium hesabına tanımlandı.`);
    } catch (e) {
      Alert.alert("Olmadı", e.message || "Ödül alınamadı.");
    }
    setClaiming(false);
  }

  if (loading) {
    return (
      <View style={[styles.center, { flex: 1 }]}>
        <ActivityIndicator size="large" color={c.accent} />
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={{ padding: 2 }}>
          <ChevronLeft size={20} color={c.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Haftalık Görevler</Text>
      </View>

      <ScrollView contentContainerStyle={{ padding: 20 }}>
        <View style={styles.introCard}>
          <Trophy size={22} color={c.accent} />
          <Text style={styles.introText}>Bu haftaki 4 görevin tamamını bitir, {data?.rewardDays} günlük Premium kazan.</Text>
        </View>

        {data?.quests?.map((q) => (
          <View key={q.key} style={styles.questRow}>
            <View style={[styles.questCheck, q.completed && { backgroundColor: c.accent, borderColor: c.accent }]}>
              {q.completed && <Check size={13} color={c.bg} />}
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.questLabel, q.completed && { color: c.dim, textDecorationLine: "line-through" }]}>{q.label}</Text>
              {q.target > 1 && !q.completed && (
                <View style={styles.progressTrack}>
                  <View style={[styles.progressFill, { width: `${Math.min(100, (q.progress / q.target) * 100)}%` }]} />
                </View>
              )}
            </View>
            {q.target > 1 && <Text style={styles.questCount}>{q.progress}/{q.target}</Text>}
          </View>
        ))}

        <TouchableOpacity
          style={[styles.claimBtn, (!data?.allCompleted || data?.claimed) && { opacity: 0.5 }]}
          onPress={claim}
          disabled={!data?.allCompleted || data?.claimed || claiming}
        >
          {claiming ? (
            <ActivityIndicator color={c.bg} />
          ) : (
            <>
              <Gift size={16} color={c.bg} />
              <Text style={styles.claimBtnText}>
                {data?.claimed ? "Bu haftanın ödülünü aldın" : data?.allCompleted ? "Ödülü Al" : "Önce tüm görevleri tamamla"}
              </Text>
            </>
          )}
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

function makeStyles(c) {
  return StyleSheet.create({
    center: { alignItems: "center", justifyContent: "center" },
    header: {
      flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 16, paddingTop: 54, paddingBottom: 12,
      borderBottomWidth: 1, borderBottomColor: c.border,
    },
    headerTitle: { fontSize: 15, fontWeight: "700", color: c.text },
    introCard: {
      flexDirection: "row", alignItems: "center", gap: 12, backgroundColor: c.surface,
      borderWidth: 1, borderColor: c.border, borderRadius: 16, padding: 16, marginBottom: 18,
    },
    introText: { flex: 1, fontSize: 12.5, color: c.text, lineHeight: 18 },
    questRow: {
      flexDirection: "row", alignItems: "center", gap: 12, backgroundColor: c.surface,
      borderWidth: 1, borderColor: c.border, borderRadius: 14, padding: 14, marginBottom: 10,
    },
    questCheck: {
      width: 24, height: 24, borderRadius: 999, borderWidth: 1.5, borderColor: c.border,
      alignItems: "center", justifyContent: "center", flexShrink: 0,
    },
    questLabel: { fontSize: 13, fontWeight: "600", color: c.text },
    progressTrack: { height: 4, backgroundColor: c.surface2, borderRadius: 999, marginTop: 6, overflow: "hidden" },
    progressFill: { height: 4, backgroundColor: c.accent, borderRadius: 999 },
    questCount: { fontSize: 11, color: c.dim, fontWeight: "700" },
    claimBtn: {
      flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8,
      backgroundColor: c.accent, borderRadius: 14, paddingVertical: 16, marginTop: 12,
    },
    claimBtnText: { color: c.bg, fontWeight: "800", fontSize: 14 },
  });
}
