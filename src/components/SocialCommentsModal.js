import React, { useEffect, useState } from "react";
import { ActivityIndicator, Alert, FlatList, KeyboardAvoidingView, Modal, Platform, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import { Flag, Send, Trash2, X } from "lucide-react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAppTheme } from "../context/ThemeContext";
import { useAuth } from "../context/AuthContext";
import { api } from "../api/client";
import { avatarOr } from "../utils/avatar";
import RetryImage from "./RetryImage";
import { reportSocialContent } from "../utils/socialReporting";

export default function SocialCommentsModal({ visible, postId, activityId, canModerate = false, originalNote = null, navigation, onClose, onChanged }) {
  const { c } = useAppTheme();
  const { auth } = useAuth();
  const insets = useSafeAreaInsets();
  const styles = makeStyles(c, insets.bottom);
  const [comments, setComments] = useState([]);
  const [loading, setLoading] = useState(false);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);

  // Yorumdaki profil fotoğrafına dokununca modalı kapatıp o kişinin (kendisiyse kendi) profiline
  // götürüyor — arka planda açık kalan bir modalın üstüne yeni bir ekran binmesin diye önce onClose.
  function openProfile(userId) {
    if (!navigation || !userId) return;
    onClose?.();
    if (Number(userId) === Number(auth.id)) navigation.navigate("MainTabs", { screen: "Profile" });
    else navigation.navigate("OtherProfile", { userId });
  }
  const [deletingId, setDeletingId] = useState(null);

  useEffect(() => {
    const targetId = activityId || postId;
    if (!visible || !targetId) return;
    setLoading(true);
    const request = activityId
      ? api.socialActivityComments(auth.token, activityId)
      : api.socialComments(auth.token, postId);
    request
      .then((data) => setComments(data.results || []))
      .catch(() => setComments([]))
      .finally(() => setLoading(false));
  }, [visible, postId, activityId, auth.token]);

  async function send() {
    const body = text.trim();
    if (!body || sending) return;
    setSending(true);
    setText("");
    try {
      const data = activityId
        ? await api.socialAddActivityComment(auth.token, activityId, body)
        : await api.socialAddComment(auth.token, postId, body);
      if (data.comment) setComments((prev) => [...prev, data.comment]);
      onChanged?.({ type: "comment_added" });
    } catch {
      setText(body);
    }
    setSending(false);
  }

  function requestDelete(comment) {
    const allowed = canModerate || Number(comment.user_id) === Number(auth.id);
    if (!allowed || deletingId) return;
    Alert.alert(
      "Yorum silinsin mi?",
      canModerate && Number(comment.user_id) !== Number(auth.id)
        ? "Bu yorum senin paylaşımından kalıcı olarak kaldırılacak."
        : "Yorumun kalıcı olarak silinecek.",
      [
        { text: "Vazgeç", style: "cancel" },
        {
          text: "Sil",
          style: "destructive",
          onPress: async () => {
            setDeletingId(comment.id);
            try {
              if (activityId) await api.socialDeleteActivityComment(auth.token, activityId, comment.id);
              else await api.socialDeleteComment(auth.token, postId, comment.id);
              setComments((prev) => prev.filter((item) => Number(item.id) !== Number(comment.id)));
              onChanged?.({ type: "comment_deleted" });
            } catch (error) {
              Alert.alert("Silinemedi", error?.message || "Yorum silinirken bir sorun oluştu.");
            } finally {
              setDeletingId(null);
            }
          },
        },
      ]
    );
  }

  function requestReport(comment) {
    const targetType = activityId ? "activity_comment" : "post_comment";
    const reasons = ["Uygunsuz/müstehcen içerik", "Taciz veya nefret söylemi", "Spam", "Diğer"];
    Alert.alert("Yorumu şikâyet et", "Nedeni seç", [
      ...reasons.map((reason) => ({
        text: reason,
        onPress: async () => {
          try {
            await reportSocialContent(auth.token, targetType, comment.id, reason);
            Alert.alert("Teşekkürler", "Şikâyetin incelenmek üzere alındı.");
          } catch (error) {
            Alert.alert("Gönderilemedi", error?.message || "Şikâyet gönderilemedi.");
          }
        },
      })),
      { text: "Vazgeç", style: "cancel" },
    ]);
  }

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView
        style={styles.backdrop}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        keyboardVerticalOffset={0}
      >
        <TouchableOpacity style={{ flex: 1 }} activeOpacity={1} onPress={onClose} />
        <View style={styles.sheet}>
          <View style={styles.header}>
            <Text style={styles.title}>Yorumlar</Text>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}><X size={18} color={c.text} /></TouchableOpacity>
          </View>
          {loading ? (
            <View style={styles.center}><ActivityIndicator color={c.accent} /></View>
          ) : (
            <FlatList
              data={comments}
              keyExtractor={(item) => String(item.id)}
              contentContainerStyle={comments.length || originalNote ? styles.list : styles.emptyList}
              keyboardShouldPersistTaps="handled"
              keyboardDismissMode={Platform.OS === "ios" ? "interactive" : "on-drag"}
              ListHeaderComponent={
                originalNote ? (
                  // Instagram'daki "caption ilk yorum gibi sabitlenir" deseni — kartta 2 satırla
                  // kırpılan öneri notunun TAM halini burada, yorumların en üstünde sabit gösteriyoruz.
                  // Bu bir yorum DEĞİL (silinemez/şikayet edilemez, sayaca dahil değil), sadece
                  // paylaşımın kendi metni.
                  <View style={styles.originalNoteRow}>
                    <TouchableOpacity onPress={() => openProfile(originalNote.authorId)}>
                      <RetryImage source={{ uri: avatarOr(originalNote.authorAvatar, originalNote.authorId) }} style={styles.avatar} />
                    </TouchableOpacity>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.name}>{originalNote.authorName}</Text>
                      <Text style={styles.body}>{originalNote.text}</Text>
                    </View>
                  </View>
                ) : null
              }
              renderItem={({ item }) => (
                <View style={styles.commentRow}>
                  <TouchableOpacity onPress={() => openProfile(item.user_id)}>
                    <RetryImage source={{ uri: avatarOr(item.avatar_url, item.user_id) }} style={styles.avatar} />
                  </TouchableOpacity>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.name}>{item.name}</Text>
                    <Text style={styles.body}>{item.body}</Text>
                  </View>
                  {(canModerate || Number(item.user_id) === Number(auth.id)) && (
                    <TouchableOpacity
                      style={styles.deleteBtn}
                      onPress={() => requestDelete(item)}
                      disabled={deletingId === item.id}
                      accessibilityRole="button"
                      accessibilityLabel="Yorumu sil"
                    >
                      {deletingId === item.id
                        ? <ActivityIndicator size="small" color={c.dim} />
                        : <Trash2 size={14} color={c.dim} />}
                    </TouchableOpacity>
                  )}
                  {!canModerate && Number(item.user_id) !== Number(auth.id) && (
                    <TouchableOpacity
                      style={styles.deleteBtn}
                      onPress={() => requestReport(item)}
                      accessibilityRole="button"
                      accessibilityLabel="Yorumu şikâyet et"
                    >
                      <Flag size={14} color={c.dim} />
                    </TouchableOpacity>
                  )}
                </View>
              )}
              ListEmptyComponent={<Text style={styles.empty}>Henüz yorum yok. İlk yorumu sen bırak.</Text>}
            />
          )}
          <View style={styles.inputRow}>
            <TextInput
              style={styles.input}
              placeholder="Yorum yaz..."
              placeholderTextColor={c.dim}
              value={text}
              onChangeText={setText}
              maxLength={500}
              returnKeyType="send"
              onSubmitEditing={send}
            />
            <TouchableOpacity style={[styles.sendBtn, (!text.trim() || sending) && { opacity: 0.45 }]} onPress={send} disabled={!text.trim() || sending}>
              {sending ? <ActivityIndicator size="small" color={c.bg} /> : <Send size={15} color={c.bg} />}
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

function makeStyles(c, bottomInset = 0) {
  return StyleSheet.create({
    backdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.45)", justifyContent: "flex-end" },
    sheet: { maxHeight: "72%", minHeight: 360, backgroundColor: c.bg, borderTopLeftRadius: 24, borderTopRightRadius: 24, borderWidth: 1, borderColor: c.border, overflow: "hidden" },
    header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 18, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: c.border },
    title: { color: c.text, fontWeight: "800", fontSize: 16 },
    closeBtn: { width: 32, height: 32, borderRadius: 999, backgroundColor: c.surface2, alignItems: "center", justifyContent: "center" },
    center: { flex: 1, alignItems: "center", justifyContent: "center", minHeight: 220 },
    list: { padding: 16, gap: 14 },
    emptyList: { flexGrow: 1, alignItems: "center", justifyContent: "center", padding: 24 },
    commentRow: { flexDirection: "row", alignItems: "flex-start", gap: 10 },
    originalNoteRow: { flexDirection: "row", alignItems: "flex-start", gap: 10, paddingBottom: 14, marginBottom: 14, borderBottomWidth: 1, borderBottomColor: c.border },
    deleteBtn: { width: 30, height: 30, borderRadius: 999, alignItems: "center", justifyContent: "center", backgroundColor: c.surface2 },
    avatar: { width: 34, height: 34, borderRadius: 999, backgroundColor: c.surface2 },
    name: { color: c.text, fontWeight: "800", fontSize: 12 },
    body: { color: c.text, fontSize: 13, lineHeight: 18, marginTop: 2 },
    empty: { color: c.dim, fontSize: 12, textAlign: "center" },
    inputRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      paddingHorizontal: 14,
      paddingTop: 10,
      paddingBottom: Math.max(bottomInset, Platform.OS === "ios" ? 20 : 14),
      borderTopWidth: 1,
      borderTopColor: c.border,
    },
    input: { flex: 1, minHeight: 40, backgroundColor: c.surface2, borderWidth: 1, borderColor: c.border, borderRadius: 999, paddingHorizontal: 14, color: c.text, fontSize: 13 },
    sendBtn: { width: 40, height: 40, borderRadius: 999, backgroundColor: c.accent, alignItems: "center", justifyContent: "center" },
  });
}
