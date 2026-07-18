import React, { useState, useEffect, useMemo } from "react";
import { Modal, View, Text, TouchableOpacity, StyleSheet, FlatList, ActivityIndicator, Image, TextInput } from "react-native";
import { X, Search, Check, Users, Send } from "lucide-react-native";
import { useAppTheme } from "../context/ThemeContext";
import { useAuth } from "../context/AuthContext";
import { api } from "../api/client";
import { avatarOr } from "../utils/avatar";
import { encodeMovieShare } from "../utils/movieShare";

export default function SendToFriendModal({ movie, onClose, onSent }) {
  const { c } = useAppTheme();
  const { auth } = useAuth();
  const [friends, setFriends] = useState([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState(null);
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const styles = makeStyles(c);

  useEffect(() => {
    api.friends(auth.token)
      .then((data) => setFriends(data.friends || []))
      .catch(() => setFriends([]))
      .finally(() => setLoading(false));
  }, []);

  const filtered = useMemo(() => {
    if (!query.trim()) return friends;
    const q = query.trim().toLowerCase();
    return friends.filter((f) => f.name?.toLowerCase().includes(q) || f.username?.toLowerCase().includes(q));
  }, [friends, query]);

  const selectedFriend = friends.find((f) => f.id === selectedId);

  async function handleSend() {
    if (!selectedFriend || sending || sent) return;
    setSending(true);
    try {
      const { chat_id } = await api.chatWith(auth.token, selectedFriend.id);
      await api.sendMessage(auth.token, chat_id, encodeMovieShare(movie));
      setSent(true);
      onSent?.(selectedFriend);
      setTimeout(onClose, 700); // kısa bir onay animasyonu görünsün, sonra kapansın
    } catch {
      setSending(false); // başarısız olursa tekrar denenebilsin
    }
  }

  return (
    <Modal visible animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.sheet}>
          <View style={styles.header}>
            <Text style={styles.headerTitle}>Arkadaşına Gönder</Text>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}><X size={18} color={c.text} /></TouchableOpacity>
          </View>

          <View style={styles.moviePreview}>
            {movie.poster ? <Image source={{ uri: movie.poster }} style={styles.moviePoster} /> : <View style={[styles.moviePoster, { backgroundColor: c.surface2 }]} />}
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={styles.movieTitle} numberOfLines={1}>{movie.title}</Text>
              <Text style={styles.movieMeta}>{movie.year} · {movie.type}</Text>
            </View>
          </View>

          {friends.length > 0 && (
            <View style={styles.searchBox}>
              <Search size={15} color={c.dim} />
              <TextInput
                style={styles.searchInput}
                placeholder="Arkadaşlarında ara"
                placeholderTextColor={c.dim}
                value={query}
                onChangeText={setQuery}
              />
            </View>
          )}

          {loading ? (
            <ActivityIndicator color={c.accent} style={{ marginVertical: 30 }} />
          ) : friends.length === 0 ? (
            <View style={styles.emptyBox}>
              <Users size={26} color={c.dim} style={{ opacity: 0.6, marginBottom: 8 }} />
              <Text style={styles.empty}>Henüz arkadaşın yok.</Text>
              <Text style={styles.emptySubtitle}>Üstteki arkadaş ekleme butonuyla birini bulup ekleyebilirsin.</Text>
            </View>
          ) : (
            <>
              <FlatList
                data={filtered}
                keyExtractor={(item) => String(item.id)}
                contentContainerStyle={{ paddingBottom: 10 }}
                keyboardShouldPersistTaps="handled"
                renderItem={({ item }) => {
                  const isSelected = selectedId === item.id;
                  return (
                    <TouchableOpacity
                      style={[styles.row, isSelected && { backgroundColor: c.surface2, borderRadius: 12 }]}
                      onPress={() => setSelectedId(item.id)}
                      activeOpacity={0.7}
                    >
                      <Image source={{ uri: avatarOr(item.avatar_url, item.id) }} style={styles.avatar} />
                      <View style={{ flex: 1, minWidth: 0 }}>
                        <Text style={styles.name}>{item.name}</Text>
                        {!!item.username && <Text style={styles.username}>@{item.username}</Text>}
                      </View>
                      <View style={[styles.radio, isSelected && { backgroundColor: c.accent, borderColor: c.accent }]}>
                        {isSelected && <Check size={12} color={c.bg} strokeWidth={3} />}
                      </View>
                    </TouchableOpacity>
                  );
                }}
                ListEmptyComponent={<Text style={styles.empty}>Aramanla eşleşen arkadaş bulunamadı.</Text>}
              />

              {/* Seçim yapılınca çıkan gönder butonu — arkadaşı seçmek göndermez, önce
                  seç, sonra bu butona basınca gönderilir. */}
              {!!selectedId && (
                <TouchableOpacity
                  style={[styles.sendBtn, sent && { backgroundColor: c.accent2 }]}
                  onPress={handleSend}
                  disabled={sending || sent}
                >
                  {sending ? (
                    <ActivityIndicator size="small" color={c.bg} />
                  ) : sent ? (
                    <>
                      <Check size={16} color={c.bg} strokeWidth={3} />
                      <Text style={styles.sendBtnText}>Gönderildi</Text>
                    </>
                  ) : (
                    <>
                      <Send size={15} color={c.bg} />
                      <Text style={styles.sendBtnText}>{selectedFriend?.name} 'e Gönder</Text>
                    </>
                  )}
                </TouchableOpacity>
              )}
            </>
          )}
        </View>
      </View>
    </Modal>
  );
}

function makeStyles(c) {
  return StyleSheet.create({
    overlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "flex-end" },
    sheet: { backgroundColor: c.surface, borderTopLeftRadius: 22, borderTopRightRadius: 22, padding: 20, maxHeight: "78%" },
    header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 16 },
    headerTitle: { fontSize: 16, fontWeight: "800", color: c.text },
    closeBtn: { width: 30, height: 30, borderRadius: 999, backgroundColor: c.surface2, alignItems: "center", justifyContent: "center" },
    moviePreview: { flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: c.surface2, borderRadius: 14, padding: 10, marginBottom: 14 },
    moviePoster: { width: 40, height: 58, borderRadius: 8 },
    movieTitle: { fontSize: 13, fontWeight: "700", color: c.text },
    movieMeta: { fontSize: 11, color: c.dim, marginTop: 2 },
    searchBox: {
      flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: c.surface2,
      borderRadius: 10, paddingHorizontal: 12, paddingVertical: 9, marginBottom: 8,
    },
    searchInput: { flex: 1, color: c.text, fontSize: 13 },
    row: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 10, paddingHorizontal: 8 },
    avatar: { width: 42, height: 42, borderRadius: 999, backgroundColor: c.surface2 },
    name: { fontSize: 13, fontWeight: "700", color: c.text },
    username: { fontSize: 11, color: c.dim, marginTop: 1 },
    radio: {
      width: 24, height: 24, borderRadius: 999, borderWidth: 2, borderColor: c.border,
      alignItems: "center", justifyContent: "center", flexShrink: 0,
    },
    empty: { color: c.dim, fontSize: 12, textAlign: "center", paddingVertical: 14 },
    emptyBox: { alignItems: "center", paddingVertical: 20 },
    emptySubtitle: { color: c.dim, fontSize: 11, textAlign: "center", marginTop: 4, lineHeight: 16, paddingHorizontal: 20 },
    sendBtn: {
      flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8,
      backgroundColor: c.accent, borderRadius: 14, paddingVertical: 14, marginTop: 8,
    },
    sendBtnText: { color: c.bg, fontWeight: "800", fontSize: 13 },
  });
}
