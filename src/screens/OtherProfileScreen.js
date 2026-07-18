import React, { useState, useEffect, useCallback } from "react";
import { View, Text, Image, ScrollView, TouchableOpacity, StyleSheet, ActivityIndicator, FlatList } from "react-native";
import { ChevronLeft, Lock, Star, Film } from "lucide-react-native";
import { useAppTheme } from "../context/ThemeContext";
import { useAuth } from "../context/AuthContext";
import { api } from "../api/client";
import { avatarOr } from "../utils/avatar";

export default function OtherProfileScreen({ route, navigation }) {
  const { userId } = route.params;
  const { c } = useAppTheme();
  const { auth } = useAuth();
  const styles = makeStyles(c);

  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    api.userProfile(auth.token, userId)
      .then(setProfile)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [userId]);

  useEffect(() => { load(); }, [load]);

  async function sendRequest() {
    setBusy(true);
    try { await api.friendRequest(auth.token, userId); load(); } catch {}
    setBusy(false);
  }
  async function acceptRequest() {
    setBusy(true);
    try { await api.friendRespond(auth.token, userId, true); load(); } catch {}
    setBusy(false);
  }
  async function unfriend() {
    setBusy(true);
    try { await api.unfriend(auth.token, userId); load(); } catch {}
    setBusy(false);
  }
  async function startChat() {
    try {
      const { chat_id } = await api.chatWith(auth.token, userId);
      navigation.navigate("Chat", { screen: "ChatConversation", params: { chatId: chat_id, friendId: userId, friendName: profile.name, friendAvatar: avatarOr(profile.avatarUrl, userId) } });
    } catch {}
  }

  if (loading || !profile) {
    return (
      <View style={[styles.center, { flex: 1 }]}>
        <ActivityIndicator size="large" color={c.accent} />
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <ChevronLeft size={20} color={c.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle} numberOfLines={1}>{profile.name}</Text>
      </View>

      <ScrollView>
        <View
          style={[
            styles.cover,
            profile.coverUrl ? { backgroundColor: c.surface2 } : { backgroundColor: c.accent },
          ]}
        >
          {profile.coverUrl && <Image source={{ uri: profile.coverUrl }} style={StyleSheet.absoluteFillObject} />}
        </View>

        <View style={{ padding: 20 }}>
          <View style={styles.topRow}>
            <Image source={{ uri: avatarOr(profile.avatarUrl, profile.id) }} style={styles.avatar} />
            <View style={styles.statsRow}>
              <View style={styles.statBox}>
                <Text style={styles.statNum}>{profile.friendCount}</Text>
                <Text style={styles.statLabel}>Arkadaş</Text>
              </View>
              <View style={styles.statBox}>
                <Text style={styles.statNum}>{profile.likeCount}</Text>
                <Text style={styles.statLabel}>Beğeni</Text>
              </View>
            </View>
          </View>

          <Text style={styles.name}>{profile.name}</Text>
          {!!profile.username && <Text style={styles.username}>@{profile.username}</Text>}
          <Text style={styles.bio}>{profile.bio || "Bu kullanıcı henüz bir biyografi eklemedi."}</Text>

          {(profile.favoriteMovie || profile.favoriteShow) && (
            <View style={styles.favRow}>
              {profile.favoriteMovie && <FavCard label="FAVORİ FİLM" movie={profile.favoriteMovie} c={c} />}
              {profile.favoriteShow && <FavCard label="FAVORİ DİZİ" movie={profile.favoriteShow} c={c} />}
            </View>
          )}

          <View style={styles.actionsRow}>
            {profile.relationship === "friends" && (
              <>
                <TouchableOpacity style={styles.primaryBtn} onPress={startChat}>
                  <Text style={styles.primaryBtnText}>Mesaj Gönder</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.secondaryBtn, { backgroundColor: c.accent, borderColor: c.accent }]}
                  onPress={() => navigation.navigate("MatchParty", { friend: { id: profile.id, name: profile.name, avatarUrl: profile.avatarUrl } })}
                >
                  <Film size={13} color={c.bg} />
                </TouchableOpacity>
                <TouchableOpacity style={styles.secondaryBtn} onPress={unfriend} disabled={busy}>
                  <Text style={styles.secondaryBtnText}>Arkadaşlıktan Çık</Text>
                </TouchableOpacity>
              </>
            )}
            {profile.relationship === "pending_sent" && (
              <View style={[styles.primaryBtn, { backgroundColor: c.surface2 }]}>
                <Text style={[styles.primaryBtnText, { color: c.dim }]}>İstek Gönderildi</Text>
              </View>
            )}
            {profile.relationship === "pending_received" && (
              <TouchableOpacity style={styles.primaryBtn} onPress={acceptRequest} disabled={busy}>
                <Text style={styles.primaryBtnText}>İsteği Kabul Et</Text>
              </TouchableOpacity>
            )}
            {profile.relationship === "none" && (
              <TouchableOpacity style={styles.primaryBtn} onPress={sendRequest} disabled={busy}>
                <Text style={styles.primaryBtnText}>Arkadaş Ekle</Text>
              </TouchableOpacity>
            )}
          </View>

          <Text style={styles.sectionTitle}>Beğeniler</Text>
          {profile.canSeeLikes ? (
            profile.likedMovies?.length > 0 ? (
              <FlatList
                data={profile.likedMovies}
                numColumns={4}
                scrollEnabled={false}
                keyExtractor={(item) => String(item.id)}
                renderItem={({ item }) => (
                  item.poster ? <Image source={{ uri: item.poster }} style={styles.posterThumb} />
                    : <View style={[styles.posterThumb, { backgroundColor: c.surface2 }]} />
                )}
              />
            ) : <Text style={styles.emptyText}>Henüz bir beğeni yok.</Text>
          ) : (
            <View style={styles.lockedBox}>
              <Lock size={20} color={c.dim} />
              <Text style={styles.emptyText}>Bu kullanıcının beğenileri gizli.</Text>
            </View>
          )}
        </View>
      </ScrollView>
    </View>
  );
}

function FavCard({ label, movie, c }) {
  return (
    <View style={{ flex: 1, flexDirection: "row", gap: 8, backgroundColor: c.surface, borderWidth: 1, borderColor: c.border, borderRadius: 14, padding: 8, alignItems: "center" }}>
      {movie.poster ? (
        <Image source={{ uri: movie.poster }} style={{ width: 40, height: 58, borderRadius: 8 }} />
      ) : (
        <View style={{ width: 40, height: 58, borderRadius: 8, backgroundColor: c.surface2 }} />
      )}
      <View style={{ flex: 1 }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 3 }}>
          <Star size={9} color={c.accent} fill={c.accent} />
          <Text style={{ fontSize: 8, fontWeight: "800", color: c.accent }}>{label}</Text>
        </View>
        <Text style={{ fontSize: 11, fontWeight: "700", color: c.text, marginTop: 2 }} numberOfLines={1}>{movie.title}</Text>
      </View>
    </View>
  );
}

function makeStyles(c) {
  return StyleSheet.create({
    center: { alignItems: "center", justifyContent: "center", backgroundColor: c.bg },
    header: {
      flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 16, paddingTop: 54, paddingBottom: 12,
      borderBottomWidth: 1, borderBottomColor: c.border, backgroundColor: c.bg,
    },
    backBtn: { padding: 2 },
    headerTitle: { fontSize: 14, fontWeight: "700", color: c.text, flex: 1 },
    cover: { height: 90 },
    topRow: { flexDirection: "row", alignItems: "center", gap: 16 },
    avatar: { width: 76, height: 76, borderRadius: 999, marginTop: -40, borderWidth: 4, borderColor: c.bg },
    statsRow: { flex: 1, flexDirection: "row", justifyContent: "space-evenly" },
    statBox: { alignItems: "center" },
    statNum: { fontSize: 18, fontWeight: "800", color: c.text },
    statLabel: { fontSize: 11, color: c.dim, marginTop: 2 },
    name: { fontSize: 20, fontWeight: "700", color: c.text, marginTop: 14 },
    username: { fontSize: 12, color: c.dim, marginTop: 2 },
    bio: { fontSize: 13, color: c.dim, marginTop: 6, lineHeight: 19 },
    favRow: { flexDirection: "row", gap: 10, marginTop: 14 },
    actionsRow: { flexDirection: "row", gap: 8, marginTop: 18 },
    primaryBtn: { flex: 1, backgroundColor: c.accent, borderRadius: 12, paddingVertical: 12, alignItems: "center" },
    primaryBtnText: { color: c.bg, fontWeight: "800", fontSize: 13 },
    secondaryBtn: { backgroundColor: c.surface2, borderRadius: 12, paddingHorizontal: 16, justifyContent: "center", borderWidth: 1, borderColor: c.border },
    secondaryBtnText: { color: c.text, fontWeight: "700", fontSize: 12 },
    sectionTitle: { fontSize: 13, fontWeight: "700", color: c.text, marginTop: 26, marginBottom: 10 },
    posterThumb: { width: "24%", aspectRatio: 2 / 3, borderRadius: 8, margin: "0.5%" },
    emptyText: { color: c.dim, fontSize: 12 },
    lockedBox: { alignItems: "center", paddingVertical: 20, gap: 8 },
  });
}
