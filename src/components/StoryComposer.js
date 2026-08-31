import React, { useEffect, useRef, useState } from "react";
import { ActivityIndicator, FlatList, Image, KeyboardAvoidingView, Modal, Platform, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import { Check, Search, Send, X } from "lucide-react-native";
import { useAppTheme } from "../context/ThemeContext";
import { useAuth } from "../context/AuthContext";
import { api } from "../api/client";

// SocialPostComposer'daki arama/eşleştirme mantığının küçültülmüş hali — burada tek bir
// içerik seçiliyor, anket/öner modları yok. Story'ler ayrı bir tabloda (stories), post değil.
export default function StoryComposer({ visible, onClose, onCreated }) {
  const { c } = useAppTheme();
  const { auth } = useAuth();
  const styles = makeStyles(c);
  const [movie, setMovie] = useState(null);
  const [note, setNote] = useState("");
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const searchInputRef = useRef(null);

  useEffect(() => {
    if (!visible) return;
    setMovie(null);
    setNote("");
    setQuery("");
    setResults([]);
    setError("");
  }, [visible]);

  useEffect(() => {
    if (!visible || movie || query.trim().length < 2) {
      setResults([]);
      setSearching(false);
      return;
    }
    let cancelled = false;
    const timer = setTimeout(async () => {
      setSearching(true);
      try {
        const [movies, shows] = await Promise.all([
          api.search(auth.token, query.trim(), "movie"),
          api.search(auth.token, query.trim(), "tv"),
        ]);
        if (cancelled) return;
        const byId = new Map();
        [...(movies.results || []), ...(shows.results || [])].forEach((item) => {
          if (item?.id) byId.set(item.id, item);
        });
        setResults([...byId.values()].slice(0, 12));
      } catch {
        if (!cancelled) setResults([]);
      }
      if (!cancelled) setSearching(false);
    }, 300);
    return () => { cancelled = true; clearTimeout(timer); };
  }, [visible, movie, query, auth.token]);

  async function submit() {
    if (!movie || sending) return;
    setSending(true);
    setError("");
    try {
      await api.socialCreateStory(auth.token, { movieId: movie.id, note: note.trim() });
      onCreated?.();
      onClose?.();
    } catch (e) {
      setError(e.message || "Story paylaşılamadı.");
    }
    setSending(false);
  }

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <KeyboardAvoidingView style={styles.backdrop} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <TouchableOpacity style={StyleSheet.absoluteFillObject} activeOpacity={1} onPress={onClose} />
        <View style={styles.sheet}>
          <View style={styles.header}>
            <View>
              <Text style={styles.title}>Story paylaş</Text>
              <Text style={styles.subtitle}>Şu an ne izliyorsun? 24 saat sonra kaybolur.</Text>
            </View>
            <TouchableOpacity style={styles.closeBtn} onPress={onClose}><X size={18} color={c.text} /></TouchableOpacity>
          </View>

          {movie ? (
            <TouchableOpacity style={styles.selectedCard} onPress={() => { setMovie(null); requestAnimationFrame(() => searchInputRef.current?.focus()); }}>
              {movie.poster ? <Image source={{ uri: movie.poster }} style={styles.selectedPoster} /> : <View style={[styles.selectedPoster, { backgroundColor: c.surface2 }]} />}
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={styles.selectedTitle} numberOfLines={2}>{movie.title}</Text>
                <Text style={styles.selectedMeta}>{movie.type || "İçerik"} {movie.year ? `· ${movie.year}` : ""}</Text>
              </View>
              <Check size={16} color={c.accent} />
            </TouchableOpacity>
          ) : (
            <View style={styles.searchArea}>
              <View style={styles.searchWrap}>
                <Search size={15} color={c.dim} />
                <TextInput
                  ref={searchInputRef}
                  style={styles.searchInput}
                  placeholder="Film veya dizi ara…"
                  placeholderTextColor={c.dim}
                  value={query}
                  onChangeText={setQuery}
                  autoCorrect={false}
                  autoFocus
                />
                {searching && <ActivityIndicator size="small" color={c.accent} />}
              </View>
              {results.length > 0 && (
                <FlatList
                  data={results}
                  keyExtractor={(item) => String(item.id)}
                  style={styles.results}
                  keyboardShouldPersistTaps="always"
                  nestedScrollEnabled
                  renderItem={({ item }) => (
                    <TouchableOpacity style={styles.resultRow} onPress={() => { setMovie(item); setQuery(""); setResults([]); }}>
                      {item.poster ? <Image source={{ uri: item.poster }} style={styles.resultPoster} /> : <View style={[styles.resultPoster, { backgroundColor: c.surface2 }]} />}
                      <View style={{ flex: 1 }}>
                        <Text style={styles.resultTitle} numberOfLines={1}>{item.title}</Text>
                        <Text style={styles.resultMeta}>{item.type || "İçerik"} {item.year ? `· ${item.year}` : ""}</Text>
                      </View>
                    </TouchableOpacity>
                  )}
                />
              )}
            </View>
          )}

          <TextInput
            style={styles.noteInput}
            placeholder="Kısa bir not ekle (isteğe bağlı)…"
            placeholderTextColor={c.dim}
            value={note}
            onChangeText={setNote}
            maxLength={140}
          />

          {!!error && <Text style={styles.error}>{error}</Text>}

          <TouchableOpacity style={[styles.submit, (!movie || sending) && { opacity: 0.45 }]} onPress={submit} disabled={!movie || sending}>
            {sending ? <ActivityIndicator size="small" color={c.bg} /> : <Send size={15} color={c.bg} />}
            <Text style={styles.submitText}>Story olarak paylaş</Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

function makeStyles(c) {
  return StyleSheet.create({
    backdrop: { flex: 1, justifyContent: "center", alignItems: "center", padding: 16, backgroundColor: "rgba(0,0,0,0.7)" },
    sheet: { width: "100%", maxWidth: 420, backgroundColor: c.bg, borderRadius: 24, padding: 16, borderWidth: 1, borderColor: c.border, shadowColor: "#000", shadowOpacity: 0.42, shadowRadius: 24, shadowOffset: { width: 0, height: 12 }, elevation: 16 },
    header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 14 },
    title: { color: c.text, fontWeight: "900", fontSize: 18 },
    subtitle: { color: c.dim, fontSize: 11, marginTop: 2 },
    closeBtn: { width: 34, height: 34, borderRadius: 999, backgroundColor: c.surface2, alignItems: "center", justifyContent: "center" },
    searchArea: { position: "relative", zIndex: 40, elevation: 40, marginBottom: 10 },
    searchWrap: { flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: c.surface2, borderWidth: 1, borderColor: c.border, borderRadius: 13, paddingHorizontal: 11, minHeight: 42 },
    searchInput: { flex: 1, color: c.text, fontSize: 12.5 },
    results: { position: "absolute", top: 48, left: 0, right: 0, maxHeight: 260, borderWidth: 1, borderColor: c.border, borderRadius: 13, backgroundColor: c.surface, zIndex: 50, elevation: 50, shadowColor: "#000", shadowOpacity: 0.34, shadowRadius: 14, shadowOffset: { width: 0, height: 8 } },
    resultRow: { flexDirection: "row", alignItems: "center", gap: 9, padding: 8, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: c.border },
    resultPoster: { width: 36, height: 53, borderRadius: 6 },
    resultTitle: { color: c.text, fontWeight: "800", fontSize: 12 },
    resultMeta: { color: c.dim, fontSize: 10, marginTop: 2 },
    selectedCard: { minHeight: 72, flexDirection: "row", alignItems: "center", gap: 8, borderWidth: 1, borderColor: c.border, borderRadius: 13, backgroundColor: c.surface2, padding: 7, marginBottom: 10 },
    selectedPoster: { width: 38, height: 56, borderRadius: 6 },
    selectedTitle: { color: c.text, fontSize: 12.5, fontWeight: "800" },
    selectedMeta: { color: c.dim, fontSize: 10, marginTop: 2 },
    noteInput: { minHeight: 42, color: c.text, backgroundColor: c.surface, borderWidth: 1, borderColor: c.border, borderRadius: 13, paddingHorizontal: 12, fontSize: 12.5, marginBottom: 12 },
    error: { color: c.danger, fontSize: 11, marginBottom: 8 },
    submit: { minHeight: 44, borderRadius: 13, backgroundColor: c.accent, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 7 },
    submitText: { color: c.bg, fontWeight: "900", fontSize: 13 },
  });
}
