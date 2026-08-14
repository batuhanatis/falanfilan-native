import React, { useEffect, useState } from "react";
import { ActivityIndicator, FlatList, KeyboardAvoidingView, Modal, Platform, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import { Send, X } from "lucide-react-native";
import { useAppTheme } from "../context/ThemeContext";
import { useAuth } from "../context/AuthContext";
import { api } from "../api/client";
import { avatarOr } from "../utils/avatar";
import RetryImage from "./RetryImage";

export default function SocialCommentsModal({ visible, postId, onClose, onChanged }) {
  const { c } = useAppTheme();
  const { auth } = useAuth();
  const styles = makeStyles(c);
  const [comments, setComments] = useState([]);
  const [loading, setLoading] = useState(false);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);

  useEffect(() => {
    if (!visible || !postId) return;
    setLoading(true);
    api.socialComments(auth.token, postId)
      .then((data) => setComments(data.results || []))
      .catch(() => setComments([]))
      .finally(() => setLoading(false));
  }, [visible, postId, auth.token]);

  async function send() {
    const body = text.trim();
    if (!body || sending) return;
    setSending(true);
    setText("");
    try {
      const data = await api.socialAddComment(auth.token, postId, body);
      if (data.comment) setComments((prev) => [...prev, data.comment]);
      onChanged?.();
    } catch {
      setText(body);
    }
    setSending(false);
  }

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView style={styles.backdrop} behavior={Platform.OS === "ios" ? "padding" : undefined}>
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
              contentContainerStyle={comments.length ? styles.list : styles.emptyList}
              renderItem={({ item }) => (
                <View style={styles.commentRow}>
                  <RetryImage source={{ uri: avatarOr(item.avatar_url, item.user_id) }} style={styles.avatar} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.name}>{item.name}</Text>
                    <Text style={styles.body}>{item.body}</Text>
                  </View>
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

function makeStyles(c) {
  return StyleSheet.create({
    backdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.45)", justifyContent: "flex-end" },
    sheet: { maxHeight: "72%", minHeight: 360, backgroundColor: c.bg, borderTopLeftRadius: 24, borderTopRightRadius: 24, borderWidth: 1, borderColor: c.border, overflow: "hidden" },
    header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 18, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: c.border },
    title: { color: c.text, fontWeight: "800", fontSize: 16 },
    closeBtn: { width: 32, height: 32, borderRadius: 999, backgroundColor: c.surface2, alignItems: "center", justifyContent: "center" },
    center: { flex: 1, alignItems: "center", justifyContent: "center", minHeight: 220 },
    list: { padding: 16, gap: 14 },
    emptyList: { flexGrow: 1, alignItems: "center", justifyContent: "center", padding: 24 },
    commentRow: { flexDirection: "row", gap: 10 },
    avatar: { width: 34, height: 34, borderRadius: 999, backgroundColor: c.surface2 },
    name: { color: c.text, fontWeight: "800", fontSize: 12 },
    body: { color: c.text, fontSize: 13, lineHeight: 18, marginTop: 2 },
    empty: { color: c.dim, fontSize: 12, textAlign: "center" },
    inputRow: { flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 14, paddingTop: 10, paddingBottom: Platform.OS === "ios" ? 28 : 14, borderTopWidth: 1, borderTopColor: c.border },
    input: { flex: 1, minHeight: 40, backgroundColor: c.surface2, borderWidth: 1, borderColor: c.border, borderRadius: 999, paddingHorizontal: 14, color: c.text, fontSize: 13 },
    sendBtn: { width: 40, height: 40, borderRadius: 999, backgroundColor: c.accent, alignItems: "center", justifyContent: "center" },
  });
}
