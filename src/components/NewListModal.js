import React, { useState, useEffect } from "react";
import { Modal, View, Text, TextInput, TouchableOpacity, StyleSheet, Image, ActivityIndicator, FlatList, KeyboardAvoidingView, Platform, TouchableWithoutFeedback } from "react-native";
import { X, Plus, Check } from "lucide-react-native";
import { useAppTheme } from "../context/ThemeContext";
import { useAuth } from "../context/AuthContext";
import { api } from "../api/client";
import DismissableSheet from "./DismissableSheet";
import CoverPicker from "./CoverPicker";

// Profil > Listelerim > "Yeni Liste Oluştur" için ayrı bir popup — isim girişinin yanında,
// kullanıcı listeyi oluştururken aynı anda hızlıca birkaç film de ekleyebilsin diye 12'lik bir
// film ızgarası gösteriyoruz (3 sütun × 4 satır). Film seçmek ZORUNLU değil, sadece isimle de
// devam edilebilir.
export default function NewListModal({ visible, onClose, onCreated }) {
  const { c } = useAppTheme();
  const { auth } = useAuth();
  const styles = makeStyles(c);

  const [name, setName] = useState("");
  const [movies, setMovies] = useState([]);
  const [loadingMovies, setLoadingMovies] = useState(true);
  const [selected, setSelected] = useState(new Set());
  const [creating, setCreating] = useState(false);
  const [coverEmoji, setCoverEmoji] = useState(null);
  const [coverColor, setCoverColor] = useState(null);

  useEffect(() => {
    if (!visible) { setName(""); setSelected(new Set()); setCoverEmoji(null); setCoverColor(null); return; }
    setLoadingMovies(true);
    api.movies(auth.token, "movie", 1)
      .then((data) => setMovies((data.results || []).slice(0, 12)))
      .catch(() => setMovies([]))
      .finally(() => setLoadingMovies(false));
  }, [visible]);

  function toggleMovie(id) {
    setSelected((prev) => {
      const n = new Set(prev);
      n.has(id) ? n.delete(id) : n.add(id);
      return n;
    });
  }

  async function handleCreate() {
    const trimmed = name.trim();
    if (!trimmed || creating) return;
    setCreating(true);
    try {
      const list = await api.createWatchlist(auth.token, trimmed, { coverEmoji, coverColor });
      const chosen = movies.filter((m) => selected.has(m.id));
      await Promise.all(chosen.map((m) => api.addToWatchlist(auth.token, list.id, m.id).catch(() => {})));
      onCreated?.({ ...list, count: chosen.length, previewPoster: chosen[0]?.poster || null, isPublic: false, coverEmoji, coverColor, isOwner: true });
      onClose();
    } catch {
      setCreating(false);
    }
  }

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <TouchableWithoutFeedback onPress={onClose}>
        <KeyboardAvoidingView style={styles.overlay} behavior={Platform.OS === "ios" ? "padding" : "height"}>
          <DismissableSheet onClose={onClose} style={styles.sheet} handleOnly>
            {/* ÖNEMLİ: Kaydırılabilir film ızgarasını (FlatList), "dışına tıklayınca kapat"
                sarmalayıcısının (TouchableWithoutFeedback) İÇİNE koymuyoruz — ikisi iç içe
                geçince birkaç kaydırmadan sonra kaydırma jesti kilitleniyordu. Sadece üst kısmı
                (başlık, isim girişi) sarmalıyoruz, liste ve buton doğrudan kart içinde duruyor.*/}
            <TouchableWithoutFeedback onPress={() => {}}>
              <View>
                <View style={styles.header}>
                  <Text style={styles.title}>Yeni Liste Oluştur</Text>
                  <TouchableOpacity onPress={onClose}><X size={20} color={c.text} /></TouchableOpacity>
                </View>

                <TextInput
                  style={styles.input}
                  placeholder="Liste adı"
                  placeholderTextColor={c.dim}
                  value={name}
                  onChangeText={setName}
                  autoFocus
                />

                <CoverPicker emoji={coverEmoji} color={coverColor} onChangeEmoji={setCoverEmoji} onChangeColor={setCoverColor} />

                <Text style={[styles.subLabel, { marginTop: 16 }]}>
                  Hızlıca film ekle <Text style={{ opacity: 0.6, fontWeight: "600" }}>(opsiyonel)</Text>
                </Text>
              </View>
            </TouchableWithoutFeedback>

            {loadingMovies ? (
              <ActivityIndicator color={c.accent} style={{ marginVertical: 24 }} />
            ) : (
              <FlatList
                data={movies}
                numColumns={3}
                keyExtractor={(item) => String(item.id)}
                columnWrapperStyle={{ gap: 8 }}
                contentContainerStyle={{ gap: 8 }}
                style={{ maxHeight: 340 }}
                keyboardShouldPersistTaps="handled"
                nestedScrollEnabled
                renderItem={({ item }) => {
                  const isSelected = selected.has(item.id);
                  return (
                    <View style={styles.posterWrap}>
                      {item.poster
                        ? <Image source={{ uri: item.poster }} style={styles.poster} />
                        : <View style={[styles.poster, { backgroundColor: c.surface2 }]} />}
                      <TouchableOpacity
                        style={[styles.addBtn, isSelected && { backgroundColor: c.accent }]}
                        onPress={() => toggleMovie(item.id)}
                      >
                        {isSelected ? <Check size={13} color={c.bg} strokeWidth={3} /> : <Plus size={13} color="#fff" />}
                      </TouchableOpacity>
                    </View>
                  );
                }}
              />
            )}

            <TouchableOpacity style={[styles.createBtn, !name.trim() && { opacity: 0.4 }]} onPress={handleCreate} disabled={!name.trim() || creating}>
              {creating ? <ActivityIndicator size="small" color={c.bg} /> : (
                <Text style={styles.createBtnText}>
                  {selected.size > 0 ? `Oluştur (${selected.size} film ile)` : "Oluştur"}
                </Text>
              )}
            </TouchableOpacity>
          </DismissableSheet>
        </KeyboardAvoidingView>
      </TouchableWithoutFeedback>
    </Modal>
  );
}

function makeStyles(c) {
  return StyleSheet.create({
    overlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "flex-end" },
    sheet: { backgroundColor: c.surface, borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, maxHeight: "88%" },
    header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 14 },
    title: { fontSize: 16, fontWeight: "800", color: c.text },
    input: {
      backgroundColor: c.surface2, borderWidth: 1, borderColor: c.border, borderRadius: 12,
      paddingHorizontal: 14, paddingVertical: 12, color: c.text, fontSize: 14, marginBottom: 18,
    },
    subLabel: { fontSize: 11.5, fontWeight: "800", color: c.dim, letterSpacing: 0.3, marginBottom: 10 },
    posterWrap: { flex: 1, position: "relative" },
    poster: { width: "100%", aspectRatio: 2 / 3, borderRadius: 8 },
    addBtn: {
      position: "absolute", top: 5, right: 5, width: 22, height: 22, borderRadius: 999,
      backgroundColor: "rgba(0,0,0,0.55)", alignItems: "center", justifyContent: "center",
    },
    createBtn: { backgroundColor: c.accent, borderRadius: 12, paddingVertical: 14, alignItems: "center", marginTop: 16 },
    createBtnText: { color: c.bg, fontWeight: "800", fontSize: 13.5 },
  });
}
