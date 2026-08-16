import React, { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, FlatList, Image, Modal, StyleSheet, Text, TextInput, TouchableOpacity, TouchableWithoutFeedback, View } from "react-native";
import { Search, Sparkles, Users, X } from "lucide-react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAppTheme } from "../context/ThemeContext";
import { useAuth } from "../context/AuthContext";
import { api } from "../api/client";
import { avatarOr } from "../utils/avatar";
import RetryImage from "./RetryImage";
import DismissableSheet from "./DismissableSheet";

// Nudge kartındaki "Blend Yap" — nudge birden çok arkadaşın ortak sinyaliyle tetiklense de
// Blend uygulamada HER ZAMAN 1 kişiyle yapılıyor (bkz. BlendScreen, tek bir friendId alıyor).
// Bu yüzden burada bir arkadaş SEÇİLİYOR: o filmi beğendiği bilinen arkadaşlar rozetle öne
// çıkarılıyor (liste başına sıralanıyor) ama seçim tüm arkadaş listesine açık — avatarlar
// nudge kartının içinde tek başına tıklanamayacak kadar küçüktü.
export default function BlendFriendPickerSheet({ movie, highlightFriends = [], navigation, onClose }) {
  const { c } = useAppTheme();
  const { auth } = useAuth();
  const insets = useSafeAreaInsets();
  const styles = makeStyles(c);
  const [friends, setFriends] = useState([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");

  useEffect(() => {
    api.friends(auth.token)
      .then((data) => setFriends(data.friends || []))
      .catch(() => setFriends([]))
      .finally(() => setLoading(false));
  }, []);

  const highlightIds = useMemo(() => new Set(highlightFriends.map((f) => Number(f.id))), [highlightFriends]);

  const sorted = useMemo(() => {
    const list = [...friends].sort(
      (a, b) => Number(highlightIds.has(Number(b.id))) - Number(highlightIds.has(Number(a.id)))
    );
    if (!query.trim()) return list;
    const q = query.trim().toLowerCase();
    return list.filter((f) => f.name?.toLowerCase().includes(q) || f.username?.toLowerCase().includes(q));
  }, [friends, query, highlightIds]);

  function pick(friend) {
    onClose();
    navigation.navigate("Blend", { friendId: friend.id, friendName: friend.name, friendAvatar: friend.avatar_url });
  }

  return (
    <Modal visible animationType="slide" transparent onRequestClose={onClose}>
      <TouchableWithoutFeedback onPress={onClose}>
        <View style={styles.overlay}>
          <TouchableWithoutFeedback onPress={() => {}}>
            <DismissableSheet onClose={onClose} style={[styles.sheet, { paddingBottom: 20 + insets.bottom }]} handleOnly>
              <View style={styles.header}>
                <Text style={styles.headerTitle}>Kiminle Blend yapmak istersin?</Text>
                <TouchableOpacity onPress={onClose} style={styles.closeBtn}><X size={18} color={c.text} /></TouchableOpacity>
              </View>

              <View style={styles.moviePreview}>
                {movie.poster ? <Image source={{ uri: movie.poster }} style={styles.moviePoster} /> : <View style={[styles.moviePoster, { backgroundColor: c.surface2 }]} />}
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={styles.movieTitle} numberOfLines={1}>{movie.title}</Text>
                  <Text style={styles.movieMeta}>{highlightFriends.length > 0 ? `${highlightFriends.length} arkadaşın beğendi` : `${movie.year} · ${movie.type}`}</Text>
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
                </View>
              ) : (
                <FlatList
                  data={sorted}
                  keyExtractor={(item) => String(item.id)}
                  numColumns={3}
                  columnWrapperStyle={{ gap: 10 }}
                  contentContainerStyle={{ gap: 12, paddingBottom: 10 }}
                  keyboardShouldPersistTaps="handled"
                  renderItem={({ item }) => {
                    const liked = highlightIds.has(Number(item.id));
                    return (
                      <TouchableOpacity style={styles.friendCell} onPress={() => pick(item)} activeOpacity={0.7}>
                        <View>
                          <RetryImage source={{ uri: avatarOr(item.avatar_url, item.id) }} style={[styles.gridAvatar, liked && styles.gridAvatarLiked]} />
                          {liked && (
                            <View style={styles.likedBadge}><Sparkles size={10} color="#fff" /></View>
                          )}
                        </View>
                        <Text style={styles.gridName} numberOfLines={1}>{item.name}</Text>
                      </TouchableOpacity>
                    );
                  }}
                  ListEmptyComponent={<Text style={styles.empty}>Aramanla eşleşen arkadaş bulunamadı.</Text>}
                />
              )}
            </DismissableSheet>
          </TouchableWithoutFeedback>
        </View>
      </TouchableWithoutFeedback>
    </Modal>
  );
}

function makeStyles(c) {
  return StyleSheet.create({
    overlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "flex-end" },
    sheet: { backgroundColor: c.surface, borderTopLeftRadius: 22, borderTopRightRadius: 22, padding: 20, maxHeight: "78%" },
    header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 16 },
    headerTitle: { fontSize: 16, fontWeight: "800", color: c.text, flex: 1, paddingRight: 10 },
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
    friendCell: { flex: 1, alignItems: "center" },
    gridAvatar: { width: 62, height: 62, borderRadius: 999, backgroundColor: c.surface2, borderWidth: 2, borderColor: "transparent" },
    gridAvatarLiked: { borderColor: c.accent },
    likedBadge: {
      position: "absolute", bottom: -2, right: 2, width: 18, height: 18, borderRadius: 999,
      backgroundColor: c.accent, alignItems: "center", justifyContent: "center", borderWidth: 2, borderColor: c.surface,
    },
    gridName: { fontSize: 11, fontWeight: "700", color: c.text, marginTop: 6, textAlign: "center" },
    empty: { color: c.dim, fontSize: 12, textAlign: "center", paddingVertical: 14 },
    emptyBox: { alignItems: "center", paddingVertical: 20 },
  });
}
