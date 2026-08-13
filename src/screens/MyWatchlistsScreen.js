import React, { useState, useEffect, useCallback } from "react";
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, ActivityIndicator } from "react-native";
import { ChevronLeft, Plus, ListVideo } from "lucide-react-native";
import { useAppTheme } from "../context/ThemeContext";
import { useAuth } from "../context/AuthContext";
import { api } from "../api/client";
import WatchlistCover from "../components/WatchlistCover";
import NewListModal from "../components/NewListModal";
import EmptyState from "../components/EmptyState";

// Profil'deki "Liste" sayısına dokununca açılan, eskiden Profil sekmesinin İÇİNDE dümdüz bir
// ızgara olan "Listelerim" alanının yerine geçen ayrı sayfa (bkz. FriendsListScreen — aynı
// gerekçeyle: sayı zaten tıklanabilir olduğu belli, sekme olarak tekrarına gerek yok).
export default function MyWatchlistsScreen({ navigation }) {
  const { c } = useAppTheme();
  const { auth } = useAuth();
  const styles = makeStyles(c);
  const [watchlists, setWatchlists] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showNewList, setShowNewList] = useState(false);

  const load = useCallback(() => {
    api.watchlists(auth.token).then((data) => setWatchlists(data.results || [])).catch(() => {}).finally(() => setLoading(false));
  }, [auth.token]);

  useEffect(() => { load(); }, [load]);

  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={{ padding: 2 }}>
          <ChevronLeft size={20} color={c.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Listelerim{watchlists.length > 0 ? ` (${watchlists.length})` : ""}</Text>
      </View>

      {loading ? (
        <ActivityIndicator style={{ marginTop: 40 }} color={c.accent} />
      ) : (
        <ScrollView contentContainerStyle={{ padding: 16 }}>
          <TouchableOpacity style={styles.newListToggle} onPress={() => setShowNewList(true)}>
            <Plus size={15} color={c.accent} />
            <Text style={styles.newListToggleText}>Yeni Liste Oluştur</Text>
          </TouchableOpacity>

          {watchlists.length > 0 ? (
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10 }}>
              {watchlists.map((wl) => (
                <TouchableOpacity
                  key={wl.id}
                  style={styles.watchlistCard}
                  onPress={() => navigation.navigate("WatchlistDetail", { watchlistId: wl.id, name: wl.name })}
                >
                  <WatchlistCover list={wl} style={styles.watchlistPreview} />
                  <Text style={styles.watchlistName} numberOfLines={1}>{wl.name}</Text>
                  <Text style={styles.watchlistCount}>{wl.count} içerik{wl.isPublic ? " · Herkese Açık" : ""}</Text>
                </TouchableOpacity>
              ))}
            </View>
          ) : (
            <EmptyState
              icon={ListVideo}
              title="Henüz bir listen yok"
              text="Yukarıdan yeni bir liste oluşturup içerik eklemeye başlayabilirsin."
            />
          )}
        </ScrollView>
      )}

      <NewListModal
        visible={showNewList}
        onClose={() => setShowNewList(false)}
        onCreated={(list) => setWatchlists((prev) => [...prev, list])}
      />
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
    newListToggle: {
      flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6,
      borderWidth: 1, borderColor: c.accent, borderStyle: "dashed", borderRadius: 12,
      paddingVertical: 12, marginBottom: 14,
    },
    newListToggleText: { color: c.accent, fontWeight: "700", fontSize: 13 },
    watchlistCard: { width: "31%", backgroundColor: c.surface, borderWidth: 1, borderColor: c.border, borderRadius: 12, padding: 8 },
    watchlistPreview: { width: "100%", aspectRatio: 1, borderRadius: 8, marginBottom: 6 },
    watchlistName: { fontSize: 11, fontWeight: "700", color: c.text },
    watchlistCount: { fontSize: 10, color: c.dim, marginTop: 1 },
  });
}
