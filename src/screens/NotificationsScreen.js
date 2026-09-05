import React, { useState, useEffect, useCallback } from "react";
import { View, Text, Image, TouchableOpacity, StyleSheet, FlatList, ActivityIndicator, Animated } from "react-native";
import { Swipeable } from "react-native-gesture-handler";
import {
  Trash2, UserPlus, UserCheck, Film, PartyPopper, Gift, ListVideo, Bell,
  Heart, MessageCircle, Sparkles, Users,
} from "lucide-react-native";
import { useAppTheme } from "../context/ThemeContext";
import { useAuth } from "../context/AuthContext";
import { api } from "../api/client";
import { avatarOr } from "../utils/avatar";
import RetryImage from "../components/RetryImage";
import ScreenHeader from "../components/ScreenHeader";

const SHARED_ITEM_TYPES = ["social_post_like", "social_comment", "social_reaction", "friend_quiz_shared"];

function notificationText(n) {
  const p = n.payload || {};
  switch (n.type) {
    case "friend_request": return `${p.from?.name} arkadaşlık isteği gönderdi`;
    case "friend_accepted": return `${p.by?.name} arkadaşlık isteğini kabul etti`;
    case "party_invite": return `${p.from?.name} MatchParty daveti gönderdi`;
    case "party_accepted": return `${p.by?.name} MatchParty davetini kabul etti — başlıyor!`;
    case "party_declined": return `${p.by?.name} MatchParty davetini reddetti`;
    case "party_match": return `MatchParty'de bir eşleşme buldun: ${p.movie?.title} 🎉`;
    case "referral_completed": return "Davet tamamlandı — 5 ekstra AI önerisi hakkı kazandın 🎁";
    case "referral_bonus_received": return "Hoş geldin bonusu — 3 ekstra AI önerisi hakkı kazandın 🎁";
    case "watchlist_collaborator_added": return `${p.by?.name} seni "${p.listName}" listesine ortak düzenleyici ekledi`;
    case "social_post_like": return `${p.by?.name} paylaşımını beğendi ❤️`;
    case "social_comment": return `${p.by?.name} ${p.targetKind === "activity" ? "aktivine" : "paylaşımına"} yorum yaptı: ${p.comment || ""}`;
    case "social_reaction": {
      const emoji = { fire: "🔥", agree: "🤝", nope: "👎" }[p.reaction] || "✨";
      const target = p.contentTitle ? `"${p.contentTitle}" içeriğine` : (p.targetKind === "activity" ? "aktivine" : "paylaşımına");
      return `${p.by?.name} ${target} ${emoji} tepkisi verdi`;
    }
    case "friend_quiz_shared": return `${p.by?.name}, "Arkadaşını Tanıyor musun?" oyununda seni %${p.percent} tahmin etti 🎮`;
    default: return "Yeni bildirim";
  }
}

function notificationMeta(n) {
  const p = n.payload || {};
  switch (n.type) {
    case "friend_request": return { person: p.from, icon: UserPlus, color: "#c9a44c" };
    case "friend_accepted": return { person: p.by, icon: UserCheck, color: "#c9a44c" };
    case "party_invite": return { person: p.from, icon: Film, color: "#DB2777" };
    case "party_accepted": return { person: p.by, icon: PartyPopper, color: "#7C3AED" };
    case "party_declined": return { person: p.by, icon: Film, color: "#8f8a9c" };
    case "party_match": return { person: null, icon: PartyPopper, color: "#F97316", moviePoster: p.movie?.poster };
    case "referral_completed": return { person: null, icon: Gift, color: "#c9a44c" };
    case "referral_bonus_received": return { person: null, icon: Gift, color: "#14B8A6" };
    case "watchlist_collaborator_added": return { person: p.by, icon: ListVideo, color: "#14B8A6" };
    case "social_post_like": return { person: p.by, icon: Heart, color: "#FF3D81" };
    case "social_comment": return { person: p.by, icon: MessageCircle, color: "#2563EB" };
    case "social_reaction": return { person: p.by, icon: Sparkles, color: "#F97316" };
    case "friend_quiz_shared": return { person: p.by, icon: Users, color: "#FB7185" };
    default: return { person: null, icon: Bell, color: "#8f8a9c" };
  }
}

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
    else if (SHARED_ITEM_TYPES.includes(n.type)) {
      navigation.navigate("SharedItem", { kind: p.targetKind, id: p.targetId });
    }
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

  const unreadCount = notifications.filter((n) => !n.read).length;

  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      <ScreenHeader
        title="Bildirimler"
        subtitle={notifications.length > 0 ? `${notifications.length} bildirim${unreadCount > 0 ? ` · ${unreadCount} yeni` : ""}` : undefined}
        onBack={() => navigation.goBack()}
        right={notifications.length > 0 ? (
          <TouchableOpacity onPress={deleteAllNotifications} style={styles.clearAllBtn} activeOpacity={0.78}>
            <Trash2 size={13} color={c.danger} />
            <Text style={styles.clearAllText}>Temizle</Text>
          </TouchableOpacity>
        ) : null}
      />

      {loading ? (
        <ActivityIndicator size="large" color={c.accent} style={{ marginTop: 40 }} />
      ) : (
        <FlatList
          data={notifications}
          keyExtractor={(item) => String(item.id)}
          contentContainerStyle={{ padding: 16 }}
          ListHeaderComponent={notifications.length > 0 ? (
            <View style={styles.listIntro}>
              <Text style={styles.hint}>Bir bildirimi silmek için sola kaydır.</Text>
            </View>
          ) : null}
          renderItem={({ item }) => {
            const isPartyInvite = item.type === "party_invite" && !busyIds.has(item.id);
            const clickable = item.type === "party_accepted"
              || item.type === "party_match"
              || SHARED_ITEM_TYPES.includes(item.type);
            const meta = notificationMeta(item);
            const Icon = meta.icon;
            return (
              <Swipeable
                renderRightActions={(progress, dragX) => renderRightActions(item, progress, dragX)}
                overshootRight={false}
              >
                <TouchableOpacity
                  style={[styles.row, !item.read && styles.unreadRow]}
                  onPress={clickable ? () => handleTap(item) : undefined}
                  activeOpacity={clickable ? 0.7 : 1}
                >
                  {!item.read && <View style={styles.unreadDot} />}
                  <View style={{ flexDirection: "row", alignItems: "flex-start", gap: 10 }}>
                    {meta.person ? (
                      <View>
                        <RetryImage source={{ uri: avatarOr(meta.person.avatarUrl, meta.person.id) }} style={styles.avatar} />
                        <View style={[styles.avatarIconBadge, { backgroundColor: meta.color }]}>
                          <Icon size={9} color="#fff" />
                        </View>
                      </View>
                    ) : (
                      <View style={[styles.typeIconWrap, { backgroundColor: `${meta.color}26` }]}>
                        <Icon size={16} color={meta.color} />
                      </View>
                    )}
                    <View style={{ flex: 1, minWidth: 0 }}>
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
                    </View>
                    {!!meta.moviePoster && <Image source={{ uri: meta.moviePoster }} style={styles.moviePoster} />}
                  </View>
                </TouchableOpacity>
              </Swipeable>
            );
          }}
          ListEmptyComponent={
            <View style={styles.emptyWrap}>
              <View style={styles.emptyIcon}><Bell size={21} color={c.dim} /></View>
              <Text style={styles.emptyTitle}>Şimdilik sessiz</Text>
              <Text style={styles.empty}>Arkadaşlarından, MatchParty'den ve sosyal etkileşimlerden gelen gelişmeleri burada göreceksin.</Text>
            </View>
          }
        />
      )}
    </View>
  );
}

function makeStyles(c) {
  return StyleSheet.create({
    clearAllBtn: {
      flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 8, paddingVertical: 6,
      borderRadius: 999, backgroundColor: c.surface2, borderWidth: 1, borderColor: c.border,
    },
    clearAllText: { fontSize: 10.5, fontWeight: "800", color: c.danger },
    listIntro: { marginBottom: 10 },
    hint: { fontSize: 10.5, color: c.dim },
    row: {
      padding: 12, borderRadius: 12, marginBottom: 6, backgroundColor: c.surface,
      borderWidth: 1, borderColor: c.border, overflow: "hidden",
    },
    unreadRow: { backgroundColor: c.surface2, borderColor: c.accent },
    unreadDot: { position: "absolute", left: 0, top: 0, bottom: 0, width: 3, backgroundColor: c.accent },
    avatar: { width: 36, height: 36, borderRadius: 999, backgroundColor: c.surface2 },
    avatarIconBadge: {
      position: "absolute", bottom: -3, right: -3, width: 16, height: 16, borderRadius: 999,
      alignItems: "center", justifyContent: "center", borderWidth: 1.5, borderColor: c.surface,
    },
    typeIconWrap: { width: 36, height: 36, borderRadius: 999, alignItems: "center", justifyContent: "center" },
    moviePoster: { width: 34, height: 49, borderRadius: 6, marginLeft: 4 },
    text: { fontSize: 13, color: c.text, lineHeight: 18 },
    emptyWrap: { alignItems: "center", paddingVertical: 56, paddingHorizontal: 28 },
    emptyIcon: { width: 48, height: 48, borderRadius: 999, backgroundColor: c.surface2, alignItems: "center", justifyContent: "center", marginBottom: 10 },
    emptyTitle: { color: c.text, fontWeight: "800", fontSize: 14 },
    empty: { color: c.dim, fontSize: 11.5, textAlign: "center", lineHeight: 17, marginTop: 5 },
    actionsRow: { flexDirection: "row", gap: 8, marginTop: 9 },
    acceptBtn: { flex: 1, backgroundColor: c.accent, borderRadius: 9, paddingVertical: 8, alignItems: "center" },
    acceptText: { color: c.bg, fontWeight: "800", fontSize: 12 },
    declineBtn: { flex: 1, backgroundColor: c.surface, borderWidth: 1, borderColor: c.border, borderRadius: 9, paddingVertical: 8, alignItems: "center" },
    declineText: { color: c.text, fontWeight: "700", fontSize: 12 },
    deleteAction: {
      backgroundColor: c.danger, justifyContent: "center", alignItems: "center",
      width: 64, borderRadius: 12, marginBottom: 6,
    },
  });
}
