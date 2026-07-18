import React, { useState, useEffect, useCallback, useRef } from "react";
import { View, Text, TextInput, TouchableOpacity, StyleSheet, FlatList, Image, Platform, KeyboardAvoidingView } from "react-native";
import { ChevronLeft, Send, Film, Star, MessageCircle } from "lucide-react-native";
import { useAppTheme } from "../context/ThemeContext";
import { useAuth } from "../context/AuthContext";
import { useWS } from "../context/WSContext";
import { api } from "../api/client";
import { avatarOr } from "../utils/avatar";
import { decodeMovieShare } from "../utils/movieShare";

export default function ChatConversationScreen({ route, navigation }) {
  const { chatId, friendId, friendName, friendAvatar } = route.params;
  const { c } = useAppTheme();
  const { auth } = useAuth();
  const { subscribe } = useWS();
  const styles = makeStyles(c);
  const listRef = useRef(null);

  const [messages, setMessages] = useState([]);
  const [draft, setDraft] = useState("");

  const scrollToEnd = useCallback((animated = false) => {
    requestAnimationFrame(() => listRef.current?.scrollToEnd({ animated }));
    setTimeout(() => listRef.current?.scrollToEnd({ animated }), 120);
  }, []);

  useEffect(() => {
    const parent = navigation.getParent();
    parent?.setOptions({ tabBarStyle: { display: "none" } });
    return () => parent?.setOptions({ tabBarStyle: undefined });
  }, [navigation]);

  const loadMessages = useCallback(() => {
    api.messages(auth.token, chatId).then((data) => {
      setMessages(data.results || []);
      scrollToEnd(false);
    }).catch(() => {});
  }, [chatId]);

  useEffect(() => { loadMessages(); }, [loadMessages]);

  useEffect(() => {
    const unsub = subscribe((msg) => {
      if (msg.type === "message" && msg.chat_id === chatId) {
        setMessages((prev) => [...prev, msg.message]);
        scrollToEnd(true);
      }
    });
    return unsub;
  }, [subscribe, chatId, scrollToEnd]);

  async function sendMessage() {
    if (!draft.trim()) return;
    const body = draft.trim();
    setDraft("");
    try {
      const msg = await api.sendMessage(auth.token, chatId, body);
      setMessages((prev) => [...prev, msg]);
      scrollToEnd(true);
    } catch { /* sessizce geç */ }
  }

  function startParty() {
    navigation.navigate("MatchParty", { friend: { id: friendId, name: friendName, avatarUrl: friendAvatar } });
  }

  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={{ padding: 2 }}>
          <ChevronLeft size={20} color={c.text} />
        </TouchableOpacity>
        <TouchableOpacity style={styles.headerCenter} onPress={() => navigation.navigate("OtherProfile", { userId: friendId })}>
          <Image source={{ uri: avatarOr(friendAvatar, friendId) }} style={styles.avatar} />
          <Text style={styles.name} numberOfLines={1}>{friendName}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.partyBtn} onPress={startParty}>
          <Film size={12} color={c.bg} />
          <Text style={styles.partyBtnText}>Party</Text>
        </TouchableOpacity>
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
        <FlatList
          ref={listRef}
          style={{ flex: 1 }}
          data={messages}
          keyExtractor={(item) => String(item.id)}
          contentContainerStyle={{ padding: 14, gap: 8, flexGrow: 1, justifyContent: "flex-end" }}
          onContentSizeChange={() => scrollToEnd(false)}
          onLayout={() => scrollToEnd(false)}
          keyboardDismissMode={Platform.OS === "ios" ? "interactive" : "on-drag"}
          keyboardShouldPersistTaps="handled"
          renderItem={({ item }) => {
            const shared = decodeMovieShare(item.body);
            const isMine = item.sender_id === auth.id;
            if (shared) {
              return (
                <TouchableOpacity
                  style={[styles.movieBubble, isMine ? styles.bubbleMine : styles.bubbleTheirs]}
                  activeOpacity={0.8}
                  onPress={() => navigation.navigate("Detail", { movie: shared })}
                >
                  {shared.poster ? (
                    <Image source={{ uri: shared.poster }} style={styles.movieBubblePoster} />
                  ) : (
                    <View style={[styles.movieBubblePoster, { backgroundColor: c.surface2 }]} />
                  )}
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text style={[styles.movieBubbleLabel, isMine ? styles.bubbleTextMine : styles.bubbleTextTheirs]}>
                      🎬 Film/dizi önerisi
                    </Text>
                    <Text style={[styles.movieBubbleTitle, isMine ? styles.bubbleTextMine : styles.bubbleTextTheirs]} numberOfLines={2}>
                      {shared.title}
                    </Text>
                    <View style={styles.movieBubbleMetaRow}>
                      <Star size={10} color={isMine ? c.bg : c.accent} fill={isMine ? c.bg : c.accent} />
                      <Text style={[styles.movieBubbleMeta, isMine ? styles.bubbleTextMine : styles.bubbleTextTheirs]}>
                        {shared.imdb} · {shared.year} · {shared.type}
                      </Text>
                    </View>
                  </View>
                </TouchableOpacity>
              );
            }
            return (
              <View style={[styles.bubble, isMine ? styles.bubbleMine : styles.bubbleTheirs]}>
                <Text style={isMine ? styles.bubbleTextMine : styles.bubbleTextTheirs}>{item.body}</Text>
              </View>
            );
          }}
          ListEmptyComponent={
            <View style={styles.emptyBox}>
              <View style={styles.emptyIconWrap}><MessageCircle size={24} color={c.accent} /></View>
              <Text style={styles.emptyText}>Henüz mesaj yok, ilk mesajı sen yaz.</Text>
            </View>
          }
        />

        <View style={styles.inputRow}>
          <TextInput
            style={styles.input}
            placeholder="Mesaj yaz"
            placeholderTextColor={c.dim}
            value={draft}
            onChangeText={setDraft}
            onSubmitEditing={sendMessage}
            onFocus={() => scrollToEnd(true)}
            multiline
          />
          <TouchableOpacity style={styles.sendBtn} onPress={sendMessage}>
            <Send size={16} color={c.bg} />
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}

function makeStyles(c) {
  return StyleSheet.create({
    header: {
      flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 16, paddingTop: 54, paddingBottom: 12,
      borderBottomWidth: 1, borderBottomColor: c.border,
    },
    headerCenter: { flex: 1, flexDirection: "row", alignItems: "center", gap: 10, minWidth: 0 },
    avatar: { width: 30, height: 30, borderRadius: 999 },
    name: { fontSize: 14, fontWeight: "700", color: c.text, flexShrink: 1 },
    partyBtn: {
      backgroundColor: c.accent, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 6,
      flexDirection: "row", alignItems: "center", gap: 4,
    },
    partyBtnText: { fontSize: 11, fontWeight: "700", color: c.bg },
    bubble: {
      maxWidth: "75%", paddingHorizontal: 13, paddingVertical: 9, borderRadius: 16,
      shadowColor: "#000", shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 3, elevation: 1,
    },
    bubbleMine: { alignSelf: "flex-end", backgroundColor: c.accent, borderBottomRightRadius: 4 },
    bubbleTheirs: { alignSelf: "flex-start", backgroundColor: c.surface2, borderBottomLeftRadius: 4 },
    bubbleTextMine: { color: c.bg, fontSize: 13 },
    bubbleTextTheirs: { color: c.text, fontSize: 13 },
    movieBubble: { maxWidth: "78%", flexDirection: "row", gap: 10, padding: 10, borderRadius: 14, alignItems: "center" },
    movieBubblePoster: { width: 46, height: 66, borderRadius: 8 },
    movieBubbleLabel: { fontSize: 9, fontWeight: "700", opacity: 0.75 },
    movieBubbleTitle: { fontSize: 13, fontWeight: "700", marginTop: 2 },
    movieBubbleMetaRow: { flexDirection: "row", alignItems: "center", gap: 4, marginTop: 4 },
    movieBubbleMeta: { fontSize: 10, opacity: 0.8 },
    emptyText: { color: c.dim, fontSize: 12, textAlign: "center" },
    emptyBox: { alignItems: "center", paddingVertical: 30 },
    emptyIconWrap: { width: 52, height: 52, borderRadius: 999, backgroundColor: c.surface2, alignItems: "center", justifyContent: "center", marginBottom: 10 },
    inputRow: {
      flexDirection: "row", gap: 8, paddingHorizontal: 12, paddingVertical: 10,
      borderTopWidth: 1, borderTopColor: c.border, alignItems: "flex-end", backgroundColor: c.bg,
    },
    input: {
      flex: 1, backgroundColor: c.surface2, borderRadius: 18, paddingHorizontal: 14, paddingVertical: 10,
      color: c.text, fontSize: 13, maxHeight: 110,
    },
    sendBtn: { width: 38, height: 38, borderRadius: 999, backgroundColor: c.accent, alignItems: "center", justifyContent: "center" },
  });
}
