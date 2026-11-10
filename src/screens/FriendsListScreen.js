import { t as translateUI } from "../i18n/core";
import React, { useState, useEffect } from "react";
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView, ActivityIndicator } from "react-native";
import { FONTS } from "../theme/fonts";
import { GoldWash, SALON } from "../components/salon/SalonKit";
import { Users, Sparkles, Film, Search, X, UserPlus, ChevronRight } from "lucide-react-native";
import { useAppTheme } from "../context/ThemeContext";
import { useAuth } from "../context/AuthContext";
import { api } from "../api/client";
import { avatarOr } from "../utils/avatar";
import RetryImage from "../components/RetryImage";
import EmptyState from "../components/EmptyState";
import ScreenHeader from "../components/ScreenHeader";

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
    ? friends.filter((f) => f.name?.toLowerCase().includes(query.trim().toLowerCase()) || f.username?.toLowerCase().includes(query.trim().toLowerCase()))
    : friends;

  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      <ScreenHeader
        title={translateUI("Arkadaşlarım")}
        subtitle={friends.length > 0 ? translateUI("{0} arkadaş", {0: friends.length}) : undefined}
        onBack={() => navigation.goBack()}
        right={
          <TouchableOpacity style={styles.addFriendBtn} onPress={() => navigation.navigate("FriendSearch")} activeOpacity={0.78} accessibilityLabel={translateUI("Arkadaş bul")}>
            <UserPlus size={16} color={c.accent} />
          </TouchableOpacity>
        }
      />

      {!loading && friends.length > 0 && (
        <View style={styles.searchBoxWrap}>
          <View style={styles.searchBox}>
            <Search size={16} color={c.dim} />
            <TextInput
              style={styles.searchInput}
              placeholder={translateUI("İsim veya kullanıcı adı ara")}
              placeholderTextColor={c.dim}
              value={query}
              onChangeText={setQuery}
              autoCapitalize="none"
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
            <View>
              <EmptyState
                icon={Users}
                title={translateUI("Henüz arkadaşın yok")}
                text={translateUI("Arkadaşlarını buldukça Blend, MatchParty ve sosyal akış çok daha eğlenceli hale gelir.")}
              />
              <TouchableOpacity style={styles.findFriendsCta} onPress={() => navigation.navigate("FriendSearch")} activeOpacity={0.86}>
                <UserPlus size={16} color={c.bg} />
                <Text style={styles.findFriendsCtaText}>{translateUI("Arkadaş Bul")}</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <>
              <TouchableOpacity style={styles.leaderboardLink} onPress={() => navigation.navigate("BlendLeaderboard")} activeOpacity={0.85}>
                <View style={styles.leaderboardLinkGradient}>
                  <GoldWash height={70} strength={0.12} />
                  <Sparkles size={15} color={c.accent} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.leaderboardLinkText}>{translateUI("Uyum Sıralaması")}</Text>
                    <Text style={styles.leaderboardLinkSub}>{translateUI("En çok kiminle aynı şeyleri seçiyorsun?")}</Text>
                  </View>
                  <ChevronRight size={16} color={c.accent} />
                </View>
              </TouchableOpacity>

              {filteredFriends.length === 0 ? (
                <Text style={styles.emptySearchText}>{translateUI("\"")}{query}{translateUI("\" ile eşleşen arkadaş bulunamadı.")}</Text>
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
                        {!!f.username && <Text style={styles.username} numberOfLines={1}>{translateUI("@")}{f.username}</Text>}
                      </View>
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={() => navigation.navigate("Blend", { friendId: f.id, friendName: f.name, friendAvatar: f.avatar_url })}
                      hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                      accessibilityLabel={translateUI("{0} ile Blend oluştur", {0: f.name})}
                    >
                      <View style={styles.miniActionBtn}>
                        <Sparkles size={14} color={c.accent} />
                      </View>
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={() => navigation.navigate("MatchParty", { friend: { id: f.id, name: f.name, avatarUrl: f.avatar_url } })}
                      hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                      accessibilityLabel={translateUI("{0} ile MatchParty başlat", {0: f.name})}
                    >
                      <View style={[styles.miniActionBtn, styles.miniActionBtnGold]}>
                        <Film size={14} color="#1a150c" />
                      </View>
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
    addFriendBtn: { width: 36, height: 36, borderRadius: 999, backgroundColor: c.surface2, borderWidth: 1, borderColor: c.border, alignItems: "center", justifyContent: "center" },
    searchBoxWrap: { paddingHorizontal: 16, paddingTop: 12 },
    searchBox: {
      flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: c.surface,
      borderWidth: 1, borderColor: c.border, borderRadius: 12, paddingHorizontal: 12,
    },
    searchInput: { flex: 1, color: c.text, fontSize: 13, paddingVertical: 10 },
    leaderboardLink: { marginBottom: 14, borderRadius: 14, overflow: "hidden", borderWidth: 1, borderColor: SALON.goldLine, backgroundColor: c.surface },
    leaderboardLinkGradient: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 13, paddingHorizontal: 14 },
    leaderboardLinkText: { color: c.text, fontFamily: FONTS.marquee, fontSize: 19 },
    leaderboardLinkSub: { color: c.dim, fontSize: 10.5, marginTop: 1 },
    emptySearchText: { color: c.dim, fontSize: 12, textAlign: "center", marginTop: 20 },
    findFriendsCta: { marginTop: 12, marginHorizontal: 30, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 7, backgroundColor: c.accent, borderRadius: 14, paddingVertical: 13 },
    findFriendsCtaText: { color: c.bg, fontSize: 13, fontWeight: "900" },
    row: {
      flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: c.surface,
      borderWidth: 1, borderColor: c.border, borderRadius: 14, padding: 10, marginBottom: 8,
    },
    rowMain: { flex: 1, flexDirection: "row", alignItems: "center", gap: 12, minWidth: 0 },
    avatar: { width: 44, height: 44, borderRadius: 999, backgroundColor: c.surface2 },
    name: { fontSize: 13.5, fontWeight: "800", color: c.text },
    username: { fontSize: 11, color: c.dim, marginTop: 1 },
    miniActionBtn: { width: 34, height: 34, borderRadius: 999, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: SALON.goldLine, backgroundColor: c.surface },
    miniActionBtnGold: { backgroundColor: c.accent, borderColor: c.accent },
  });
}
