import React, { useState, useEffect } from "react";
import { Modal, View, Text, TextInput, TouchableOpacity, StyleSheet, FlatList, Image, ActivityIndicator, KeyboardAvoidingView, Platform, TouchableWithoutFeedback } from "react-native";
import { X, Send } from "lucide-react-native";
import { useAppTheme } from "../context/ThemeContext";
import DismissableSheet from "./DismissableSheet";
import { useAuth } from "../context/AuthContext";
import { api } from "../api/client";
import { avatarOr } from "../utils/avatar";
import RetryImage from "./RetryImage";

// DetailScreen'deki yorum mantığının aynısı — ama tek bir filme özel, ekrandan ayrılmadan
// alttan açılan bir popup olarak. Ana Sayfa'daki Instagram tarzı kartlardan açılıyor.
export default function CommentsModal({ movie, onClose, onCommentAdded }) {
  const { c } = useAppTheme();
  const { auth } = useAuth();
  const styles = makeStyles(c);

  const [comments, setComments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [comment, setComment] = useState("");

  useEffect(() => {
    api.comments(auth.token, movie.id).then((data) => setComments(data.results || [])).catch(() => {}).finally(() => setLoading(false));
  }, []);

  async function addComment() {
    const text = comment.trim();
    if (!text) return;
    setComment("");
    const tempId = `temp-${Date.now()}`;
    setComments((cs) => [...cs, { id: tempId, name: auth.name, avatar_url: null, body: text, created_at: new Date().toISOString() }]);
    try {
      await api.addComment(auth.token, movie.id, text);
      const fresh = await api.comments(auth.token, movie.id);
      setComments(fresh.results || []);
      onCommentAdded?.(fresh.results?.length || 0);
    } catch {
      setComments((cs) => cs.filter((c) => c.id !== tempId));
    }
  }

  return (
    <Modal visible animationType="slide" transparent onRequestClose={onClose}>
      <TouchableWithoutFeedback onPress={onClose}>
        <KeyboardAvoidingView style={styles.overlay} behavior={Platform.OS === "ios" ? "padding" : "height"}>
          <TouchableWithoutFeedback onPress={() => {}}>
            <DismissableSheet onClose={onClose} style={styles.sheet} handleOnly>
          <View style={styles.header}>
            <Text style={styles.title} numberOfLines={1}>{movie.title} — Yorumlar</Text>
            <TouchableOpacity onPress={onClose}><X size={20} color={c.text} /></TouchableOpacity>
          </View>

          {loading ? (
            <ActivityIndicator color={c.accent} style={{ marginVertical: 20 }} />
          ) : (
            <FlatList
              data={comments}
              keyExtractor={(item) => String(item.id)}
              contentContainerStyle={{ paddingVertical: 8 }}
              keyboardShouldPersistTaps="handled"
              renderItem={({ item }) => (
                <View style={styles.commentRow}>
                  <RetryImage source={{ uri: avatarOr(item.avatar_url, item.user_id || item.id) }} style={styles.commentAvatar} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.commentUser}>{item.name}</Text>
                    <Text style={styles.commentText}>{item.body}</Text>
                  </View>
                </View>
              )}
              ListEmptyComponent={<Text style={styles.empty}>Henüz yorum yok, ilk yorumu sen yaz.</Text>}
            />
          )}

          <View style={styles.inputRow}>
            <TextInput
              style={styles.input}
              placeholder="Yorum ekle"
              placeholderTextColor={c.dim}
              value={comment}
              onChangeText={setComment}
              onSubmitEditing={addComment}
            />
            <TouchableOpacity style={styles.sendBtn} onPress={addComment}>
              <Send size={15} color={c.bg} />
            </TouchableOpacity>
          </View>
        </DismissableSheet>
          </TouchableWithoutFeedback>
        </KeyboardAvoidingView>
      </TouchableWithoutFeedback>
    </Modal>
  );
}

function makeStyles(c) {
  return StyleSheet.create({
    overlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "flex-end" },
    sheet: { backgroundColor: c.surface, borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 18, maxHeight: "75%" },
    handle: { width: 36, height: 4, borderRadius: 999, backgroundColor: c.border, alignSelf: "center", marginBottom: 12 },
    header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 8 },
    title: { fontSize: 14, fontWeight: "800", color: c.text, flex: 1, marginRight: 10 },
    commentRow: { flexDirection: "row", gap: 10, paddingVertical: 8 },
    commentAvatar: { width: 30, height: 30, borderRadius: 999, backgroundColor: c.surface2 },
    commentUser: { fontSize: 12, fontWeight: "700", color: c.text },
    commentText: { fontSize: 12, color: c.dim, marginTop: 1, lineHeight: 17 },
    empty: { color: c.dim, fontSize: 12, textAlign: "center", paddingVertical: 20 },
    inputRow: { flexDirection: "row", gap: 8, marginTop: 10, paddingTop: 10, borderTopWidth: 1, borderTopColor: c.border },
    input: {
      flex: 1, backgroundColor: c.surface2, borderWidth: 1, borderColor: c.border, borderRadius: 999,
      paddingHorizontal: 14, paddingVertical: 10, color: c.text, fontSize: 13,
    },
    sendBtn: { width: 38, height: 38, borderRadius: 999, backgroundColor: c.accent, alignItems: "center", justifyContent: "center" },
  });
}
