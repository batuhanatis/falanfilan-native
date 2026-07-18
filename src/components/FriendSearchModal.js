import React, { useState, useEffect } from "react";
import { Modal, View, Text, TextInput, TouchableOpacity, StyleSheet, FlatList, ActivityIndicator, KeyboardAvoidingView, Platform, Image } from "react-native";
import { X, Search } from "lucide-react-native";
import { useAppTheme } from "../context/ThemeContext";
import { useAuth } from "../context/AuthContext";
import { api } from "../api/client";
import { avatarOr } from "../utils/avatar";

export default function FriendSearchModal({ visible, onClose }) {
  const { c } = useAppTheme();
  const { auth } = useAuth();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [sentTo, setSentTo] = useState(new Set());
  const styles = makeStyles(c);

  useEffect(() => {
    if (!query.trim()) { setResults([]); return; }
    setLoading(true);
    const timer = setTimeout(() => {
      api.userSearch(auth.token, query)
        .then((data) => setResults(data.results || []))
        .catch(() => setResults([]))
        .finally(() => setLoading(false));
    }, 400);
    return () => clearTimeout(timer);
  }, [query]);

  async function addFriend(userId) {
    try {
      await api.friendRequest(auth.token, userId);
      setSentTo((prev) => new Set([...prev, userId]));
    } catch { /* sessizce geç */ }
  }

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose} transparent>
      <KeyboardAvoidingView
        style={styles.overlay}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        keyboardVerticalOffset={Platform.OS === "ios" ? 0 : 24}
      >
        <View style={styles.sheet}>
          <View style={styles.header}>
            <Text style={styles.title}>Arkadaş Ara</Text>
            <TouchableOpacity onPress={onClose}><X size={20} color={c.text} /></TouchableOpacity>
          </View>
          <View style={styles.searchBox}>
            <Search size={15} color={c.dim} />
            <TextInput
              style={styles.input}
              placeholder="İsim veya @kullaniciadi"
              placeholderTextColor={c.dim}
              value={query}
              onChangeText={setQuery}
              autoCapitalize="none"
            />
          </View>
          {loading && <ActivityIndicator style={{ marginTop: 10 }} color={c.accent} />}
          <FlatList
            data={results}
            keyExtractor={(item) => String(item.id)}
            contentContainerStyle={{ paddingVertical: 8 }}
            renderItem={({ item }) => (
              <View style={styles.row}>
                <Image source={{ uri: avatarOr(item.avatar_url, item.id) }} style={styles.avatarPlaceholder} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.name}>{item.name}</Text>
                  {!!item.username && <Text style={styles.username}>@{item.username}</Text>}
                </View>
                <TouchableOpacity
                  disabled={sentTo.has(item.id)}
                  onPress={() => addFriend(item.id)}
                  style={[styles.addBtn, sentTo.has(item.id) && { backgroundColor: c.surface2 }]}
                >
                  <Text style={[styles.addBtnText, sentTo.has(item.id) && { color: c.dim }]}>
                    {sentTo.has(item.id) ? "Gönderildi" : "Ekle"}
                  </Text>
                </TouchableOpacity>
              </View>
            )}
            ListEmptyComponent={
              !loading && query.trim() ? <Text style={styles.empty}>Kullanıcı bulunamadı.</Text> : null
            }
          />
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

function makeStyles(c) {
  return StyleSheet.create({
    overlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "flex-end" },
    sheet: { backgroundColor: c.surface, borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, maxHeight: "80%" },
    header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 14 },
    title: { fontSize: 16, fontWeight: "800", color: c.text },
    searchBox: {
      flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: c.surface2,
      borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10,
    },
    input: { flex: 1, color: c.text, fontSize: 13 },
    row: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 8 },
    avatarPlaceholder: { width: 34, height: 34, borderRadius: 999, backgroundColor: c.surface2 },
    name: { fontSize: 13, fontWeight: "700", color: c.text },
    username: { fontSize: 11, color: c.dim },
    addBtn: { backgroundColor: c.accent, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 6 },
    addBtnText: { fontSize: 11, fontWeight: "700", color: c.bg },
    empty: { color: c.dim, fontSize: 12, textAlign: "center", paddingVertical: 20 },
  });
}
