import React, { useState, useEffect, useCallback } from "react";
import { View, Text, Image, TouchableOpacity, StyleSheet, FlatList, ActivityIndicator } from "react-native";
import { ChevronLeft, X } from "lucide-react-native";
import { useAppTheme } from "../context/ThemeContext";
import { useAuth } from "../context/AuthContext";
import { api } from "../api/client";

export default function WatchlistDetailScreen({ route, navigation }) {
  const { watchlistId, name } = route.params;
  const { c } = useAppTheme();
  const { auth } = useAuth();
  const styles = makeStyles(c);

  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(() => {
    setLoading(true);
    api.watchlistItems(auth.token, watchlistId)
      .then((data) => setItems(data.results || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [watchlistId]);

  useEffect(() => { load(); }, [load]);

  async function removeItem(movieId) {
    setItems((prev) => prev.filter((m) => m.id !== movieId));
    try { await api.removeFromWatchlist(auth.token, watchlistId, movieId); } catch { load(); }
  }

  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={{ padding: 2 }}>
          <ChevronLeft size={20} color={c.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle} numberOfLines={1}>{name}</Text>
      </View>

      {loading ? (
        <ActivityIndicator style={{ marginTop: 30 }} color={c.accent} />
      ) : (
        <FlatList
          data={items}
          numColumns={3}
          contentContainerStyle={{ padding: 16, gap: 6 }}
          columnWrapperStyle={{ gap: 6 }}
          keyExtractor={(item) => String(item.id)}
          renderItem={({ item }) => (
            <View style={styles.posterWrap}>
              <TouchableOpacity onPress={() => navigation.navigate("Detail", { movie: item })}>
                {item.poster ? <Image source={{ uri: item.poster }} style={styles.poster} /> : <View style={[styles.poster, { backgroundColor: c.surface2 }]} />}
              </TouchableOpacity>
              <TouchableOpacity style={styles.removeBtn} onPress={() => removeItem(item.id)}>
                <X size={12} color="#fff" />
              </TouchableOpacity>
            </View>
          )}
          ListEmptyComponent={<Text style={styles.emptyText}>Bu liste boş.</Text>}
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
    headerTitle: { fontSize: 14, fontWeight: "700", color: c.text, flex: 1 },
    posterWrap: { flex: 1, position: "relative" },
    poster: { width: "100%", aspectRatio: 2 / 3, borderRadius: 8 },
    removeBtn: {
      position: "absolute", top: 4, right: 4, width: 20, height: 20, borderRadius: 999,
      backgroundColor: "rgba(0,0,0,0.6)", alignItems: "center", justifyContent: "center",
    },
    emptyText: { color: c.dim, fontSize: 12, textAlign: "center", marginTop: 30 },
  });
}
