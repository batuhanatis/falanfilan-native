import React, { useState, useEffect, useCallback } from "react";
import { View, Text, Image, TouchableOpacity, StyleSheet, FlatList, ActivityIndicator, Switch, Alert, TextInput } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { ChevronLeft, X, Share2, Lock, Globe, Wand2, Pencil, Check } from "lucide-react-native";
import { useAppTheme } from "../context/ThemeContext";
import { useAuth } from "../context/AuthContext";
import { api } from "../api/client";
import SendToFriendModal from "../components/SendToFriendModal";

export default function WatchlistDetailScreen({ route, navigation }) {
  const { watchlistId } = route.params;
  const { c } = useAppTheme();
  const { auth } = useAuth();
  const styles = makeStyles(c);

  const [items, setItems] = useState([]);
  const [listInfo, setListInfo] = useState({ name: route.params.name || "", isPublic: false, isOwner: true, owner: null });
  const [loading, setLoading] = useState(true);
  const [showShare, setShowShare] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [renameValue, setRenameValue] = useState("");
  const [aiLoading, setAiLoading] = useState(false);
  const [aiResults, setAiResults] = useState(null); // null: hiç istenmedi, []: sonuç yok, [...]: sonuçlar

  const load = useCallback(() => {
    setLoading(true);
    api.watchlistItems(auth.token, watchlistId)
      .then((data) => {
        setItems(data.results || []);
        setListInfo({ name: data.name, isPublic: !!data.isPublic, isOwner: !!data.isOwner, owner: data.owner || null });
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [watchlistId]);

  useEffect(() => { load(); }, [load]);

  async function removeItem(movieId) {
    setItems((prev) => prev.filter((m) => m.id !== movieId));
    try { await api.removeFromWatchlist(auth.token, watchlistId, movieId); } catch { load(); }
  }

  async function togglePublic() {
    const next = !listInfo.isPublic;
    setListInfo((prev) => ({ ...prev, isPublic: next })); // anında yansısın, sonra doğrula
    try { await api.updateWatchlist(auth.token, watchlistId, { isPublic: next }); } catch { load(); }
  }

  // Düzenle butonu tek bir "düzenleme modu" açıp kapatıyor: açıkken hem posterlerin sağ üst
  // köşesinde silme butonu çıkıyor hem de liste adı düzenlenebilir hale geliyor. Kapatınca
  // (tekrar basınca) varsa isim değişikliği kaydediliyor.
  function toggleEditMode() {
    if (!editMode) {
      setRenameValue(listInfo.name);
      setEditMode(true);
      return;
    }
    const trimmed = renameValue.trim();
    setEditMode(false);
    if (trimmed && trimmed !== listInfo.name) {
      setListInfo((prev) => ({ ...prev, name: trimmed })); // anında yansısın
      api.updateWatchlist(auth.token, watchlistId, { name: trimmed }).catch(() => load());
    }
  }

  // Premium değilse AI hakkı burada da (diğer AI özellikleriyle aynı şekilde) düşüyor —
  // backend zaten bunu tryConsumeAiUse ile kontrol ediyor, burada sadece hakkı dolmuşsa
  // kullanıcıyı Premium'a yönlendiren tanıdık uyarıyı gösteriyoruz.
  async function getAiRecommendations() {
    if (items.length === 0) {
      Alert.alert("Liste boş", "Önerim yapabilmem için listede en az 1 içerik olmalı.");
      return;
    }
    setAiLoading(true);
    try {
      const data = await api.aiRecommendForList(auth.token, watchlistId);
      setAiResults(data.results || []);
    } catch (e) {
      if (e.limitReached) {
        Alert.alert("Günlük AI hakkın doldu", e.message, [
          { text: "Tamam", style: "cancel" },
          { text: "Premium'a Geç", onPress: () => navigation.navigate("Premium") },
        ]);
      } else {
        Alert.alert("Olmadı", e.message || "Öneri alınamadı, tekrar dener misin?");
      }
    }
    setAiLoading(false);
  }

  // Poster/isim yoksa (henüz veri gelmediyse) paylaşım kartı için makul bir önizleme kur.
  const previewPoster = items[0]?.poster || null;

  const ListHeader = (
    <View>
      {listInfo.isOwner && (
        <View style={styles.privacyRow}>
          {listInfo.isPublic ? <Globe size={15} color={c.accent} /> : <Lock size={15} color={c.dim} />}
          <View style={{ flex: 1 }}>
            <Text style={styles.privacyTitle}>{listInfo.isPublic ? "Herkese Açık" : "Gizli"}</Text>
            <Text style={styles.privacySubtitle}>
              {listInfo.isPublic ? "Bu listeyi profilinden görebilen ve paylaştığın herkes açabilir." : "Sadece sen görebilirsin."}
            </Text>
          </View>
          <Switch value={listInfo.isPublic} onValueChange={togglePublic} trackColor={{ true: c.accent }} />
        </View>
      )}

      <TouchableOpacity onPress={getAiRecommendations} disabled={aiLoading} activeOpacity={0.85}>
        <LinearGradient colors={["#8e2de2", "#4a00e0", "#00c9ff"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.aiBtn}>
          {aiLoading ? <ActivityIndicator color="#fff" /> : (
            <>
              <Wand2 size={19} color="#fff" />
              <Text style={styles.aiBtnText}>Buna Benzer Öner</Text>
            </>
          )}
        </LinearGradient>
      </TouchableOpacity>

      {aiResults !== null && (
        <View style={styles.aiResultsBox}>
          {aiResults.length === 0 ? (
            <Text style={styles.emptyText}>Bu listeye gerçekten benzer bir şey bulamadım.</Text>
          ) : (
            <>
              <Text style={styles.aiResultsTitle}>Bu listeye benzer</Text>
              <FlatList
                data={aiResults}
                horizontal
                showsHorizontalScrollIndicator={false}
                keyExtractor={(item) => String(item.id)}
                contentContainerStyle={{ gap: 10 }}
                renderItem={({ item }) => (
                  <TouchableOpacity onPress={() => navigation.navigate("Detail", { movie: item })}>
                    {item.poster ? <Image source={{ uri: item.poster }} style={styles.aiPoster} /> : <View style={[styles.aiPoster, { backgroundColor: c.surface2 }]} />}
                    <Text style={styles.aiPosterTitle} numberOfLines={1}>{item.title}</Text>
                  </TouchableOpacity>
                )}
              />
            </>
          )}
        </View>
      )}

      {items.length > 0 && <Text style={styles.sectionLabel}>Listedekiler</Text>}
    </View>
  );

  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={{ padding: 2 }}>
          <ChevronLeft size={20} color={c.text} />
        </TouchableOpacity>
        <View style={{ flex: 1, minWidth: 0 }}>
          {editMode ? (
            <TextInput
              style={styles.headerTitleInput}
              value={renameValue}
              onChangeText={setRenameValue}
              autoFocus
              onSubmitEditing={toggleEditMode}
            />
          ) : (
            <Text style={styles.headerTitle} numberOfLines={1}>{listInfo.name}</Text>
          )}
          {!listInfo.isOwner && !!listInfo.owner && (
            <Text style={styles.headerSubtitle} numberOfLines={1}>{listInfo.owner.name} tarafından paylaşıldı</Text>
          )}
        </View>
        {listInfo.isOwner && (
          <>
            <TouchableOpacity onPress={toggleEditMode} style={styles.shareBtn}>
              {editMode ? <Check size={17} color={c.accent} /> : <Pencil size={16} color={c.text} />}
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setShowShare(true)} style={styles.shareBtn}>
              <Share2 size={17} color={c.text} />
            </TouchableOpacity>
          </>
        )}
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
          ListHeaderComponent={ListHeader}
          renderItem={({ item }) => (
            <View style={styles.posterWrap}>
              <TouchableOpacity onPress={() => navigation.navigate("Detail", { movie: item })}>
                {item.poster ? <Image source={{ uri: item.poster }} style={styles.poster} /> : <View style={[styles.poster, { backgroundColor: c.surface2 }]} />}
              </TouchableOpacity>
              {editMode && listInfo.isOwner && (
                <TouchableOpacity style={styles.removeBtn} onPress={() => removeItem(item.id)}>
                  <X size={12} color="#fff" />
                </TouchableOpacity>
              )}
            </View>
          )}
          ListEmptyComponent={<Text style={styles.emptyText}>Bu liste boş.</Text>}
        />
      )}

      {showShare && (
        <SendToFriendModal
          list={{ id: watchlistId, name: listInfo.name, count: items.length, previewPoster }}
          onClose={() => setShowShare(false)}
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
    headerTitle: { fontSize: 14, fontWeight: "700", color: c.text },
    headerTitleInput: {
      fontSize: 14, fontWeight: "700", color: c.text, borderBottomWidth: 1, borderBottomColor: c.accent, paddingVertical: 2,
    },
    headerSubtitle: { fontSize: 11, color: c.dim, marginTop: 1 },
    shareBtn: { width: 32, height: 32, borderRadius: 999, backgroundColor: c.surface, borderWidth: 1, borderColor: c.border, alignItems: "center", justifyContent: "center" },
    privacyRow: {
      flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 12,
      backgroundColor: c.surface, borderWidth: 1, borderColor: c.border, borderRadius: 14, padding: 12,
    },
    privacyTitle: { fontSize: 13, fontWeight: "700", color: c.text },
    privacySubtitle: { fontSize: 11, color: c.dim, marginTop: 2, lineHeight: 15 },
    aiBtn: {
      flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10,
      borderRadius: 16, paddingVertical: 16, marginBottom: 6,
      shadowColor: "#8e2de2", shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.3, shadowRadius: 12, elevation: 6,
    },
    aiBtnText: { color: "#fff", fontWeight: "800", fontSize: 15 },
    aiResultsBox: { marginTop: 14, marginBottom: 6 },
    aiResultsTitle: { fontSize: 12.5, fontWeight: "800", color: c.text, marginBottom: 10 },
    aiPoster: { width: 84, height: 122, borderRadius: 10 },
    aiPosterTitle: { fontSize: 10.5, color: c.dim, marginTop: 4, width: 84 },
    sectionLabel: { fontSize: 12.5, fontWeight: "800", color: c.text, marginTop: 18, marginBottom: 4 },
    posterWrap: { flex: 1, position: "relative" },
    poster: { width: "100%", aspectRatio: 2 / 3, borderRadius: 8 },
    removeBtn: {
      position: "absolute", top: 4, right: 4, width: 20, height: 20, borderRadius: 999,
      backgroundColor: "rgba(0,0,0,0.6)", alignItems: "center", justifyContent: "center",
    },
    emptyText: { color: c.dim, fontSize: 12, textAlign: "center", marginTop: 10 },
  });
}
