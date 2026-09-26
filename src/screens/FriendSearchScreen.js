import React, { useState, useEffect, useCallback } from "react";
import { View, Text, TextInput, TouchableOpacity, StyleSheet, FlatList, ActivityIndicator, KeyboardAvoidingView, Platform } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Search, Check, X, Users, UserPlus2 } from "lucide-react-native";
import { useAppTheme } from "../context/ThemeContext";
import { useAuth } from "../context/AuthContext";
import { api } from "../api/client";
import { avatarOr } from "../utils/avatar";
import RetryImage from "../components/RetryImage";
import ScreenHeader from "../components/ScreenHeader";

export default function FriendSearchScreen({ navigation }) {
  const { c } = useAppTheme();
  const { auth } = useAuth();
  const insets = useSafeAreaInsets();
  const styles = makeStyles(c, insets);

  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [sentTo, setSentTo] = useState(new Set());
  const [requests, setRequests] = useState([]);
  const [friendIds, setFriendIds] = useState(new Set());
  const [requestsLoading, setRequestsLoading] = useState(true);
  const [busyIds, setBusyIds] = useState(new Set());
  const isSearching = query.trim().length > 0;

  const loadRequests = useCallback(() => {
    setRequestsLoading(true);
    api.friends(auth.token).then((data) => {
      setRequests(data.requests || []);
      setFriendIds(new Set((data.friends || []).map((f) => f.id)));
      setSentTo(new Set((data.sentRequests || []).map((r) => r.id)));
    }).catch(() => {}).finally(() => setRequestsLoading(false));
  }, [auth.token]);

  useEffect(() => { loadRequests(); }, [loadRequests]);

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
  }, [query, auth.token]);

  async function addFriend(userId) {
    try {
      await api.friendRequest(auth.token, userId);
      setSentTo((prev) => new Set([...prev, userId]));
    } catch {}
  }

  async function respond(fromUserId, accept) {
    setBusyIds((prev) => new Set([...prev, fromUserId]));
    try {
      await api.friendRespond(auth.token, fromUserId, accept);
      setRequests((prev) => prev.filter((r) => r.id !== fromUserId));
    } catch {}
    setBusyIds((prev) => { const n = new Set(prev); n.delete(fromUserId); return n; });
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: c.bg }}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      keyboardVerticalOffset={0}
    >
      <ScreenHeader title="Arkadaşlar" subtitle="Bul, ekle veya davet et" onBack={() => navigation.goBack()} />

      <View style={styles.body}>
        <TouchableOpacity
          style={styles.inviteRow}
          onPress={() => navigation.navigate("InviteFriend")}
        >
          <View style={styles.inviteIconWrap}><UserPlus2 size={15} color={c.bg} /></View>
          <Text style={styles.inviteRowText}>Arkadaşını Davet Et</Text>
        </TouchableOpacity>

        <View style={styles.searchBox}>
          <Search size={15} color={c.dim} />
          <TextInput
            style={styles.input}
            placeholder="İsim veya @kullaniciadi ile ara"
            placeholderTextColor={c.dim}
            value={query}
            onChangeText={setQuery}
            autoCapitalize="none"
            returnKeyType="search"
          />
        </View>

        {isSearching ? (
          <>
            {loading && <ActivityIndicator style={{ marginTop: 10 }} color={c.accent} />}
            <FlatList
              data={results}
              keyExtractor={(item) => String(item.id)}
              contentContainerStyle={styles.listContent}
              keyboardShouldPersistTaps="handled"
              keyboardDismissMode="on-drag"
              renderItem={({ item }) => {
                const isFriend = friendIds.has(item.id);
                return (
                  <View style={styles.row}>
                    <TouchableOpacity
                      style={{ flexDirection: "row", alignItems: "center", gap: 10, flex: 1 }}
                      onPress={() => navigation.navigate("OtherProfile", { userId: item.id })}
                    >
                      <RetryImage source={{ uri: avatarOr(item.avatar_url, item.id) }} style={styles.avatarPlaceholder} />
                      <View style={{ flex: 1 }}>
                        <Text style={styles.name}>{item.name}</Text>
                        {!!item.username && <Text style={styles.username}>@{item.username}</Text>}
                      </View>
                    </TouchableOpacity>
                    {isFriend ? (
                      <View style={styles.friendBadge}>
                        <Check size={12} color={c.accent} />
                        <Text style={styles.friendBadgeText}>Arkadaşsınız</Text>
                      </View>
                    ) : (
                      <TouchableOpacity
                        disabled={sentTo.has(item.id)}
                        onPress={() => addFriend(item.id)}
                        style={[styles.addBtn, sentTo.has(item.id) && { backgroundColor: c.surface2 }]}
                      >
                        <Text style={[styles.addBtnText, sentTo.has(item.id) && { color: c.dim }]}>
                          {sentTo.has(item.id) ? "Gönderildi" : "Ekle"}
                        </Text>
                      </TouchableOpacity>
                    )}
                  </View>
                );
              }}
              ListEmptyComponent={!loading ? <Text style={styles.empty}>Kullanıcı bulunamadı.</Text> : null}
            />
          </>
        ) : (
          <View style={{ marginTop: 16, flex: 1 }}>
            <Text style={styles.sectionLabel}>İSTEKLER{requests.length > 0 ? ` (${requests.length})` : ""}</Text>
            {requestsLoading ? (
              <ActivityIndicator color={c.accent} style={{ marginTop: 10 }} />
            ) : requests.length === 0 ? (
              <View style={styles.noRequestsBox}>
                <Users size={20} color={c.dim} style={{ opacity: 0.6, marginBottom: 6 }} />
                <Text style={styles.noRequestsText}>Arkadaşlık isteğiniz yok</Text>
              </View>
            ) : (
              <FlatList
                data={requests}
                keyExtractor={(item) => String(item.id)}
                contentContainerStyle={styles.listContent}
                keyboardShouldPersistTaps="handled"
                renderItem={({ item: r }) => (
                  <View style={styles.requestRow}>
                    <TouchableOpacity
                      style={{ flexDirection: "row", alignItems: "center", gap: 8, flex: 1 }}
                      onPress={() => navigation.navigate("OtherProfile", { userId: r.id })}
                    >
                      <RetryImage source={{ uri: avatarOr(r.avatar_url, r.id) }} style={styles.avatarPlaceholder} />
                      <Text style={styles.name} numberOfLines={1}>{r.name}</Text>
                    </TouchableOpacity>
                    {busyIds.has(r.id) ? (
                      <ActivityIndicator size="small" color={c.accent} />
                    ) : (
                      <>
                        <TouchableOpacity onPress={() => respond(r.id, true)} style={styles.acceptBtn}>
                          <Check size={13} color="#fff" />
                        </TouchableOpacity>
                        <TouchableOpacity onPress={() => respond(r.id, false)} style={styles.declineBtn}>
                          <X size={13} color={c.dim} />
                        </TouchableOpacity>
                      </>
                    )}
                  </View>
                )}
              />
            )}
          </View>
        )}
      </View>
    </KeyboardAvoidingView>
  );
}

function makeStyles(c, insets) {
  return StyleSheet.create({
    body: { flex: 1, paddingHorizontal: 20, paddingTop: 20, paddingBottom: Math.max(20, insets.bottom + 12) },
    listContent: { paddingVertical: 8, paddingBottom: Math.max(16, insets.bottom + 8) },
    inviteRow: {
      flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: c.accent,
      borderRadius: 12, paddingVertical: 10, paddingHorizontal: 12, marginBottom: 14,
    },
    inviteIconWrap: {
      width: 26, height: 26, borderRadius: 999, backgroundColor: "rgba(255,255,255,0.35)",
      alignItems: "center", justifyContent: "center",
    },
    inviteRowText: { color: c.bg, fontWeight: "800", fontSize: 13 },
    sectionLabel: { fontSize: 10, fontWeight: "800", color: c.dim, letterSpacing: 0.5, marginBottom: 8 },
    searchBox: {
      flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: c.surface2,
      borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10,
    },
    input: { flex: 1, color: c.text, fontSize: 13, paddingVertical: 0 },
    row: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 8 },
    requestRow: { flexDirection: "row", alignItems: "center", gap: 8, paddingVertical: 8 },
    avatarPlaceholder: { width: 34, height: 34, borderRadius: 999, backgroundColor: c.surface2 },
    name: { fontSize: 13, fontWeight: "700", color: c.text },
    username: { fontSize: 11, color: c.dim },
    addBtn: { backgroundColor: c.accent, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 6 },
    addBtnText: { fontSize: 11, fontWeight: "700", color: c.bg },
    friendBadge: { flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: c.surface2, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 6 },
    friendBadgeText: { fontSize: 11, fontWeight: "700", color: c.accent },
    acceptBtn: { width: 28, height: 28, borderRadius: 999, backgroundColor: c.accent2, alignItems: "center", justifyContent: "center" },
    declineBtn: { width: 28, height: 28, borderRadius: 999, backgroundColor: c.surface, borderWidth: 1, borderColor: c.border, alignItems: "center", justifyContent: "center", marginLeft: 6 },
    empty: { color: c.dim, fontSize: 12, textAlign: "center", paddingVertical: 20 },
    noRequestsBox: { alignItems: "center", paddingVertical: 20 },
    noRequestsText: { color: c.dim, fontSize: 12 },
  });
}
