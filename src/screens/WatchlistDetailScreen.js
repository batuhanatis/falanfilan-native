import React, { useState, useEffect, useCallback } from "react";
import { View, Text, Image, TouchableOpacity, StyleSheet, FlatList, ActivityIndicator, Switch, Alert, TextInput } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { ChevronLeft, X, Share2, Lock, Globe, Wand2, Pencil, Check, ListChecks, Dices, Search, UserPlus, LogOut } from "lucide-react-native";
import { useAppTheme } from "../context/ThemeContext";
import { useAuth } from "../context/AuthContext";
import { api } from "../api/client";
import { avatarOr } from "../utils/avatar";
import { hapticLight, hapticSuccess } from "../utils/haptics";
import SendToFriendModal from "../components/SendToFriendModal";
import EmptyState from "../components/EmptyState";
import WatchlistCover from "../components/WatchlistCover";
import CoverPicker from "../components/CoverPicker";
import WatchlistRouletteModal from "../components/WatchlistRouletteModal";
import RetryImage from "../components/RetryImage";

export default function WatchlistDetailScreen({ route, navigation }) {
  const { watchlistId } = route.params;
  const { c } = useAppTheme();
  const { auth } = useAuth();
  const styles = makeStyles(c);

  const [items, setItems] = useState([]);
  const [listInfo, setListInfo] = useState({
    name: route.params.name || "", isPublic: false, isOwner: true, isCollaborator: false,
    owner: null, coverEmoji: null, coverColor: null, collaborators: [],
  });
  const [loading, setLoading] = useState(true);
  const [showShare, setShowShare] = useState(false);
  const [showRoulette, setShowRoulette] = useState(false);

  // WL3 — eskiden TEK bir kalem ikonu hem "yeniden adlandır" hem "silme modu" açıyordu, hangisinin
  // hangisi olduğu belli değildi. Artık ikisi ayrı: renameMode (isim+kapak) ve selectMode (silme).
  const [renameMode, setRenameMode] = useState(false);
  const [renameValue, setRenameValue] = useState("");
  const [renameEmoji, setRenameEmoji] = useState(null);
  const [renameColor, setRenameColor] = useState(null);
  const [selectMode, setSelectMode] = useState(false);

  const [aiLoading, setAiLoading] = useState(false);
  const [aiResults, setAiResults] = useState(null); // null: hiç istenmedi, []: sonuç yok, [...]: sonuçlar

  // WL2 — liste artık İÇİNDEN de doldurulabiliyor (eskiden sadece dışarıdan, ListPickerModal ile
  // ekleniyordu). Basit bir debounced arama + doğrudan ekleme.
  const [showAddSearch, setShowAddSearch] = useState(false);
  const [addQuery, setAddQuery] = useState("");
  const [addResults, setAddResults] = useState([]);
  const [addLoading, setAddLoading] = useState(false);
  const [addedIds, setAddedIds] = useState(new Set());

  // WL4 — listeyi herkese açık yapınca sessizce bırakmak yerine bir sonraki adımı öneriyoruz.
  const [showPublicPrompt, setShowPublicPrompt] = useState(false);

  // WL6 — ortak düzenleyiciler: sahip ekleyip çıkarabiliyor, bir ortak düzenleyici kendini
  // çıkarıp "ayrılabiliyor". Arkadaş listesi sadece picker açılınca çekiliyor.
  const [showCollabPicker, setShowCollabPicker] = useState(false);
  const [friends, setFriends] = useState([]);
  const [collabBusyId, setCollabBusyId] = useState(null);

  const canEdit = listInfo.isOwner || listInfo.isCollaborator;

  const load = useCallback(() => {
    setLoading(true);
    api.watchlistItems(auth.token, watchlistId)
      .then((data) => {
        setItems(data.results || []);
        setListInfo({
          name: data.name, isPublic: !!data.isPublic, isOwner: !!data.isOwner, isCollaborator: !!data.isCollaborator,
          owner: data.owner || null, coverEmoji: data.coverEmoji || null, coverColor: data.coverColor || null,
          collaborators: data.collaborators || [],
        });
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
    try {
      await api.updateWatchlist(auth.token, watchlistId, { isPublic: next });
      if (next) { hapticSuccess(); setShowPublicPrompt(true); }
      else setShowPublicPrompt(false);
    } catch { load(); }
  }

  function openRenameMode() {
    setRenameValue(listInfo.name);
    setRenameEmoji(listInfo.coverEmoji);
    setRenameColor(listInfo.coverColor);
    setRenameMode(true);
  }
  async function saveRename() {
    const trimmed = renameValue.trim();
    setRenameMode(false);
    const patch = {};
    if (trimmed && trimmed !== listInfo.name) patch.name = trimmed;
    if (renameEmoji !== listInfo.coverEmoji) patch.coverEmoji = renameEmoji;
    if (renameColor !== listInfo.coverColor) patch.coverColor = renameColor;
    if (Object.keys(patch).length === 0) return;
    setListInfo((prev) => ({ ...prev, ...(trimmed ? { name: trimmed } : {}), coverEmoji: renameEmoji, coverColor: renameColor }));
    try { await api.updateWatchlist(auth.token, watchlistId, patch); } catch { load(); }
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
          { text: "Premium'a Geç", onPress: () => navigation.navigate("Premium", { reason: "ai_limit" }) },
        ]);
      } else {
        Alert.alert("Olmadı", e.message || "Öneri alınamadı, tekrar dener misin?");
      }
    }
    setAiLoading(false);
  }

  // WL2 — arama debounce (Ana Sayfa'daki aynı 250ms deseni).
  useEffect(() => {
    if (!showAddSearch || !addQuery.trim()) { setAddResults([]); return; }
    setAddLoading(true);
    const timer = setTimeout(() => {
      Promise.all([
        api.search(auth.token, addQuery, "movie").catch(() => ({ results: [] })),
        api.search(auth.token, addQuery, "tv").catch(() => ({ results: [] })),
      ]).then(([mRes, tRes]) => {
        setAddResults([...(mRes.results || []), ...(tRes.results || [])].slice(0, 12));
      }).finally(() => setAddLoading(false));
    }, 250);
    return () => clearTimeout(timer);
  }, [addQuery, showAddSearch]);

  async function addSearchResult(m) {
    setAddedIds((prev) => new Set(prev).add(m.id));
    hapticLight();
    try {
      await api.addToWatchlist(auth.token, watchlistId, m.id);
      setItems((prev) => (prev.some((x) => x.id === m.id) ? prev : [m, ...prev]));
    } catch {
      setAddedIds((prev) => { const n = new Set(prev); n.delete(m.id); return n; });
    }
  }

  function openCollabPicker() {
    setShowCollabPicker(true);
    api.friends(auth.token).then((data) => setFriends(data.friends || [])).catch(() => {});
  }
  async function addCollaborator(userId) {
    setCollabBusyId(userId);
    try {
      await api.addWatchlistCollaborator(auth.token, watchlistId, userId);
      load();
    } catch (e) {
      Alert.alert("Olmadı", e.message || "Eklenemedi.");
    }
    setCollabBusyId(null);
  }
  async function removeCollaborator(userId) {
    setCollabBusyId(userId);
    try {
      await api.removeWatchlistCollaborator(auth.token, watchlistId, userId);
      if (userId === auth.id) navigation.goBack(); // kendini çıkardıysa (ayrıldıysa) listeden çık
      else load();
    } catch (e) {
      Alert.alert("Olmadı", e.message || "Çıkarılamadı.");
    }
    setCollabBusyId(null);
  }

  // Poster/isim yoksa (henüz veri gelmediyse) paylaşım kartı için makul bir önizleme kur.
  const previewPoster = items[0]?.poster || null;
  const coverForShare = { id: watchlistId, name: listInfo.name, coverEmoji: listInfo.coverEmoji, coverColor: listInfo.coverColor };

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

      {/* WL4 — herkese açık yapınca sessizce bırakmak yerine paylaşmayı öneriyoruz. */}
      {showPublicPrompt && (
        <View style={styles.publicPromptRow}>
          <Text style={styles.publicPromptText}>Artık herkese açık — şimdi paylaşmak ister misin?</Text>
          <TouchableOpacity onPress={() => { setShowPublicPrompt(false); setShowShare(true); }}>
            <Text style={styles.publicPromptCta}>Paylaş</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => setShowPublicPrompt(false)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <X size={14} color={c.dim} />
          </TouchableOpacity>
        </View>
      )}

      {/* WL6 — ortak düzenleyiciler. Sahip için "+" ekleme, herkes için mevcut olanları görme;
          bir ortak düzenleyici kendi avatarına basıp listeden ayrılabiliyor. */}
      {(listInfo.isOwner || listInfo.collaborators.length > 0) && (
        <View style={styles.collabRow}>
          <Text style={styles.collabLabel}>ORTAK DÜZENLEYİCİLER</Text>
          <View style={{ flexDirection: "row", alignItems: "center", paddingLeft: 8 }}>
            {listInfo.collaborators.map((u) => (
              <TouchableOpacity
                key={u.id}
                onPress={() => {
                  if (u.id === auth.id) removeCollaborator(u.id);
                  else if (listInfo.isOwner) Alert.alert(`${u.name}'i çıkar`, "Bu kişi artık bu listeyi düzenleyemeyecek.", [
                    { text: "Vazgeç", style: "cancel" },
                    { text: "Çıkar", style: "destructive", onPress: () => removeCollaborator(u.id) },
                  ]);
                }}
                style={styles.collabAvatarWrap}
              >
                <RetryImage source={{ uri: avatarOr(u.avatarUrl, u.id) }} style={styles.collabAvatar} />
              </TouchableOpacity>
            ))}
            {listInfo.isOwner && (
              <TouchableOpacity onPress={openCollabPicker} style={[styles.collabAvatarWrap, styles.collabAddBtn]}>
                <UserPlus size={14} color={c.text} />
              </TouchableOpacity>
            )}
          </View>
        </View>
      )}

      <View style={styles.actionBtnsRow}>
        <TouchableOpacity onPress={getAiRecommendations} disabled={aiLoading} activeOpacity={0.85} style={{ flex: 1 }}>
          <LinearGradient colors={["#8e2de2", "#4a00e0", "#00c9ff"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.aiBtn}>
            {aiLoading ? <ActivityIndicator color="#fff" /> : (
              <>
                <Wand2 size={19} color="#fff" />
                <Text style={styles.aiBtnText}>Buna Benzer Öner</Text>
              </>
            )}
          </LinearGradient>
        </TouchableOpacity>
        {/* WL5 — Film Gecesi Ruleti: en az 2 içerik varken anlamlı. */}
        {items.length >= 2 && (
          <TouchableOpacity onPress={() => setShowRoulette(true)} activeOpacity={0.85}>
            <LinearGradient colors={["#F97316", "#DB2777"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.rouletteBtn}>
              <Dices size={19} color="#fff" />
            </LinearGradient>
          </TouchableOpacity>
        )}
      </View>

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

      {/* WL2 — arama açıkken sonuçlar burada, listenin hemen üstünde. */}
      {showAddSearch && (
        <View style={styles.addSearchBox}>
          <View style={styles.addSearchInputRow}>
            <Search size={14} color={c.dim} />
            <TextInput
              style={styles.addSearchInput}
              placeholder="Film veya dizi ara"
              placeholderTextColor={c.dim}
              value={addQuery}
              onChangeText={setAddQuery}
              autoFocus
            />
            <TouchableOpacity onPress={() => { setShowAddSearch(false); setAddQuery(""); }}>
              <X size={16} color={c.dim} />
            </TouchableOpacity>
          </View>
          {addLoading ? (
            <ActivityIndicator color={c.accent} style={{ marginVertical: 14 }} />
          ) : addResults.length > 0 ? (
            <View style={{ marginTop: 10, gap: 8 }}>
              {addResults.map((m) => {
                const added = addedIds.has(m.id);
                return (
                  <TouchableOpacity key={m.id} style={styles.addSearchRow} onPress={() => !added && addSearchResult(m)} disabled={added}>
                    {m.poster ? <Image source={{ uri: m.poster }} style={styles.addSearchPoster} /> : <View style={[styles.addSearchPoster, { backgroundColor: c.surface2 }]} />}
                    <Text style={styles.addSearchTitle} numberOfLines={1}>{m.title}</Text>
                    {added ? <Check size={16} color={c.accent2} /> : <Text style={styles.addSearchAdd}>Ekle</Text>}
                  </TouchableOpacity>
                );
              })}
            </View>
          ) : addQuery.trim() ? (
            <Text style={styles.emptyText}>"{addQuery}" için sonuç bulunamadı</Text>
          ) : null}
        </View>
      )}

      {items.length > 0 && (
        <View style={styles.sectionLabelRow}>
          <Text style={styles.sectionLabel}>Listedekiler</Text>
          {canEdit && (
            <TouchableOpacity onPress={() => setSelectMode((v) => !v)} style={styles.selectModeBtn}>
              <ListChecks size={13} color={selectMode ? c.accent : c.dim} />
              <Text style={[styles.selectModeText, selectMode && { color: c.accent }]}>{selectMode ? "Bitti" : "Seç"}</Text>
            </TouchableOpacity>
          )}
        </View>
      )}
    </View>
  );

  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={{ padding: 2 }}>
          <ChevronLeft size={20} color={c.text} />
        </TouchableOpacity>
        {!renameMode && <WatchlistCover list={listInfo} style={styles.headerCover} emojiSize={16} />}
        <View style={{ flex: 1, minWidth: 0 }}>
          {renameMode ? (
            <TextInput
              style={styles.headerTitleInput}
              value={renameValue}
              onChangeText={setRenameValue}
              autoFocus
              onSubmitEditing={saveRename}
            />
          ) : (
            <Text style={styles.headerTitle} numberOfLines={1}>{listInfo.name}</Text>
          )}
          {!listInfo.isOwner && !!listInfo.owner && (
            <Text style={styles.headerSubtitle} numberOfLines={1}>{listInfo.owner.name} tarafından paylaşıldı</Text>
          )}
        </View>
        {canEdit && (
          <TouchableOpacity onPress={() => setShowAddSearch((v) => !v)} style={styles.shareBtn}>
            <Search size={16} color={c.text} />
          </TouchableOpacity>
        )}
        {listInfo.isOwner && (
          <TouchableOpacity onPress={renameMode ? saveRename : openRenameMode} style={styles.shareBtn}>
            {renameMode ? <Check size={17} color={c.accent} /> : <Pencil size={16} color={c.text} />}
          </TouchableOpacity>
        )}
        {listInfo.isOwner && (
          <TouchableOpacity onPress={() => setShowShare(true)} style={styles.shareBtn}>
            <Share2 size={17} color={c.text} />
          </TouchableOpacity>
        )}
      </View>

      {/* WL3/WL1 — rename modu artık kapak seçiciyi de içeriyor, tek bir "düzenleme" akışı. */}
      {renameMode && (
        <View style={styles.renamePanel}>
          <CoverPicker emoji={renameEmoji} color={renameColor} onChangeEmoji={setRenameEmoji} onChangeColor={setRenameColor} />
        </View>
      )}

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
              {selectMode && canEdit && (
                <TouchableOpacity style={styles.removeBtn} onPress={() => removeItem(item.id)}>
                  <X size={12} color="#fff" />
                </TouchableOpacity>
              )}
            </View>
          )}
          // WL2 — boş liste artık düz bir cümle değil, illüstrasyon + doğrudan bu ekrandan
          // içerik eklemeye götüren bir CTA.
          ListEmptyComponent={
            <EmptyState
              icon={ListChecks}
              title="Bu liste henüz boş"
              text="İlk içeriği ekleyerek doldurmaya başla."
              ctaLabel={canEdit ? "İçerik Ekle" : undefined}
              onPress={canEdit ? () => setShowAddSearch(true) : undefined}
              compact
            />
          }
        />
      )}

      {showShare && (
        <SendToFriendModal
          list={{ ...coverForShare, count: items.length, previewPoster }}
          onClose={() => setShowShare(false)}
        />
      )}
      {showRoulette && (
        <WatchlistRouletteModal
          items={items}
          onClose={() => setShowRoulette(false)}
          onOpenMovie={(m) => { setShowRoulette(false); navigation.navigate("Detail", { movie: m }); }}
          onSend={(m) => { setShowRoulette(false); navigation.navigate("Detail", { movie: m }); }}
        />
      )}

      {showCollabPicker && (
        <View style={styles.collabPickerOverlay}>
          <TouchableOpacity style={StyleSheet.absoluteFillObject} onPress={() => setShowCollabPicker(false)} />
          <View style={styles.collabPickerSheet}>
            <View style={styles.collabPickerHeader}>
              <Text style={styles.collabPickerTitle}>Ortak düzenleyici ekle</Text>
              <TouchableOpacity onPress={() => setShowCollabPicker(false)}><X size={18} color={c.text} /></TouchableOpacity>
            </View>
            {friends.length === 0 ? (
              <Text style={styles.emptyText}>Ekleyebileceğin bir arkadaşın yok.</Text>
            ) : (
              friends
                .filter((f) => !listInfo.collaborators.some((u) => u.id === f.id))
                .map((f) => (
                  <View key={f.id} style={styles.collabPickerRow}>
                    <RetryImage source={{ uri: avatarOr(f.avatar_url, f.id) }} style={styles.collabPickerAvatar} />
                    <Text style={styles.collabPickerName} numberOfLines={1}>{f.name}</Text>
                    <TouchableOpacity onPress={() => addCollaborator(f.id)} disabled={collabBusyId === f.id}>
                      {collabBusyId === f.id ? <ActivityIndicator size="small" color={c.accent} /> : <Text style={styles.collabPickerAdd}>Ekle</Text>}
                    </TouchableOpacity>
                  </View>
                ))
            )}
          </View>
        </View>
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
    headerCover: { width: 28, height: 28, borderRadius: 8 },
    headerTitle: { fontSize: 14, fontWeight: "700", color: c.text },
    headerTitleInput: {
      fontSize: 14, fontWeight: "700", color: c.text, borderBottomWidth: 1, borderBottomColor: c.accent, paddingVertical: 2,
    },
    headerSubtitle: { fontSize: 11, color: c.dim, marginTop: 1 },
    shareBtn: { width: 32, height: 32, borderRadius: 999, backgroundColor: c.surface, borderWidth: 1, borderColor: c.border, alignItems: "center", justifyContent: "center" },
    renamePanel: { paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: c.border, backgroundColor: c.surface },
    privacyRow: {
      flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 12,
      backgroundColor: c.surface, borderWidth: 1, borderColor: c.border, borderRadius: 14, padding: 12,
    },
    privacyTitle: { fontSize: 13, fontWeight: "700", color: c.text },
    privacySubtitle: { fontSize: 11, color: c.dim, marginTop: 2, lineHeight: 15 },
    publicPromptRow: {
      flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: `${c.accent}1a`,
      borderRadius: 12, padding: 10, marginBottom: 12,
    },
    publicPromptText: { flex: 1, fontSize: 11.5, color: c.text, fontWeight: "600" },
    publicPromptCta: { fontSize: 12, fontWeight: "800", color: c.accent },
    collabRow: { marginBottom: 12 },
    collabLabel: { fontSize: 9.5, fontWeight: "800", color: c.dim, letterSpacing: 0.5, marginBottom: 8 },
    collabAvatarWrap: {
      width: 32, height: 32, borderRadius: 999, borderWidth: 2, borderColor: c.bg,
      marginRight: -8, backgroundColor: c.surface2, alignItems: "center", justifyContent: "center",
    },
    collabAvatar: { width: "100%", height: "100%", borderRadius: 999 },
    collabAddBtn: { backgroundColor: c.surface2, borderWidth: 1, borderColor: c.border, borderStyle: "dashed" },
    actionBtnsRow: { flexDirection: "row", gap: 8 },
    aiBtn: {
      flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10,
      borderRadius: 16, paddingVertical: 16, marginBottom: 6,
      shadowColor: "#8e2de2", shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.3, shadowRadius: 12, elevation: 6,
    },
    aiBtnText: { color: "#fff", fontWeight: "800", fontSize: 15 },
    rouletteBtn: {
      width: 54, alignSelf: "stretch", borderRadius: 16, alignItems: "center", justifyContent: "center",
      shadowColor: "#DB2777", shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.3, shadowRadius: 12, elevation: 6,
    },
    aiResultsBox: { marginTop: 14, marginBottom: 6 },
    aiResultsTitle: { fontSize: 12.5, fontWeight: "800", color: c.text, marginBottom: 10 },
    aiPoster: { width: 84, height: 122, borderRadius: 10 },
    aiPosterTitle: { fontSize: 10.5, color: c.dim, marginTop: 4, width: 84 },
    addSearchBox: { marginTop: 14, backgroundColor: c.surface, borderWidth: 1, borderColor: c.border, borderRadius: 14, padding: 12 },
    addSearchInputRow: { flexDirection: "row", alignItems: "center", gap: 8 },
    addSearchInput: { flex: 1, color: c.text, fontSize: 13, paddingVertical: 4 },
    addSearchRow: { flexDirection: "row", alignItems: "center", gap: 10 },
    addSearchPoster: { width: 32, height: 46, borderRadius: 6 },
    addSearchTitle: { flex: 1, fontSize: 12.5, color: c.text, fontWeight: "600" },
    addSearchAdd: { fontSize: 12, fontWeight: "800", color: c.accent },
    sectionLabelRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 18, marginBottom: 4 },
    sectionLabel: { fontSize: 12.5, fontWeight: "800", color: c.text },
    selectModeBtn: { flexDirection: "row", alignItems: "center", gap: 4 },
    selectModeText: { fontSize: 11.5, fontWeight: "700", color: c.dim },
    posterWrap: { flex: 1, position: "relative" },
    poster: { width: "100%", aspectRatio: 2 / 3, borderRadius: 8 },
    removeBtn: {
      position: "absolute", top: 4, right: 4, width: 20, height: 20, borderRadius: 999,
      backgroundColor: "rgba(0,0,0,0.6)", alignItems: "center", justifyContent: "center",
    },
    emptyText: { color: c.dim, fontSize: 12, textAlign: "center", marginTop: 10 },
    collabPickerOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "flex-end" },
    collabPickerSheet: { backgroundColor: c.surface, borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, maxHeight: "60%" },
    collabPickerHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 14 },
    collabPickerTitle: { fontSize: 15, fontWeight: "800", color: c.text },
    collabPickerRow: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 10 },
    collabPickerAvatar: { width: 34, height: 34, borderRadius: 999, backgroundColor: c.surface2 },
    collabPickerName: { flex: 1, fontSize: 13, color: c.text, fontWeight: "600" },
    collabPickerAdd: { fontSize: 12, fontWeight: "800", color: c.accent },
  });
}
