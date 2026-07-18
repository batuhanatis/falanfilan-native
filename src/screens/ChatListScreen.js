import React, { useState, useEffect, useCallback } from "react";
import { View, Text, TouchableOpacity, StyleSheet, FlatList, Image, ActivityIndicator } from "react-native";
import { Check, X, MessageCircle, UserPlus } from "lucide-react-native";
import { useAppTheme } from "../context/ThemeContext";
import { useAuth } from "../context/AuthContext";
import { useWS } from "../context/WSContext";
import { api } from "../api/client";
import { avatarOr } from "../utils/avatar";
import { decodeMovieShare } from "../utils/movieShare";
import TopBar from "../components/TopBar";

export default function ChatListScreen({ navigation }) {
  const { c } = useAppTheme();
  const { auth } = useAuth();
  const { subscribe } = useWS();
  const styles = makeStyles(c);

  const [sub, setSub] = useState("chats"); // "chats" | "requests"
  const [chats, setChats] = useState([]);
  const [friends, setFriends] = useState([]);
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);

  const loadAll = useCallback(async () => {
    setLoading(true);
    try {
      const [chatsData, friendsData] = await Promise.all([
        api.chats(auth.token),
        api.friends(auth.token),
      ]);
      setChats(chatsData.results || []);
      setFriends(friendsData.friends || []);
      setRequests(friendsData.requests || []);
    } catch { /* sessizce geç */ }
    setLoading(false);
  }, [auth.token]);

  useEffect(() => { loadAll(); }, [loadAll]);
  useEffect(() => {
    const unsub = subscribe((msg) => {
      if (["message", "friend_request", "friend_accepted"].includes(msg.type)) loadAll();
    });
    return unsub;
  }, [subscribe, loadAll]);

  useEffect(() => {
    const unsubFocus = navigation.addListener("focus", loadAll);
    return unsubFocus;
  }, [navigation, loadAll]);

  async function respond(fromUserId, accept) {
    try { await api.friendRespond(auth.token, fromUserId, accept); loadAll(); } catch {}
  }

  async function openWithFriend(friend) {
    const { chat_id } = await api.chatWith(auth.token, friend.id);
    navigation.navigate("ChatConversation", { chatId: chat_id, friendId: friend.id, friendName: friend.name, friendAvatar: friend.avatar_url });
  }

  const chattedFriendIds = new Set(chats.map((ch) => ch.friend_id));
  const friendsWithoutChat = friends.filter((f) => !chattedFriendIds.has(f.id));

  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      <TopBar />
      <View style={styles.tabRow}>
        {[["chats", "Sohbetler"], ["requests", `İstekler${requests.length > 0 ? ` (${requests.length})` : ""}`]].map(([id, label]) => (
          <TouchableOpacity key={id} onPress={() => setSub(id)} style={[styles.tabBtn, sub === id && { backgroundColor: c.accent, borderColor: c.accent }]}>
            <Text style={[styles.tabText, sub === id && { color: c.bg }]}>{label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {loading ? (
        <ActivityIndicator style={{ marginTop: 30 }} color={c.accent} />
      ) : sub === "chats" ? (
        <FlatList
          contentContainerStyle={{ padding: 16 }}
          data={chats}
          keyExtractor={(item) => String(item.chat_id)}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={styles.card}
              activeOpacity={0.75}
              onPress={() => navigation.navigate("ChatConversation", { chatId: item.chat_id, friendId: item.friend_id, friendName: item.friend_name, friendAvatar: item.friend_avatar })}
            >
              <Image source={{ uri: avatarOr(item.friend_avatar, item.friend_id) }} style={styles.avatar} />
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={styles.name}>{item.friend_name}</Text>
                <Text style={styles.lastMessage} numberOfLines={1}>
                  {decodeMovieShare(item.last_message) ? "🎬 Film/dizi önerisi" : (item.last_message || "Henüz mesaj yok")}
                </Text>
              </View>
            </TouchableOpacity>
          )}
          ListFooterComponent={
            friendsWithoutChat.length > 0 ? (
              <View>
                <Text style={styles.sectionLabel}>YENİ SOHBET BAŞLAT</Text>
                {friendsWithoutChat.map((f) => (
                  <TouchableOpacity key={f.id} style={styles.card} activeOpacity={0.75} onPress={() => openWithFriend(f)}>
                    <Image source={{ uri: avatarOr(f.avatar_url, f.id) }} style={styles.avatar} />
                    <Text style={styles.name}>{f.name}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            ) : null
          }
          ListEmptyComponent={
            friendsWithoutChat.length === 0 ? (
              <View style={styles.emptyBox}>
                <View style={styles.emptyIconWrap}><MessageCircle size={26} color={c.accent} /></View>
                <Text style={styles.emptyTitle}>Henüz kimseyle sohbet etmiyorsun</Text>
                <Text style={styles.emptyText}>Üstteki arkadaş ekleme butonuyla bir arkadaş bulup ilk mesajı sen at.</Text>
              </View>
            ) : null
          }
        />
      ) : (
        <FlatList
          contentContainerStyle={{ padding: 16 }}
          data={requests}
          keyExtractor={(item) => String(item.id)}
          renderItem={({ item }) => (
            <View style={styles.card}>
              <Image source={{ uri: avatarOr(item.avatar_url, item.id) }} style={styles.avatar} />
              <Text style={[styles.name, { flex: 1 }]}>{item.name}</Text>
              <TouchableOpacity onPress={() => respond(item.id, true)} style={styles.acceptBtn}>
                <Check size={14} color="#fff" />
              </TouchableOpacity>
              <TouchableOpacity onPress={() => respond(item.id, false)} style={styles.declineBtn}>
                <X size={14} color={c.dim} />
              </TouchableOpacity>
            </View>
          )}
          ListEmptyComponent={
            <View style={styles.emptyBox}>
              <View style={styles.emptyIconWrap}><Check size={26} color={c.accent} /></View>
              <Text style={styles.emptyTitle}>Her şey güncel</Text>
              <Text style={styles.emptyText}>Bekleyen arkadaşlık isteğin yok.</Text>
            </View>
          }
        />
      )}
    </View>
  );
}

function makeStyles(c) {
  return StyleSheet.create({
    tabRow: { flexDirection: "row", gap: 6, paddingHorizontal: 16, paddingTop: 14, paddingBottom: 4 },
    tabBtn: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 999, borderWidth: 1, borderColor: c.border },
    tabText: { fontSize: 12, fontWeight: "700", color: c.text },
    card: {
      flexDirection: "row", alignItems: "center", gap: 12, padding: 12, marginTop: 8,
      backgroundColor: c.surface, borderWidth: 1, borderColor: c.border, borderRadius: 16,
      shadowColor: "#000", shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 3, elevation: 1,
    },
    avatar: { width: 46, height: 46, borderRadius: 999, backgroundColor: c.surface2 },
    name: { fontSize: 13, fontWeight: "700", color: c.text },
    lastMessage: { fontSize: 12, color: c.dim, marginTop: 2 },
    sectionLabel: { fontSize: 11, fontWeight: "800", color: c.dim, letterSpacing: 0.5, marginTop: 20, marginBottom: 4 },
    emptyBox: { alignItems: "center", paddingVertical: 40, paddingHorizontal: 30 },
    emptyIconWrap: { width: 56, height: 56, borderRadius: 999, backgroundColor: c.surface2, alignItems: "center", justifyContent: "center", marginBottom: 12 },
    emptyTitle: { fontSize: 14, fontWeight: "700", color: c.text },
    emptyText: { color: c.dim, fontSize: 12, textAlign: "center", marginTop: 6, lineHeight: 18 },
    acceptBtn: { width: 30, height: 30, borderRadius: 999, backgroundColor: c.accent2, alignItems: "center", justifyContent: "center" },
    declineBtn: { width: 30, height: 30, borderRadius: 999, backgroundColor: c.surface2, borderWidth: 1, borderColor: c.border, alignItems: "center", justifyContent: "center", marginLeft: 6 },
  });
}
