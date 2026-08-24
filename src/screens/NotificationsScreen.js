import React, { useState, useEffect, useCallback } from "react";
import { View, Text, Image, TouchableOpacity, StyleSheet, FlatList, ActivityIndicator, Animated } from "react-native";
import { Swipeable } from "react-native-gesture-handler";
import {
  ChevronLeft, Trash2, UserPlus, UserCheck, Film, PartyPopper, Gift, ListVideo, Bell,
  Heart, MessageCircle, Sparkles, Users,
} from "lucide-react-native";
import { useAppTheme } from "../context/ThemeContext";
import { useAuth } from "../context/AuthContext";
import { api } from "../api/client";
import { avatarOr } from "../utils/avatar";
import RetryImage from "../components/RetryImage";

// SharedItem'a (bkz. server.js pushNavTarget) giden tüm bildirim tipleri — tek yerde tutuyoruz
// ki yeni bir tip eklenince tıklanabilirlik/yönlendirme kontrolü ikişer yerde ayrı ayrı
// güncellenip biri unutulmasın diye.
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

// NT1/NT2 — eskiden her bildirim tipi (bir MatchParty eşleşmesi bile) aynı düz gri satırdı,
// avatar/ikon/renk yoktu — uygulamanın geri kalanında zaten her yerde olan bu dili buraya da
// taşıyoruz: kimden geldiği (varsa avatarı) + türe özgü renkli bir ikon rozeti.
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
    else if (SHARED_ITEM_TYPES.includes(n.type)) {
      // Push bildirimiyle AYNI hedef (bkz. server.js pushNavTarget) — ilgili paylaşımın/
      // aktivitenin kendi tek öğelik detay sayfasına gidiyor.
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
                  style={[styles.row, !item.read && { backgroundColor: c.surface2 }]}
                  onPress={clickable ? () => handleTap(item) : undefined}
                  activeOpacity={clickable ? 0.7 : 1}
                >
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
                    {/* NT3 — party_match bildirimlerinde film posteri veri olarak zaten geliyordu, hiç gösterilmiyordu. */}
                    {!!meta.moviePoster && <Image source={{ uri: meta.moviePoster }} style={styles.moviePoster} />}
                  </View>
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
    avatar: { width: 34, height: 34, borderRadius: 999, backgroundColor: c.surface2 },
    avatarIconBadge: {
      position: "absolute", bottom: -3, right: -3, width: 16, height: 16, borderRadius: 999,
      alignItems: "center", justifyContent: "center", borderWidth: 1.5, borderColor: c.surface,
    },
    typeIconWrap: { width: 34, height: 34, borderRadius: 999, alignItems: "center", justifyContent: "center" },
    moviePoster: { width: 32, height: 46, borderRadius: 6, marginLeft: 4 },
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
