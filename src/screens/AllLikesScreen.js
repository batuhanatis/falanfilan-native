import React, { useState, useEffect, useCallback } from "react";
import { View, Text, Image, StyleSheet, TouchableOpacity, FlatList, ActivityIndicator } from "react-native";
import { ChevronLeft } from "lucide-react-native";
import { useAppTheme } from "../context/ThemeContext";
import { useAuth } from "../context/AuthContext";
import { api } from "../api/client";

// Profil sayfasındaki 30'la sınırlı önizlemenin aksine, buradaki liste sayfalanarak (kullanıcı
// kaydırdıkça) TÜMÜNÜ gösteriyor — kaç tane olursa olsun hiçbiri eksik kalmıyor.
// "kind" parametresi ("likes" | "dislikes") hangi veriyi çekeceğimizi belirliyor — dislikes
// SADECE kendi profilin için var (userId'ye ihtiyacı yok, hep giriş yapan kullanıcı).
export default function AllLikesScreen({ route, navigation }) {
  const { userId, title, kind = "likes" } = route.params;
  const { c } = useAppTheme();
  const { auth } = useAuth();
  const styles = makeStyles(c);

  const [items, setItems] = useState([]);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);

  const loadPage = useCallback(async (pageNum) => {
    const data = kind === "dislikes"
      ? await api.allDislikes(auth.token, pageNum)
      : await api.allLikes(auth.token, userId, pageNum);
    return data;
  }, [auth.token, userId, kind]);

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const data = await loadPage(1);
        setItems(data.results || []);
        setHasMore(!!data.hasMore);
        setPage(1);
      } catch { /* sessizce geç */ }
      setLoading(false);
    })();
  }, [loadPage]);

  async function handleLoadMore() {
    if (loadingMore || !hasMore) return;
    setLoadingMore(true);
    try {
      const nextPage = page + 1;
      const data = await loadPage(nextPage);
      setItems((prev) => [...prev, ...(data.results || [])]);
      setHasMore(!!data.hasMore);
      setPage(nextPage);
    } catch { /* sessizce geç */ }
    setLoadingMore(false);
  }

  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={{ padding: 2 }}>
          <ChevronLeft size={20} color={c.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{title || "Beğeniler"}</Text>
      </View>

      {loading ? (
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
          <ActivityIndicator size="large" color={c.accent} />
        </View>
      ) : (
        <FlatList
          data={items}
          numColumns={3}
          keyExtractor={(item) => String(item.id)}
          contentContainerStyle={{ padding: 16, gap: 6 }}
          columnWrapperStyle={{ gap: 6 }}
          onEndReachedThreshold={0.5}
          onEndReached={handleLoadMore}
          renderItem={({ item }) => (
            <TouchableOpacity style={{ flex: 1 }} onPress={() => navigation.navigate("Detail", { movie: item })}>
              {item.poster ? <Image source={{ uri: item.poster }} style={styles.poster} />
                : <View style={[styles.poster, { backgroundColor: c.surface2 }]} />}
            </TouchableOpacity>
          )}
          ListFooterComponent={loadingMore ? <ActivityIndicator style={{ marginVertical: 16 }} color={c.accent} /> : null}
          ListEmptyComponent={<Text style={styles.emptyText}>{kind === "dislikes" ? "Henüz bir beğenmeme yok." : "Henüz bir beğeni yok."}</Text>}
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
    headerTitle: { fontSize: 15, fontWeight: "700", color: c.text },
    poster: { flex: 1, aspectRatio: 2 / 3, borderRadius: 8 },
    emptyText: { color: c.dim, fontSize: 12, textAlign: "center", marginTop: 40 },
  });
}
