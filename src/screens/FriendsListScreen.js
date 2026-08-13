import React, { useState, useEffect } from "react";
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView, ActivityIndicator } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { ChevronLeft, Users, Sparkles, Film, Search, X } from "lucide-react-native";
import { useAppTheme } from "../context/ThemeContext";
import { useAuth } from "../context/AuthContext";
import { api } from "../api/client";
import { avatarOr } from "../utils/avatar";
import RetryImage from "../components/RetryImage";
import EmptyState from "../components/EmptyState";

// Profil'deki "Arkadaş" sayısına dokununca açılan, eskiden Profil sekmesinin İÇİNDE dümdüz bir
// liste olan "Arkadaşlar" alanının yerine geçen ayrı sayfa (Instagram'daki gibi — sayı zaten
// tıklanabilir olduğu belli, ayrıca sekme olarak tekrar göstermeye gerek yok).
//
// ÖNEMLİ: Satırlarda artık uyum yüzdesi YOK — bunun yerine ChatConversationScreen'in
// başlığındaki AYNI Blend/Party kısayolları var. Uyum puanı sadece "Zevk Uyumu Sıralaması"na
// (BlendLeaderboardScreen) dokununca gösteriliyor — hem her açılışta herkese aynı yüzdeyi
// göstermek yerine bunu bilinçli bir tıklamanın arkasına saklıyoruz, hem de listedeki HER
// arkadaş için ayrıca bir /api/friends/match-ranking çekmeye gerek kalmıyor.
export default function FriendsListScreen({ navigation }) {
  const { c } = useAppTheme();
  const { auth } = useAuth();
  const styles = makeStyles(c);
  const [friends, setFriends] = useState([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");

  useEffect(() => {
    api.friends(auth.token).then((data) => setFriends(data.friends || [])).catch(() => {}).finally(() => setLoading(false));
  }, []);

  const filteredFriends = query.trim()
    ? friends.filter((f) => f.name?.toLowerCase().includes(query.trim().toLowerCase()))
    : friends;

  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={{ padding: 2 }}>
          <ChevronLeft size={20} color={c.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Arkadaşlarım{friends.length > 0 ? ` (${friends.length})` : ""}</Text>
      </View>

      {!loading && friends.length > 0 && (
        <View style={styles.searchBoxWrap}>
          <View style={styles.searchBox}>
            <Search size={16} color={c.dim} />
            <TextInput
              style={styles.searchInput}
              placeholder="Arkadaş ara"
              placeholderTextColor={c.dim}
              value={query}
              onChangeText={setQuery}
            />
            {query.length > 0 && (
              <TouchableOpacity onPress={() => setQuery("")} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <X size={15} color={c.dim} />
              </TouchableOpacity>
            )}
          </View>
        </View>
      )}

      {loading ? (
        <ActivityIndicator style={{ marginTop: 40 }} color={c.accent} />
      ) : (
        <ScrollView contentContainerStyle={{ padding: 16, paddingTop: friends.length > 0 ? 4 : 16 }}>
          {friends.length === 0 ? (
            <EmptyState
              icon={Users}
              title="Henüz arkadaşın yok"
              text="Sağ üstteki arama simgesinden arkadaş ekleyebilirsin."
            />
          ) : (
            <>
              {/* BL4 — arkadaşların genelinde "en çok uyumlu olduğun kişi" sıralamasına giriş noktası
                  — uyum yüzdeleri artık SADECE burada görünüyor. */}
              <TouchableOpacity style={styles.leaderboardLink} onPress={() => navigation.navigate("BlendLeaderboard")} activeOpacity={0.85}>
                <LinearGradient colors={["#0EA5E9", "#6366F1", "#8B5CF6"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.leaderboardLinkGradient}>
                  <Sparkles size={14} color="#fff" />
                  <Text style={styles.leaderboardLinkText}>Zevk Uyumu Sıralaması</Text>
                </LinearGradient>
              </TouchableOpacity>

              {filteredFriends.length === 0 ? (
                <Text style={styles.emptySearchText}>"{query}" ile eşleşen arkadaş bulunamadı.</Text>
              ) : (
                filteredFriends.map((f) => (
                  <View key={f.id} style={styles.row}>
                    <TouchableOpacity
                      style={styles.rowMain}
                      onPress={() => navigation.navigate("OtherProfile", { userId: f.id })}
                      activeOpacity={0.85}
                    >
                      <RetryImage source={{ uri: avatarOr(f.avatar_url, f.id) }} style={styles.avatar} />
                      <View style={{ flex: 1, minWidth: 0 }}>
                        <Text style={styles.name} numberOfLines={1}>{f.name}</Text>
                        {!!f.username && <Text style={styles.username} numberOfLines={1}>@{f.username}</Text>}
                      </View>
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={() => navigation.navigate("Blend", { friendId: f.id, friendName: f.name, friendAvatar: f.avatar_url })}
                      hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                    >
                      <LinearGradient colors={["#0EA5E9", "#6366F1", "#8B5CF6"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.miniActionBtn}>
                        <Sparkles size={14} color="#fff" />
                      </LinearGradient>
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={() => navigation.navigate("MatchParty", { friend: { id: f.id, name: f.name, avatarUrl: f.avatar_url } })}
                      hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                    >
                      <LinearGradient colors={["#7C3AED", "#DB2777", "#F97316"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.miniActionBtn}>
                        <Film size={14} color="#fff" />
                      </LinearGradient>
                    </TouchableOpacity>
                  </View>
                ))
              )}
            </>
          )}
        </ScrollView>
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
    headerTitle: { fontSize: 14, fontWeight: "700", color: c.text },
    searchBoxWrap: { paddingHorizontal: 16, paddingTop: 12 },
    searchBox: {
      flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: c.surface,
      borderWidth: 1, borderColor: c.border, borderRadius: 12, paddingHorizontal: 12,
    },
    searchInput: { flex: 1, color: c.text, fontSize: 13, paddingVertical: 10 },
    leaderboardLink: { marginBottom: 14, borderRadius: 12, overflow: "hidden" },
    leaderboardLinkGradient: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, paddingVertical: 12 },
    leaderboardLinkText: { color: "#fff", fontWeight: "800", fontSize: 12.5 },
    emptySearchText: { color: c.dim, fontSize: 12, textAlign: "center", marginTop: 20 },
    row: {
      flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: c.surface,
      borderWidth: 1, borderColor: c.border, borderRadius: 14, padding: 10, marginBottom: 8,
    },
    rowMain: { flex: 1, flexDirection: "row", alignItems: "center", gap: 12, minWidth: 0 },
    avatar: { width: 44, height: 44, borderRadius: 999, backgroundColor: c.surface2 },
    name: { fontSize: 13.5, fontWeight: "700", color: c.text },
    username: { fontSize: 11, color: c.dim, marginTop: 1 },
    miniActionBtn: { width: 32, height: 32, borderRadius: 999, alignItems: "center", justifyContent: "center" },
  });
}
