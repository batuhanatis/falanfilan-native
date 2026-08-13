import React, { useState, useEffect, useMemo } from "react";
import { Modal, View, Text, TouchableOpacity, StyleSheet, FlatList, ActivityIndicator, Image, TextInput, Share, TouchableWithoutFeedback } from "react-native";
import { X, Search, Check, Users, Send, Share2, ListVideo } from "lucide-react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAppTheme } from "../context/ThemeContext";
import { useAuth } from "../context/AuthContext";
import { api } from "../api/client";
import { avatarOr } from "../utils/avatar";
import RetryImage from "./RetryImage";
import { encodeMovieShare } from "../utils/movieShare";
import { encodeListShare } from "../utils/listShare";
import { getStoreLink } from "../utils/appLinks";
import DismissableSheet from "./DismissableSheet";

// ÖNEMLİ: Bu modal artık hem FİLM hem LİSTE paylaşımı için kullanılıyor — "movie" veya "list"
// prop'larından SADECE biri verilir. İki ayrı, neredeyse birebir aynı dosya oluşturmak yerine
// tek bir yerde tutmak, gelecekte yapılacak değişikliklerin (ör. tasarım güncellemesi) iki
// dosyada da tekrarlanması gerekmesin diye.
export default function SendToFriendModal({ movie, list, onClose, onSent }) {
  const { c } = useAppTheme();
  const { auth } = useAuth();
  const insets = useSafeAreaInsets();
  const [friends, setFriends] = useState([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState(null);
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const styles = makeStyles(c);

  useEffect(() => {
    api.friends(auth.token)
      .then((data) => setFriends(data.friends || []))
      .catch(() => setFriends([]))
      .finally(() => setLoading(false));
  }, []);

  const filtered = useMemo(() => {
    if (!query.trim()) return friends;
    const q = query.trim().toLowerCase();
    return friends.filter((f) => f.name?.toLowerCase().includes(q) || f.username?.toLowerCase().includes(q));
  }, [friends, query]);

  const selectedFriend = friends.find((f) => f.id === selectedId);

  async function handleSend() {
    if (!selectedFriend || sending || sent) return;
    setSending(true);
    try {
      const { chat_id } = await api.chatWith(auth.token, selectedFriend.id);
      const body = list
        ? encodeListShare({ id: list.id, name: list.name, count: list.count, previewPoster: list.previewPoster, ownerName: auth.name })
        : encodeMovieShare(movie);
      await api.sendMessage(auth.token, chat_id, body);
      setSent(true);
      onSent?.(selectedFriend);
      setTimeout(onClose, 700); // kısa bir onay animasyonu görünsün, sonra kapansın
    } catch {
      setSending(false); // başarısız olursa tekrar denenebilsin
    }
  }

  // WhatsApp, mesajlar, Instagram vb. — SADECE film paylaşımında var, listeler için (henüz bir
  // web sayfası olmadığı, gizlilik ayarına bağlı olduğu için) sadece uygulama içi paylaşım var.
  async function handleExternalShare() {
    const movieLink = `https://www.pellix.app/film/${movie.id}`;
    const storeLink = getStoreLink();
    const downloadLine = storeLink
      ? `Sen de pellix'i indir (${storeLink}), kayıt olurken "${auth.username}" davet kodunu kullan.`
      : `Sen de pellix'i indir, kayıt olurken "${auth.username}" davet kodunu kullan.`;
    const message = `${auth.name} pellix'te "${movie.title}"yi önerdi 🎬\n\n${downloadLine}`;
    try {
      await Share.share({ message, url: movieLink });
    } catch { /* kullanıcı paylaşımı iptal etmiş olabilir, sorun değil */ }
  }

  return (
    <Modal visible animationType="slide" transparent onRequestClose={onClose}>
      <TouchableWithoutFeedback onPress={onClose}>
        <View style={styles.overlay}>
          <TouchableWithoutFeedback onPress={() => {}}>
            <DismissableSheet onClose={onClose} style={[styles.sheet, { paddingBottom: 20 + insets.bottom }]} handleOnly>
          <View style={styles.header}>
            <Text style={styles.headerTitle}>Arkadaşına Gönder</Text>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}><X size={18} color={c.text} /></TouchableOpacity>
          </View>

          <View style={styles.moviePreview}>
            {list ? (
              <>
                {list.previewPoster
                  ? <Image source={{ uri: list.previewPoster }} style={styles.moviePoster} />
                  : <View style={[styles.moviePoster, { backgroundColor: c.surface2, alignItems: "center", justifyContent: "center" }]}><ListVideo size={18} color={c.dim} /></View>}
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={styles.movieTitle} numberOfLines={1}>{list.name}</Text>
                  <Text style={styles.movieMeta}>{list.count} içerik</Text>
                </View>
              </>
            ) : (
              <>
                {movie.poster ? <Image source={{ uri: movie.poster }} style={styles.moviePoster} /> : <View style={[styles.moviePoster, { backgroundColor: c.surface2 }]} />}
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={styles.movieTitle} numberOfLines={1}>{movie.title}</Text>
                  <Text style={styles.movieMeta}>{movie.year} · {movie.type}</Text>
                </View>
              </>
            )}
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
              <Text style={styles.emptySubtitle}>Üstteki arkadaş ekleme butonuyla birini bulup ekleyebilirsin.</Text>
            </View>
          ) : (
            <>
              {/* GroupPartyScreen'in arkadaş seçme ızgarasıyla AYNI dil — satır satır dümdüz bir
                  liste yerine, her satırda 3 kişi, üstte avatar, altta isim; seçim de ayrı bir
                  radyo yerine avatarın üstüne binen halka + onay rozetiyle gösteriliyor. */}
              <FlatList
                data={filtered}
                keyExtractor={(item) => String(item.id)}
                numColumns={3}
                columnWrapperStyle={{ gap: 10 }}
                contentContainerStyle={{ gap: 12, paddingBottom: 10 }}
                keyboardShouldPersistTaps="handled"
                renderItem={({ item }) => {
                  const isSelected = selectedId === item.id;
                  return (
                    <TouchableOpacity
                      style={styles.friendCell}
                      onPress={() => setSelectedId(item.id)}
                      activeOpacity={0.7}
                    >
                      <View>
                        <RetryImage
                          source={{ uri: avatarOr(item.avatar_url, item.id) }}
                          style={[styles.gridAvatar, isSelected && styles.gridAvatarSelected]}
                        />
                        {isSelected && (
                          <View style={styles.gridCheckBadge}>
                            <Check size={11} color={c.bg} strokeWidth={3} />
                          </View>
                        )}
                      </View>
                      <Text style={styles.gridName} numberOfLines={1}>{item.name}</Text>
                    </TouchableOpacity>
                  );
                }}
                ListEmptyComponent={<Text style={styles.empty}>Aramanla eşleşen arkadaş bulunamadı.</Text>}
              />

              {/* Seçim yapılınca çıkan gönder butonu — arkadaşı seçmek göndermez, önce
                  seç, sonra bu butona basınca gönderilir. */}
              {!!selectedId && (
                <TouchableOpacity
                  style={[styles.sendBtn, sent && { backgroundColor: c.accent2 }]}
                  onPress={handleSend}
                  disabled={sending || sent}
                >
                  {sending ? (
                    <ActivityIndicator size="small" color={c.bg} />
                  ) : sent ? (
                    <>
                      <Check size={16} color={c.bg} strokeWidth={3} />
                      <Text style={styles.sendBtnText}>Gönderildi</Text>
                    </>
                  ) : (
                    <>
                      <Send size={15} color={c.bg} />
                      <Text style={styles.sendBtnText}>{selectedFriend?.name} 'e Gönder</Text>
                    </>
                  )}
                </TouchableOpacity>
              )}
            </>
          )}

          {/* Dış paylaşım (WhatsApp vb.) sadece FİLM paylaşımında var — listeler gizlilik
              ayarına bağlı olduğu ve henüz bir web sayfası olmadığı için sadece uygulama içi. */}
          {!list && (
            <>
              <View style={styles.divider}>
                <View style={styles.dividerLine} />
                <Text style={styles.dividerText}>ya da</Text>
                <View style={styles.dividerLine} />
              </View>
              <TouchableOpacity style={styles.externalShareBtn} onPress={handleExternalShare}>
                <Share2 size={15} color={c.text} />
                <Text style={styles.externalShareBtnText}>Diğer Uygulamalarla Paylaş (WhatsApp vb.)</Text>
              </TouchableOpacity>
            </>
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
    headerTitle: { fontSize: 16, fontWeight: "800", color: c.text },
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
    gridAvatarSelected: { borderColor: c.accent },
    gridCheckBadge: {
      position: "absolute", bottom: -2, right: 2, width: 18, height: 18, borderRadius: 999,
      backgroundColor: c.accent, alignItems: "center", justifyContent: "center", borderWidth: 2, borderColor: c.surface,
    },
    gridName: { fontSize: 11, fontWeight: "700", color: c.text, marginTop: 6, textAlign: "center" },
    empty: { color: c.dim, fontSize: 12, textAlign: "center", paddingVertical: 14 },
    emptyBox: { alignItems: "center", paddingVertical: 20 },
    emptySubtitle: { color: c.dim, fontSize: 11, textAlign: "center", marginTop: 4, lineHeight: 16, paddingHorizontal: 20 },
    sendBtn: {
      flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8,
      backgroundColor: c.accent, borderRadius: 14, paddingVertical: 14, marginTop: 8,
    },
    sendBtnText: { color: c.bg, fontWeight: "800", fontSize: 13 },
    divider: { flexDirection: "row", alignItems: "center", gap: 10, marginTop: 14, marginBottom: 10 },
    dividerLine: { flex: 1, height: 1, backgroundColor: c.border },
    dividerText: { fontSize: 11, color: c.dim, fontWeight: "600" },
    externalShareBtn: {
      flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8,
      backgroundColor: c.surface2, borderRadius: 14, paddingVertical: 13, borderWidth: 1, borderColor: c.border,
    },
    externalShareBtnText: { color: c.text, fontWeight: "700", fontSize: 12.5 },
  });
}
