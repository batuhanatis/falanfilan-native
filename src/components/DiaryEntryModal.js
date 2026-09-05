import React, { useEffect, useState } from "react";
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  TextInput,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { Check, Trash2, X, Star, CalendarDays } from "lucide-react-native";
import { useAppTheme } from "../context/ThemeContext";
import { useAuth } from "../context/AuthContext";
import { diaryApi } from "../api/diary";
import { hapticSuccess } from "../utils/haptics";

export default function DiaryEntryModal({ visible, movie, entry, onClose, onSaved, onRemoved }) {
  const { c } = useAppTheme();
  const { auth } = useAuth();
  const styles = makeStyles(c);
  const [rating, setRating] = useState(null);
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [removing, setRemoving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!visible) return;
    setRating(entry?.rating ?? null);
    setNote(entry?.note || "");
    setError("");
  }, [visible, entry?.rating, entry?.note, movie?.id]);

  async function save() {
    if (!movie?.id || saving) return;
    setSaving(true);
    setError("");
    try {
      const result = await diaryApi.save(auth.token, movie.id, {
        watchedAt: entry?.watchedAt || new Date().toISOString(),
        rating,
        note: note.trim() || null,
      });
      hapticSuccess();
      onSaved?.(result.entry);
      onClose?.();
    } catch (e) {
      setError(e.message || "Kaydedilemedi.");
    }
    setSaving(false);
  }

  async function remove() {
    if (!movie?.id || removing) return;
    setRemoving(true);
    setError("");
    try {
      await diaryApi.remove(auth.token, movie.id);
      onRemoved?.();
      onClose?.();
    } catch (e) {
      setError(e.message || "Günlük kaydı silinemedi.");
    }
    setRemoving(false);
  }

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <KeyboardAvoidingView style={styles.backdrop} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <TouchableOpacity style={StyleSheet.absoluteFillObject} activeOpacity={1} onPress={onClose} />
        <View style={styles.card}>
          <View style={styles.header}>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={styles.eyebrow}>PELLIX DIARY</Text>
              <Text style={styles.title} numberOfLines={1}>{movie?.title || "İzlediğin içerik"}</Text>
              <View style={styles.dateRow}>
                <CalendarDays size={11} color={c.dim} />
                <Text style={styles.dateText}>
                  {entry?.watchedAt
                    ? new Date(entry.watchedAt).toLocaleDateString("tr-TR", { day: "numeric", month: "long", year: "numeric" })
                    : "Bugün izlendi olarak kaydedilecek"}
                </Text>
              </View>
            </View>
            <TouchableOpacity style={styles.closeBtn} onPress={onClose}>
              <X size={17} color={c.text} />
            </TouchableOpacity>
          </View>

          <Text style={styles.label}>PUANIN</Text>
          <Text style={styles.helper}>İstersen boş bırakabilirsin. Pellix puanın 10 üzerinden.</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.ratingRow}>
            {Array.from({ length: 10 }, (_, i) => i + 1).map((value) => (
              <TouchableOpacity
                key={value}
                style={[styles.ratingChip, rating === value && styles.ratingChipActive]}
                onPress={() => setRating((current) => current === value ? null : value)}
              >
                <Star size={11} color={rating === value ? "#14121a" : c.accent} fill={rating === value ? "#14121a" : "none"} />
                <Text style={[styles.ratingText, rating === value && styles.ratingTextActive]}>{value}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          <Text style={styles.label}>KISA NOT</Text>
          <TextInput
            style={styles.noteInput}
            value={note}
            onChangeText={(text) => setNote(text.slice(0, 500))}
            placeholder="Finali, oyunculukları, sende bıraktığı his…"
            placeholderTextColor={c.dim}
            multiline
            maxLength={500}
            textAlignVertical="top"
          />
          <Text style={styles.charCount}>{note.length}/500</Text>

          {!!error && <Text style={styles.error}>{error}</Text>}

          <TouchableOpacity style={styles.saveBtn} onPress={save} disabled={saving} activeOpacity={0.86}>
            {saving ? <ActivityIndicator size="small" color="#14121a" /> : <>
              <Check size={16} color="#14121a" strokeWidth={2.6} />
              <Text style={styles.saveText}>{entry ? "Günlüğü Güncelle" : "İzledim Olarak Kaydet"}</Text>
            </>}
          </TouchableOpacity>

          {!!entry && (
            <TouchableOpacity style={styles.removeBtn} onPress={remove} disabled={removing}>
              {removing ? <ActivityIndicator size="small" color={c.danger} /> : <>
                <Trash2 size={14} color={c.danger} />
                <Text style={styles.removeText}>İzledim kaydını kaldır</Text>
              </>}
            </TouchableOpacity>
          )}
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

function makeStyles(c) {
  return StyleSheet.create({
    backdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.72)", justifyContent: "center", padding: 18 },
    card: { backgroundColor: c.surface, borderWidth: 1, borderColor: c.border, borderRadius: 24, padding: 18, maxHeight: "88%" },
    header: { flexDirection: "row", alignItems: "flex-start", gap: 12 },
    eyebrow: { color: c.accent, fontSize: 9.5, fontWeight: "900", letterSpacing: 1 },
    title: { color: c.text, fontSize: 20, fontWeight: "900", marginTop: 3 },
    dateRow: { flexDirection: "row", alignItems: "center", gap: 5, marginTop: 5 },
    dateText: { color: c.dim, fontSize: 10.5 },
    closeBtn: { width: 34, height: 34, borderRadius: 999, backgroundColor: c.surface2, alignItems: "center", justifyContent: "center" },
    label: { color: c.text, fontSize: 10, fontWeight: "900", letterSpacing: 0.7, marginTop: 20 },
    helper: { color: c.dim, fontSize: 10.5, marginTop: 3 },
    ratingRow: { gap: 7, paddingTop: 10, paddingBottom: 3 },
    ratingChip: { minWidth: 44, height: 36, borderRadius: 12, borderWidth: 1, borderColor: c.border, backgroundColor: c.surface2, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 4, paddingHorizontal: 8 },
    ratingChipActive: { backgroundColor: c.accent, borderColor: c.accent },
    ratingText: { color: c.text, fontSize: 11.5, fontWeight: "800" },
    ratingTextActive: { color: "#14121a" },
    noteInput: { minHeight: 104, marginTop: 9, borderRadius: 14, borderWidth: 1, borderColor: c.border, backgroundColor: c.surface2, padding: 12, color: c.text, fontSize: 12.5, lineHeight: 18 },
    charCount: { color: c.dim, fontSize: 9.5, alignSelf: "flex-end", marginTop: 4 },
    error: { color: c.danger, fontSize: 11, marginTop: 8, textAlign: "center" },
    saveBtn: { minHeight: 46, marginTop: 14, borderRadius: 14, backgroundColor: c.accent, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 7 },
    saveText: { color: "#14121a", fontSize: 12.5, fontWeight: "900" },
    removeBtn: { marginTop: 10, minHeight: 38, borderRadius: 12, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6 },
    removeText: { color: c.danger, fontSize: 11.5, fontWeight: "700" },
  });
}
