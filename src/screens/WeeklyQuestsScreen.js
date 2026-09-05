import React, { useState, useEffect, useCallback } from "react";
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, ActivityIndicator, Alert, Animated } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Check, Gift, Trophy, Clock } from "lucide-react-native";
import { useAppTheme } from "../context/ThemeContext";
import { useAuth } from "../context/AuthContext";
import { api } from "../api/client";
import { hapticSuccess } from "../utils/haptics";
import Confetti from "../components/Confetti";
import ScreenHeader from "../components/ScreenHeader";

function useWeekResetCountdown(weekStart) {
  const [label, setLabel] = useState("");
  useEffect(() => {
    if (!weekStart) return;
    function update() {
      const resetAt = new Date(`${weekStart}T00:00:00Z`).getTime() + 7 * 24 * 60 * 60 * 1000;
      const diffMs = resetAt - Date.now();
      if (diffMs <= 0) { setLabel("Yenileniyor…"); return; }
      const days = Math.floor(diffMs / 86400000);
      const hours = Math.floor((diffMs % 86400000) / 3600000);
      setLabel(days > 0 ? `${days} gün ${hours} saat sonra yenilenir` : `${hours} saat sonra yenilenir`);
    }
    update();
    const id = setInterval(update, 60000);
    return () => clearInterval(id);
  }, [weekStart]);
  return label;
}

export default function WeeklyQuestsScreen({ navigation }) {
  const { c } = useAppTheme();
  const { auth } = useAuth();
  const insets = useSafeAreaInsets();
  const styles = makeStyles(c, insets);

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [claiming, setClaiming] = useState(false);
  const [rewardDays, setRewardDays] = useState(null);
  const resetLabel = useWeekResetCountdown(data?.weekStart);

  const load = useCallback(() => {
    api.quests(auth.token).then(setData).catch(() => {}).finally(() => setLoading(false));
  }, [auth.token]);

  useEffect(() => { load(); }, [load]);

  async function claim() {
    setClaiming(true);
    try {
      const res = await api.claimQuestReward(auth.token);
      await load();
      hapticSuccess();
      setRewardDays(res.rewardDays);
    } catch (e) {
      Alert.alert("Olmadı", e.message || "Ödül alınamadı.");
    }
    setClaiming(false);
  }

  if (loading) {
    return (
      <View style={[styles.center, { flex: 1, backgroundColor: c.bg }]}>
        <ActivityIndicator size="large" color={c.accent} />
      </View>
    );
  }

  const quests = data?.quests || [];
  const completedCount = quests.filter((q) => q.completed).length;
  const totalCount = quests.length;
  const overallPercent = totalCount > 0 ? Math.min(100, (completedCount / totalCount) * 100) : 0;

  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      <ScreenHeader
        title="Haftalık Görevler"
        subtitle={totalCount > 0 ? `${completedCount}/${totalCount} tamamlandı` : undefined}
        onBack={() => navigation.goBack()}
      />

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.introCard}>
          <View style={styles.trophyWrap}><Trophy size={22} color={c.accent} /></View>
          <View style={{ flex: 1 }}>
            <Text style={styles.introTitle}>Bu haftaki hedefin</Text>
            <Text style={styles.introText}>
              {totalCount || 4} görevin tamamını bitir, {data?.rewardDays} günlük Premium kazan.
            </Text>
            <View style={styles.overallProgressTrack}>
              <View style={[styles.overallProgressFill, { width: `${overallPercent}%` }]} />
            </View>
            <View style={styles.introMetaRow}>
              <Text style={styles.introProgressText}>{completedCount}/{totalCount || 4}</Text>
              {!!resetLabel && (
                <View style={styles.resetRow}>
                  <Clock size={11} color={c.dim} />
                  <Text style={styles.resetText}>{resetLabel}</Text>
                </View>
              )}
            </View>
          </View>
        </View>

        {quests.map((q) => (
          <View key={q.key} style={[styles.questRow, q.completed && styles.questRowDone]}>
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
                {data?.claimed ? "Bu haftanın ödülünü aldın" : data?.allCompleted ? "Ödülü Al" : `${Math.max(0, totalCount - completedCount)} görev kaldı`}
              </Text>
            </>
          )}
        </TouchableOpacity>
      </ScrollView>

      {rewardDays != null && (
        <RewardCelebration days={rewardDays} onClose={() => setRewardDays(null)} />
      )}
    </View>
  );
}

function RewardCelebration({ days, onClose }) {
  const { c } = useAppTheme();
  const insets = useSafeAreaInsets();
  const styles = makeStyles(c, insets);
  const scale = React.useRef(new Animated.Value(0.4)).current;
  const opacity = React.useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(opacity, { toValue: 1, duration: 220, useNativeDriver: true }),
      Animated.spring(scale, { toValue: 1, useNativeDriver: true, bounciness: 14, speed: 8 }),
    ]).start();
  }, []);

  return (
    <Animated.View style={[styles.rewardBackdrop, { opacity }]}>
      <Confetti count={40} spread={700} />
      <Animated.View style={[styles.rewardCard, { transform: [{ scale }] }]}>
        <View style={styles.rewardIconRing}><Gift size={38} color="#fff" /></View>
        <Text style={styles.rewardTitle}>Tebrikler! 🎁</Text>
        <Text style={styles.rewardDesc}>{days} günlük Premium hesabına tanımlandı.</Text>
        <TouchableOpacity style={styles.rewardCloseBtn} onPress={onClose} activeOpacity={0.85}>
          <Text style={styles.rewardCloseBtnText}>Harika!</Text>
        </TouchableOpacity>
      </Animated.View>
    </Animated.View>
  );
}

function makeStyles(c, insets) {
  return StyleSheet.create({
    center: { alignItems: "center", justifyContent: "center" },
    content: { padding: 20, paddingBottom: Math.max(28, insets.bottom + 20) },
    introCard: {
      flexDirection: "row", alignItems: "flex-start", gap: 12, backgroundColor: c.surface,
      borderWidth: 1, borderColor: c.border, borderRadius: 18, padding: 16, marginBottom: 18,
    },
    trophyWrap: {
      width: 42, height: 42, borderRadius: 14, backgroundColor: c.surface2,
      alignItems: "center", justifyContent: "center", flexShrink: 0,
    },
    introTitle: { fontSize: 13.5, fontWeight: "800", color: c.text },
    introText: { fontSize: 12, color: c.dim, lineHeight: 17, marginTop: 3 },
    overallProgressTrack: { height: 6, backgroundColor: c.surface2, borderRadius: 999, marginTop: 12, overflow: "hidden" },
    overallProgressFill: { height: 6, backgroundColor: c.accent, borderRadius: 999 },
    introMetaRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8, marginTop: 7 },
    introProgressText: { fontSize: 10.5, color: c.accent, fontWeight: "800" },
    resetRow: { flexDirection: "row", alignItems: "center", gap: 4, flexShrink: 1 },
    resetText: { fontSize: 10.5, color: c.dim, fontWeight: "600" },
    questRow: {
      flexDirection: "row", alignItems: "center", gap: 12, backgroundColor: c.surface,
      borderWidth: 1, borderColor: c.border, borderRadius: 14, padding: 14, marginBottom: 10,
    },
    questRowDone: { opacity: 0.72 },
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

    rewardBackdrop: {
      position: "absolute", top: 0, left: 0, right: 0, bottom: 0, zIndex: 50,
      backgroundColor: "rgba(0,0,0,0.72)", alignItems: "center", justifyContent: "center",
      paddingHorizontal: 30, paddingTop: Math.max(30, insets.top + 14), paddingBottom: Math.max(30, insets.bottom + 14),
    },
    rewardCard: {
      width: "100%", maxWidth: 300, backgroundColor: c.surface, borderRadius: 24, padding: 26,
      alignItems: "center", borderWidth: 1, borderColor: c.border,
      shadowColor: "#6366F1", shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.3, shadowRadius: 20, elevation: 12,
    },
    rewardIconRing: {
      width: 72, height: 72, borderRadius: 999, backgroundColor: "#6366F1",
      alignItems: "center", justifyContent: "center", marginBottom: 14,
    },
    rewardTitle: { fontSize: 19, fontWeight: "800", color: c.text },
    rewardDesc: { fontSize: 12.5, color: c.dim, marginTop: 6, textAlign: "center", lineHeight: 18 },
    rewardCloseBtn: { backgroundColor: c.accent, borderRadius: 14, paddingVertical: 13, paddingHorizontal: 40, marginTop: 20 },
    rewardCloseBtnText: { color: c.bg, fontWeight: "800", fontSize: 13.5 },
  });
}
