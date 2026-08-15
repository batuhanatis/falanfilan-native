import React, { useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, FlatList, Keyboard, KeyboardAvoidingView, Modal, Platform, StyleSheet, Text, TextInput, TouchableOpacity, View, Image } from "react-native";
import { Check, Search, Send, Sparkles, Swords, X } from "lucide-react-native";
import { useAppTheme } from "../context/ThemeContext";
import { useAuth } from "../context/AuthContext";
import { api } from "../api/client";

const MODES = [
  ["thought", "Bir şey söyle"],
  ["recommend", "Öner"],
  ["poll", "Anket"],
];

export default function SocialPostComposer({ visible, initialMovie = null, initialType = null, initialContext = null, presentation = "sheet", onClose, onCreated }) {
  const { c } = useAppTheme();
  const { auth } = useAuth();
  const styles = useMemo(() => makeStyles(c), [c]);
  const [mode, setMode] = useState(initialType || (initialMovie ? "recommend" : "thought"));
  const [body, setBody] = useState("");
  const [movie, setMovie] = useState(initialMovie);
  const [pollA, setPollA] = useState(initialType === "poll" ? initialMovie : null);
  const [pollB, setPollB] = useState(null);
  const [selecting, setSelecting] = useState(initialType === "poll" && initialMovie ? "b" : "a");
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const searchInputRef = useRef(null);
  const island = presentation === "island";

  useEffect(() => {
    if (!visible) return;
    const nextMode = initialType || (initialMovie ? "recommend" : "thought");
    setMode(nextMode);
    setBody("");
    setMovie(nextMode === "recommend" ? initialMovie : null);
    setPollA(nextMode === "poll" ? initialMovie : null);
    setPollB(null);
    setSelecting(nextMode === "poll" && initialMovie ? "b" : "a");
    setQuery("");
    setResults([]);
    setError("");
  }, [visible, initialMovie?.id, initialType, initialContext]);

  useEffect(() => {
    if (!visible || mode === "thought" || query.trim().length < 2) {
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
        const seen = new Set();
        const merged = [...(movies.results || []), ...(shows.results || [])].filter((item) => {
          if (!item?.id || seen.has(item.id)) return false;
          seen.add(item.id);
          return true;
        }).slice(0, 12);
        setResults(merged);
      } catch {
        if (!cancelled) setResults([]);
      }
      if (!cancelled) setSearching(false);
    }, 300);
    return () => { cancelled = true; clearTimeout(timer); };
  }, [visible, mode, query, auth.token]);

  function choose(item) {
    if (mode === "recommend") {
      setMovie(item);
      setQuery("");
      setResults([]);
      return;
    }
    if (selecting === "a") {
      if (Number(pollB?.id) === Number(item.id)) return;
      setPollA(item);
      setSelecting("b");
    } else {
      if (Number(pollA?.id) === Number(item.id)) return;
      setPollB(item);
    }
    setQuery("");
    setResults([]);
  }

  const canSend = mode === "thought" ? !!body.trim()
    : mode === "recommend" ? !!movie
    : !!pollA && !!pollB && Number(pollA.id) !== Number(pollB.id);

  async function submit() {
    if (!canSend || sending) return;
    setSending(true);
    setError("");
    try {
      const answer = body.trim();
      const outgoingBody = initialContext
        ? `🔥 Günün Sorusu: ${initialContext}${answer ? `\n\n${answer}` : ""}`
        : answer;
      await api.socialCreatePost(auth.token, {
        type: mode,
        body: outgoingBody,
        movieId: mode === "recommend" ? movie?.id : undefined,
        pollMovieAId: mode === "poll" ? pollA?.id : undefined,
        pollMovieBId: mode === "poll" ? pollB?.id : undefined,
      });
      onCreated?.();
      onClose?.();
    } catch (e) {
      setError(e.message || "Paylaşım oluşturulamadı.");
    }
    setSending(false);
  }

  function selectedCard(item, slot) {
    if (!item) {
      return (
        <TouchableOpacity style={[styles.selectedCard, styles.selectedEmpty]} onPress={() => setSelecting(slot)}>
          <Search size={16} color={c.dim} />
          <Text style={styles.selectedEmptyText}>{slot === "a" ? "1. içeriği seç" : "2. içeriği seç"}</Text>
        </TouchableOpacity>
      );
    }
    const editSelection = () => {
      setQuery("");
      setResults([]);
      setSelecting(slot);
      if (mode === "recommend") setMovie(null);
      else if (slot === "a") setPollA(null);
      else setPollB(null);
      requestAnimationFrame(() => searchInputRef.current?.focus());
    };
    return (
      <TouchableOpacity style={[styles.selectedCard, mode === "poll" && selecting === slot && { borderColor: c.accent }]} onPress={editSelection}>
        {item.poster ? <Image source={{ uri: item.poster }} style={styles.selectedPoster} /> : <View style={[styles.selectedPoster, { backgroundColor: c.surface2 }]} />}
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={styles.selectedTitle} numberOfLines={2}>{item.title}</Text>
          <Text style={styles.selectedMeta}>{item.type || "İçerik"} {item.year ? `· ${item.year}` : ""}</Text>
        </View>
        <Check size={16} color={c.accent} />
      </TouchableOpacity>
    );
  }

  return (
    <Modal visible={visible} transparent animationType={island ? "fade" : "slide"} onRequestClose={onClose}>
      <KeyboardAvoidingView style={[styles.backdrop, island && styles.backdropIsland]} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <TouchableOpacity style={StyleSheet.absoluteFillObject} activeOpacity={1} onPress={onClose} />
        <View style={[styles.sheet, island && styles.sheetIsland]}>
          <View style={styles.header}>
            <View>
              <Text style={styles.title}>Taste Post</Text>
              <Text style={styles.subtitle}>Zevkini paylaş, sohbeti başlat.</Text>
            </View>
            <TouchableOpacity style={styles.closeBtn} onPress={onClose}><X size={18} color={c.text} /></TouchableOpacity>
          </View>

          <View style={styles.modeRow}>
            {MODES.map(([id, label]) => (
              <TouchableOpacity key={id} style={[styles.modeChip, mode === id && styles.modeChipActive]} onPress={() => { setMode(id); setError(""); }}>
                {id === "recommend" ? <Sparkles size={12} color={mode === id ? c.bg : c.dim} /> : id === "poll" ? <Swords size={12} color={mode === id ? c.bg : c.dim} /> : null}
                <Text style={[styles.modeText, mode === id && styles.modeTextActive]}>{label}</Text>
              </TouchableOpacity>
            ))}
          </View>

          {!!initialContext && (
            <View style={styles.contextCard}>
              <Text style={styles.contextEyebrow}>🔥 GÜNÜN SORUSU</Text>
              <Text style={styles.contextText}>{initialContext}</Text>
              {mode !== "thought" && <Text style={styles.contextHint}>{mode === "recommend" ? "Cevap olarak bir film veya dizi seç." : "Cevabını iki içeriği kapıştırarak ver."}</Text>}
            </View>
          )}

          <TextInput
            style={styles.bodyInput}
            placeholder={mode === "poll" ? "Kısa bir not ekle (isteğe bağlı)…" : mode === "recommend" ? (initialContext ? "Neden bu içerik? (isteğe bağlı)…" : "Neden öneriyorsun? (isteğe bağlı)…") : initialContext ? "Cevabını yaz…" : "Aklında ne var?"}
            placeholderTextColor={c.dim}
            value={body}
            onChangeText={setBody}
            multiline
            maxLength={800}
          />

          {mode === "recommend" && movie && selectedCard(movie, "a")}
          {mode === "poll" && (
            <View style={styles.pollSelectedRow}>
              <View style={{ flex: 1 }}>{selectedCard(pollA, "a")}</View>
              <Text style={styles.vs}>VS</Text>
              <View style={{ flex: 1 }}>{selectedCard(pollB, "b")}</View>
            </View>
          )}

          {mode !== "thought" && ((mode === "recommend" && !movie) || mode === "poll") && (
            <View style={styles.searchArea}>
              <View style={styles.searchWrap}>
                <Search size={15} color={c.dim} />
                <TextInput
                  ref={searchInputRef}
                  style={styles.searchInput}
                  placeholder={mode === "poll" ? `${selecting === "a" ? "1." : "2."} içeriği ara…` : "Film veya dizi ara…"}
                  placeholderTextColor={c.dim}
                  value={query}
                  onChangeText={setQuery}
                  autoCorrect={false}
                />
                {searching && <ActivityIndicator size="small" color={c.accent} />}
              </View>

              {results.length > 0 && (
                <FlatList
                  data={results}
                  keyExtractor={(item) => String(item.id)}
                  style={styles.results}
                  keyboardShouldPersistTaps="always"
                  keyboardDismissMode="on-drag"
                  onScrollBeginDrag={Keyboard.dismiss}
                  nestedScrollEnabled
                  renderItem={({ item }) => (
                    <TouchableOpacity style={styles.resultRow} onPress={() => choose(item)}>
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

          {!!error && <Text style={styles.error}>{error}</Text>}

          <TouchableOpacity style={[styles.submit, (!canSend || sending) && { opacity: 0.45 }]} onPress={submit} disabled={!canSend || sending}>
            {sending ? <ActivityIndicator size="small" color={c.bg} /> : <Send size={15} color={c.bg} />}
            <Text style={styles.submitText}>Paylaş</Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

function makeStyles(c) {
  return StyleSheet.create({
    backdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "flex-end" },
    backdropIsland: { justifyContent: "center", alignItems: "center", padding: 16, backgroundColor: "rgba(0,0,0,0.7)" },
    sheet: { maxHeight: "88%", backgroundColor: c.bg, borderTopLeftRadius: 26, borderTopRightRadius: 26, padding: 16, paddingBottom: Platform.OS === "ios" ? 30 : 18, borderWidth: 1, borderColor: c.border },
    sheetIsland: { width: "100%", maxWidth: 420, borderRadius: 24, paddingBottom: 18, shadowColor: "#000", shadowOpacity: 0.42, shadowRadius: 24, shadowOffset: { width: 0, height: 12 }, elevation: 16 },
    header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 14 },
    title: { color: c.text, fontWeight: "900", fontSize: 18 },
    subtitle: { color: c.dim, fontSize: 11, marginTop: 2 },
    closeBtn: { width: 34, height: 34, borderRadius: 999, backgroundColor: c.surface2, alignItems: "center", justifyContent: "center" },
    modeRow: { flexDirection: "row", gap: 7, marginBottom: 12 },
    modeChip: { flex: 1, minHeight: 36, borderRadius: 999, borderWidth: 1, borderColor: c.border, backgroundColor: c.surface, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 5 },
    modeChipActive: { backgroundColor: c.accent, borderColor: c.accent },
    modeText: { color: c.dim, fontSize: 11, fontWeight: "800" },
    modeTextActive: { color: c.bg },
    contextCard: { backgroundColor: c.surface2, borderWidth: 1, borderColor: c.accent, borderRadius: 14, padding: 11, marginBottom: 10 },
    contextEyebrow: { color: c.accent, fontSize: 9.5, fontWeight: "900", letterSpacing: 0.6 },
    contextText: { color: c.text, fontSize: 12.5, fontWeight: "800", lineHeight: 18, marginTop: 4 },
    contextHint: { color: c.dim, fontSize: 10.5, lineHeight: 15, marginTop: 6 },
    bodyInput: { minHeight: 86, maxHeight: 140, textAlignVertical: "top", color: c.text, backgroundColor: c.surface, borderWidth: 1, borderColor: c.border, borderRadius: 15, padding: 12, fontSize: 13, marginBottom: 10 },
    searchArea: { position: "relative", zIndex: 40, elevation: 40, marginTop: 8 },
    searchWrap: { flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: c.surface2, borderWidth: 1, borderColor: c.border, borderRadius: 13, paddingHorizontal: 11, minHeight: 42 },
    searchInput: { flex: 1, color: c.text, fontSize: 12.5 },
    results: { position: "absolute", top: 48, left: 0, right: 0, maxHeight: 260, borderWidth: 1, borderColor: c.border, borderRadius: 13, backgroundColor: c.surface, zIndex: 50, elevation: 50, shadowColor: "#000", shadowOpacity: 0.34, shadowRadius: 14, shadowOffset: { width: 0, height: 8 } },
    resultRow: { flexDirection: "row", alignItems: "center", gap: 9, padding: 8, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: c.border },
    resultPoster: { width: 36, height: 53, borderRadius: 6 },
    resultTitle: { color: c.text, fontWeight: "800", fontSize: 12 },
    resultMeta: { color: c.dim, fontSize: 10, marginTop: 2 },
    selectedCard: { minHeight: 72, flexDirection: "row", alignItems: "center", gap: 8, borderWidth: 1, borderColor: c.border, borderRadius: 13, backgroundColor: c.surface2, padding: 7 },
    selectedEmpty: { justifyContent: "center", flexDirection: "column", gap: 5 },
    selectedEmptyText: { color: c.dim, fontSize: 10.5, fontWeight: "700", textAlign: "center" },
    selectedPoster: { width: 38, height: 56, borderRadius: 6 },
    selectedTitle: { color: c.text, fontSize: 11, fontWeight: "800" },
    selectedMeta: { color: c.dim, fontSize: 9, marginTop: 2 },
    pollSelectedRow: { flexDirection: "row", alignItems: "center", gap: 7, marginBottom: 2 },
    vs: { color: c.accent, fontWeight: "900", fontSize: 10 },
    error: { color: c.danger, fontSize: 11, marginTop: 8 },
    submit: { marginTop: 12, minHeight: 44, borderRadius: 13, backgroundColor: c.accent, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 7 },
    submitText: { color: c.bg, fontWeight: "900", fontSize: 13 },
  });
}
