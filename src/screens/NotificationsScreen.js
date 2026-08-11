import React, { useState, useEffect, useCallback } from "react";
import { View, Text, TouchableOpacity, StyleSheet, FlatList, ActivityIndicator, Animated } from "react-native";
import { Swipeable } from "react-native-gesture-handler";
import { ChevronLeft, Trash2 } from "lucide-react-native";
import { useAppTheme } from "../context/ThemeContext";
import { useAuth } from "../context/AuthContext";
import { api } from "../api/client";

function notificationText(n) {
  const p = n.payload || {};
  switch (n.type) {
    case "friend_request": return `${p.from?.name} arkadaşlık isteği gönderdi`;
    case "friend_accepted": return `${p.by?.name} arkadaşlık isteğini kabul etti`;
    case "party_invite": return `${p.from?.name} MatchParty daveti gönderdi`;
    case "party_accepted": return `${p.by?.name} MatchParty davetini kabul etti — başlıyor!`;
    case "party_declined": return `${p.by?.name} MatchParty davetini reddetti`;
    case "party_match": return `MatchParty'de bir eşleşme buldun: ${p.movie?.title} 🎉`;
    default: return "Yeni bildirim";
  }
}

// Eskiden ekranın üstünden açılan, sürükleyerek kapatılan bir popup'tı — ama liste birden
// fazla bildirim içerdiğinde kaydırmak, popup'ın kendi "yukarı çekince kapat" jestiyle
// çakışıyordu. Artık ayrı bir SAYFA: liste özgürce kaydırılabiliyor, kapatmak için sadece
// geri tuşu/jesti var, karışıklık riski yok.
export default function NotificationsScreen({ navigation }) {
  const { c } = useAppTheme();
  const { auth } = useAuth();
  const styles = makeStyles(c);
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busyIds, setBusyIds] = useState(new Set());

  const refresh = useCallback(() => {
    return api.notifications(auth.token).then((data) => setNotifications(data.results || [])).catch(() => {});
  }, [auth.token]);

  useEffect(() => {
    refresh().finally(() => setLoading(false));
    api.markAllRead(auth.token).catch(() => {});
  }, []);

  function deleteNotification(id) {
    setNotifications((prev) => prev.filter((n) => n.id !== id));
    api.deleteNotification(auth.token, id).catch(() => refresh());
  }

  function deleteAllNotifications() {
    setNotifications([]);
    api.deleteAllNotifications(auth.token).catch(() => refresh());
  }

  async function handleRespond(n, accept) {
    const sessionId = n.payload?.session_id;
    if (!sessionId) return;
    setBusyIds((prev) => new Set([...prev, n.id]));
    try {
      await api.respondParty(auth.token, sessionId, accept);
      setNotifications((prev) => prev.filter((item) => !(item.type === "party_invite" && item.payload?.session_id === sessionId)));
      if (accept) navigation.navigate("MatchParty", { sessionId, friend: n.payload?.from });
    } catch { /* sessizce geç */ }
    setBusyIds((prev) => { const next = new Set(prev); next.delete(n.id); return next; });
  }

  function handleTap(n) {
    const p = n.payload || {};
    if (n.type === "party_accepted" && p.session_id) navigation.navigate("MatchParty", { sessionId: p.session_id, friend: p.by });
    else if (n.type === "party_match" && p.session_id) navigation.navigate("MatchParty", { sessionId: p.session_id });
  }

  function renderRightActions(n, progress, dragX) {
    const scale = dragX.interpolate({ inputRange: [-80, 0], outputRange: [1, 0.5], extrapolate: "clamp" });
    return (
      <TouchableOpacity style={styles.deleteAction} onPress={() => deleteNotification(n.id)}>
        <Animated.View style={{ transform: [{ scale }] }}>
          <Trash2 size={18} color="#fff" />
        </Animated.View>
      </TouchableOpacity>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={{ padding: 2 }}>
          <ChevronLeft size={20} color={c.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Bildirimler</Text>
        {notifications.length > 0 && (
          <TouchableOpacity onPress={deleteAllNotifications}>
            <Text style={styles.clearAllText}>Tümünü Sil</Text>
          </TouchableOpacity>
        )}
      </View>

      {loading ? (
        <ActivityIndicator size="large" color={c.accent} style={{ marginTop: 40 }} />
      ) : (
        <FlatList
          data={notifications}
          keyExtractor={(item) => String(item.id)}
          contentContainerStyle={{ padding: 16 }}
          ListHeaderComponent={notifications.length > 0 ? <Text style={styles.hint}>Silmek için sola kaydır</Text> : null}
          renderItem={({ item }) => {
            const isPartyInvite = item.type === "party_invite" && !busyIds.has(item.id);
            const clickable = item.type === "party_accepted" || item.type === "party_match";
            return (
              <Swipeable
                renderRightActions={(progress, dragX) => renderRightActions(item, progress, dragX)}
                overshootRight={false}
              >
                <TouchableOpacity
                  style={[styles.row, !item.read && { backgroundColor: c.surface2 }]}
                  onPress={clickable ? () => handleTap(item) : undefined}
                  activeOpacity={clickable ? 0.7 : 1}
                >
                  <Text style={styles.text}>{notificationText(item)}</Text>
                  {isPartyInvite && (
                    <View style={styles.actionsRow}>
                      <TouchableOpacity style={styles.acceptBtn} onPress={() => handleRespond(item, true)}>
                        <Text style={styles.acceptText}>Kabul Et</Text>
                      </TouchableOpacity>
                      <TouchableOpacity style={styles.declineBtn} onPress={() => handleRespond(item, false)}>
                        <Text style={styles.declineText}>Reddet</Text>
                      </TouchableOpacity>
                    </View>
                  )}
                  {busyIds.has(item.id) && item.type === "party_invite" && <ActivityIndicator size="small" color={c.accent} style={{ marginTop: 6 }} />}
                </TouchableOpacity>
              </Swipeable>
            );
          }}
          ListEmptyComponent={<Text style={styles.empty}>Henüz bildirim yok.</Text>}
        />
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
    headerTitle: { fontSize: 14, fontWeight: "800", color: c.text, flex: 1 },
    clearAllText: { fontSize: 11, fontWeight: "700", color: c.danger },
    hint: { fontSize: 10, color: c.dim, marginBottom: 10 },
    row: { padding: 12, borderRadius: 10, marginBottom: 4, backgroundColor: c.surface },
    text: { fontSize: 13, color: c.text },
    empty: { color: c.dim, fontSize: 12, textAlign: "center", paddingVertical: 40 },
    actionsRow: { flexDirection: "row", gap: 8, marginTop: 8 },
    acceptBtn: { flex: 1, backgroundColor: c.accent, borderRadius: 8, paddingVertical: 7, alignItems: "center" },
    acceptText: { color: c.bg, fontWeight: "700", fontSize: 12 },
    declineBtn: { flex: 1, backgroundColor: c.surface2, borderWidth: 1, borderColor: c.border, borderRadius: 8, paddingVertical: 7, alignItems: "center" },
    declineText: { color: c.text, fontWeight: "700", fontSize: 12 },
    deleteAction: {
      backgroundColor: c.danger, justifyContent: "center", alignItems: "center",
      width: 64, borderRadius: 10, marginBottom: 4,
    },
  });
}
